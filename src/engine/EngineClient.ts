// Promise-based wrapper around the Stockfish worker. Owns the worker lifecycle.
//
// Key spec constraints honored here:
//  - Engine confined to a Web Worker (AP-CHESS-1). The vendored lite single-thread
//    build IS the worker (see stockfish.worker.ts) — we load it from /public.
//  - Lite single-thread ports cannot be stopped mid-search → interruption is
//    implemented as terminate()+respawn, never a soft `stop` we rely on.
//  - A single long-lived worker is reused across moves (cheap), respawned only
//    to interrupt.
//
// CONCURRENCY (audit W1): there is ONE worker and ONE message stream. Two searches
// in flight at once would both observe the same `bestmove` line and resolve each
// other's promise (cross-talk), corrupting results. So every worker round-trip that
// issues a `go`/`isready` is SERIALIZED through an internal FIFO queue (`enqueue`):
// exactly one search is ever active. Pending waiters are tracked so terminate() and a
// worker `error` event reject them deterministically instead of leaving them to hang
// until the 30 s timeout. The public API (evaluate/analyzeLines/resetVariant/…) is
// unchanged — serialization is entirely internal.

import { parseBestmove, parseInfo, parseMultiPv, scoreToWhiteCp, type ScoreInfo } from './uci';
import { engineWorkerUrl, multiThreadAvailable, forceLiteFallback, threadCount } from './stockfish.worker';

export interface GoOptions {
  /** Fixed search time in ms (used by the adaptive opponent for snappy moves). */
  movetime?: number;
  /** Or fixed depth (used by single-position calibration eval). */
  depth?: number;
  /**
   * Force FULL engine strength for THIS search. Analysis paths (analysis board, post-game
   * analysis, endgame fallback, calibration ACPL) must set this: the shared worker may have
   * been left throttled to the bot's Elo by a prior game (`UCI_LimitStrength` is sticky), which
   * would silently corrupt evals/blunder-classification/puzzles (audit v2 C-1 / P0-01). The flag
   * is sent inline before `go` (like MultiPV), so it is correct regardless of prior option state.
   */
  fullStrength?: boolean;
}

export interface EvalResult {
  /** Best move in UCI form, or null if none (mate/stalemate). */
  bestmove: string | null;
  /** Best score seen, White-POV centipawns (mate clamped large). */
  whiteCp: number;
  /** Raw last score from the mover POV. */
  score: ScoreInfo;
  depthReached: number;
}

export interface LineResult {
  /** UCI move that starts this line, or null. */
  uci: string | null;
  /** White-POV centipawns (mate clamped large). */
  whiteCp: number;
  /** Mate distance from the mover POV, if a forced mate. */
  mate?: number;
}

type Listener = (line: string) => void;
/** A search/isready promise currently waiting on the worker, so we can reject it on terminate/error. */
type Pending = { reject: (e: unknown) => void };

/** Validate a FEN enough to read the side to move (audit W6). Throws on a malformed FEN
 *  instead of silently assuming White, which would invert every score's POV. */
function sideToMove(fen: string): 'w' | 'b' {
  const stm = fen.split(' ')[1];
  if (stm !== 'w' && stm !== 'b') {
    throw new Error(`EngineClient: malformed FEN (missing side-to-move field): "${fen}"`);
  }
  return stm;
}

export class EngineClient {
  private worker: Worker | null = null;
  private listeners = new Set<Listener>();
  /** Active waiters (one at a time under serialization, plus boot waiters). */
  private pending = new Set<Pending>();
  private ready = false;
  private bootPromise: Promise<void> | null = null;
  private options: Record<string, string | number | boolean> = {};
  /** FIFO tail: every serialized op chains onto this so only one search runs at a time. */
  private chain: Promise<unknown> = Promise.resolve();

  /** Override for tests: a factory that returns a Worker-like object. */
  constructor(private makeWorker: () => Worker = defaultWorkerFactory) {}

  /** Serialize a worker round-trip: run `op` only after the previous one settles. */
  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = this.chain.then(op, op);
    // Keep the chain alive whatever this op's outcome, without unhandled rejections.
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Boot (or re-boot) the worker and wait for uciok + readyok. */
  async init(): Promise<void> {
    if (this.ready) return;
    if (this.bootPromise) return this.bootPromise;
    this.bootPromise = this.bootInternal();
    return this.bootPromise;
  }

  private async bootInternal(): Promise<void> {
    const useMt = multiThreadAvailable() && !forceLiteFallback.get();
    this.worker = this.makeWorker();
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      // Copy: a matching listener removes itself mid-iteration.
      for (const l of [...this.listeners]) l(line);
    };
    // A worker crash (OOM, bad .wasm, internal throw) stops the message stream. Without
    // these handlers the in-flight waiter would hang until its 30 s timeout (audit W1).
    this.worker.onerror = () => this.handleWorkerFailure('engine worker error');
    this.worker.onmessageerror = () => this.handleWorkerFailure('engine worker message error');

    try {
      // The engine queues commands sent before it finishes loading, so we can send
      // `uci` immediately and just wait for `uciok`.
      await this.waitFor(() => this.send('uci'), (line) => line.trim() === 'uciok', 20000, 'uciok');
      if (useMt) this.send(`setoption name Threads value ${threadCount()}`);
      for (const [k, v] of Object.entries(this.options)) this.send(`setoption name ${k} value ${v}`);
      await this.isready();
    } catch (e) {
      // If the multi-thread engine failed to boot, fall back to lite for this session
      // (never leave the app without a working engine — AP-CHESS-65).
      if (useMt && !forceLiteFallback.get()) {
        forceLiteFallback.set(true);
        this.terminate();
        this.bootPromise = null;
        return this.bootInternal();
      }
      this.bootPromise = null;
      throw e;
    }
    this.ready = true;
    this.bootPromise = null;
  }

  /** Send `isready`, resolve on `readyok`. */
  async isready(): Promise<void> {
    await this.waitFor(() => this.send('isready'), (line) => line.trim() === 'readyok', 20000, 'readyok');
  }

  send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  setOption(name: string, value: string | number | boolean): void {
    this.options[name] = value;
    this.send(`setoption name ${name} value ${value}`);
  }

  /** Analyse a single position. Resolves on bestmove. Serialized (one search at a time). */
  async evaluate(fen: string, opts: GoOptions): Promise<EvalResult> {
    const whiteToMove = sideToMove(fen) === 'w'; // validates the FEN before queueing
    await this.init();
    return this.enqueue(() => this.evaluateInner(fen, whiteToMove, opts));
  }

  private async evaluateInner(fen: string, whiteToMove: boolean, opts: GoOptions): Promise<EvalResult> {
    let lastScore: ScoreInfo = { cp: 0 };
    let depthReached = 0;
    let bestmove: string | null = null;

    await this.waitFor(
      () => {
        // Sent inline before the search so it wins over any sticky UCI_LimitStrength (C-1).
        if (opts.fullStrength) this.send('setoption name UCI_LimitStrength value false');
        this.send(`position fen ${fen}`);
        if (opts.depth != null) this.send(`go depth ${opts.depth}`);
        else this.send(`go movetime ${opts.movetime ?? 500}`);
      },
      (line) => {
        const info = parseInfo(line);
        if (info) {
          if (info.cp !== undefined || info.mate !== undefined) lastScore = info;
          if (info.depth) depthReached = info.depth;
        }
        if (line.startsWith('bestmove')) {
          bestmove = parseBestmove(line);
          return true;
        }
        return false;
      },
      30000,
      'bestmove',
    );

    return { bestmove, whiteCp: scoreToWhiteCp(lastScore, whiteToMove), score: lastScore, depthReached };
  }

  /**
   * Analyse a position with MultiPV, returning the top `multipv` lines sorted
   * best-first (White-POV). Used by the puzzle generator's uniqueness check
   * (AP-CHESS-10): a position only becomes a puzzle if line 1 clearly beats line 2.
   * Resets MultiPV back to 1 afterwards. Serialized (one search at a time).
   */
  async analyzeLines(fen: string, opts: GoOptions & { multipv: number }): Promise<LineResult[]> {
    const whiteToMove = sideToMove(fen) === 'w'; // validates the FEN before queueing
    await this.init();
    return this.enqueue(() => this.analyzeLinesInner(fen, whiteToMove, opts));
  }

  private async analyzeLinesInner(
    fen: string,
    whiteToMove: boolean,
    opts: GoOptions & { multipv: number },
  ): Promise<LineResult[]> {
    const best = new Map<number, { score: ScoreInfo; uci: string | null }>();

    this.send(`setoption name MultiPV value ${opts.multipv}`);
    if (opts.fullStrength) this.send('setoption name UCI_LimitStrength value false');
    await this.waitFor(
      () => {
        this.send(`position fen ${fen}`);
        if (opts.depth != null) this.send(`go depth ${opts.depth}`);
        else this.send(`go movetime ${opts.movetime ?? 500}`);
      },
      (line) => {
        const info = parseMultiPv(line);
        if (info && (info.cp !== undefined || info.mate !== undefined)) {
          best.set(info.multipv, { score: info, uci: info.pvMove ?? null });
        }
        return line.startsWith('bestmove');
      },
      30000,
      'bestmove (multipv)',
    );
    this.send('setoption name MultiPV value 1');

    const lines: LineResult[] = [...best.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({
        uci: v.uci,
        whiteCp: scoreToWhiteCp(v.score, whiteToMove),
        mate: v.score.mate,
      }));
    // Sort best-first from the mover's POV: White wants high whiteCp, Black low.
    lines.sort((a, b) => (whiteToMove ? b.whiteCp - a.whiteCp : a.whiteCp - b.whiteCp));
    return lines;
  }

  /** Ensure the engine is in STANDARD (non-960) mode. Idempotent; call before evaluating standard positions. */
  async resetVariant(): Promise<void> {
    await this.init();
    return this.enqueue(async () => {
      this.setOption('UCI_Chess960', false);
      await this.isready();
    });
  }

  /** Hard interrupt: kill the worker and respawn (lite single-thread cannot soft-stop). */
  async interrupt(): Promise<void> {
    this.terminate();
    await this.init();
  }

  terminate(): void {
    // Reject anything still waiting BEFORE we kill the worker, so no promise is orphaned
    // and no stale listener survives into the next worker (audit W1).
    this.failAll(new Error('engine terminated'));
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.bootPromise = null;
  }

  /** A worker error/crash: reject in-flight waiters and mark dead so the next call re-boots. */
  private handleWorkerFailure(msg: string): void {
    this.failAll(new Error(msg));
    this.worker = null;
    this.ready = false;
    this.bootPromise = null;
  }

  /** Reject every pending waiter and clear all listeners. */
  private failAll(err: unknown): void {
    for (const p of [...this.pending]) p.reject(err);
    this.pending.clear();
    this.listeners.clear();
  }

  private addListener(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Run `trigger`, then resolve when `match` returns true for some line. Registers the
   *  waiter so terminate()/worker-error can reject it deterministically. */
  private waitFor(
    trigger: () => void,
    match: (line: string) => boolean,
    timeoutMs: number,
    label: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let off: () => void = () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;

      // One-shot teardown shared by resolve / timeout / external rejection.
      const settle = (action: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        off();
        this.pending.delete(entry);
        action();
      };

      const entry: Pending = { reject: (e: unknown) => settle(() => reject(e)) };
      this.pending.add(entry);

      timer = setTimeout(
        () => settle(() => reject(new Error(`EngineClient timeout waiting for ${label}`))),
        timeoutMs,
      );
      off = this.addListener((line) => {
        if (match(line)) settle(() => resolve());
      });
      trigger();
    });
  }
}

function defaultWorkerFactory(): Worker {
  // Classic worker: the vendored engine file installs its own onmessage handler.
  // Picks the multi-thread build when the page is cross-origin isolated, else lite.
  return new Worker(engineWorkerUrl(multiThreadAvailable(), forceLiteFallback.get()));
}
