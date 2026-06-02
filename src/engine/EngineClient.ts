// Promise-based wrapper around the Stockfish worker. Owns the worker lifecycle.
//
// Key spec constraints honored here:
//  - Engine confined to a Web Worker (AP-CHESS-1). The vendored lite single-thread
//    build IS the worker (see stockfish.worker.ts) — we load it from /public.
//  - Lite single-thread ports cannot be stopped mid-search → interruption is
//    implemented as terminate()+respawn, never a soft `stop` we rely on.
//  - A single long-lived worker is reused across moves (cheap), respawned only
//    to interrupt.

import { parseBestmove, parseInfo, parseMultiPv, scoreToWhiteCp, type ScoreInfo } from './uci';
import { engineWorkerUrl, multiThreadAvailable, forceLiteFallback, threadCount } from './stockfish.worker';

export interface GoOptions {
  /** Fixed search time in ms (used by the adaptive opponent for snappy moves). */
  movetime?: number;
  /** Or fixed depth (used by single-position calibration eval). */
  depth?: number;
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

export class EngineClient {
  private worker: Worker | null = null;
  private listeners = new Set<Listener>();
  private ready = false;
  private bootPromise: Promise<void> | null = null;
  private options: Record<string, string | number | boolean> = {};

  /** Override for tests: a factory that returns a Worker-like object. */
  constructor(private makeWorker: () => Worker = defaultWorkerFactory) {}

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
      for (const l of this.listeners) l(line);
    };

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

  /** Analyse a single position. Resolves on bestmove. */
  async evaluate(fen: string, opts: GoOptions): Promise<EvalResult> {
    await this.init();
    const whiteToMove = fen.split(' ')[1] !== 'b';
    let lastScore: ScoreInfo = { cp: 0 };
    let depthReached = 0;
    let bestmove: string | null = null;

    await this.waitFor(
      () => {
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
   * Resets MultiPV back to 1 afterwards.
   */
  async analyzeLines(fen: string, opts: GoOptions & { multipv: number }): Promise<LineResult[]> {
    await this.init();
    const whiteToMove = fen.split(' ')[1] !== 'b';
    const best = new Map<number, { score: ScoreInfo; uci: string | null }>();

    this.send(`setoption name MultiPV value ${opts.multipv}`);
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
    this.setOption('UCI_Chess960', false);
    await this.isready();
  }

  /** Hard interrupt: kill the worker and respawn (lite single-thread cannot soft-stop). */
  async interrupt(): Promise<void> {
    this.terminate();
    await this.init();
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.bootPromise = null;
  }

  private addListener(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Run `trigger`, then resolve when `match` returns true for some line. */
  private waitFor(
    trigger: () => void,
    match: (line: string) => boolean,
    timeoutMs: number,
    label: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`EngineClient timeout waiting for ${label}`));
      }, timeoutMs);
      const off = this.addListener((line) => {
        if (match(line)) {
          clearTimeout(timer);
          off();
          resolve();
        }
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
