// Promise-based wrapper around the Stockfish worker. Owns the worker lifecycle.
//
// Key spec constraints honored here:
//  - Engine confined to a Web Worker (AP-CHESS-1). The vendored lite single-thread
//    build IS the worker (see stockfish.worker.ts) — we load it from /public.
//  - Lite single-thread ports cannot be stopped mid-search → interruption is
//    implemented as terminate()+respawn, never a soft `stop` we rely on.
//  - A single long-lived worker is reused across moves (cheap), respawned only
//    to interrupt.

import { parseBestmove, parseInfo, scoreToWhiteCp, type ScoreInfo } from './uci';
import { ENGINE_WORKER_URL } from './stockfish.worker';

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
    this.worker = this.makeWorker();
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      for (const l of this.listeners) l(line);
    };

    // The engine queues commands sent before it finishes loading, so we can send
    // `uci` immediately and just wait for `uciok`.
    await this.waitFor(() => this.send('uci'), (line) => line.trim() === 'uciok', 20000, 'uciok');
    for (const [k, v] of Object.entries(this.options)) this.send(`setoption name ${k} value ${v}`);
    await this.isready();
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
  return new Worker(ENGINE_WORKER_URL);
}
