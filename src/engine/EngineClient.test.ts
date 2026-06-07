// Tests for the engine client's lifecycle + concurrency contract (audit W1/W8).
// Uses the injected `makeWorker` factory (constructor) with a scripted fake worker,
// so no real WASM is loaded. Covers: boot+evaluate, FEN validation, serialization
// (no cross-talk between concurrent searches), reject-on-terminate, reject-on-error,
// and MultiPV line ordering.

import { describe, it, expect } from 'vitest';
import { EngineClient } from './EngineClient';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BLACK_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

interface FakeOpts {
  /** Never emit `bestmove` for a `go` (simulate a hung/crashed search). */
  silentGo?: boolean;
}

/** A scripted Stockfish-like worker. Echoes a side-dependent bestmove so cross-talk
 *  (one search resolving another's promise) is detectable. */
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessageerror: ((e: unknown) => void) | null = null;
  posted: string[] = [];
  terminated = false;
  private multipv = 1;
  private lastFen = START;

  constructor(private opts: FakeOpts = {}) {}

  private emit(line: string) {
    this.onmessage?.({ data: line } as MessageEvent);
  }

  postMessage(cmd: string) {
    this.posted.push(cmd);
    if (cmd.startsWith('setoption name MultiPV value ')) {
      this.multipv = Number(cmd.split(' ').pop());
    } else if (cmd.startsWith('position fen ')) {
      this.lastFen = cmd.slice('position fen '.length);
    }
    // Respond on a microtask so the client's listener is registered first.
    queueMicrotask(() => this.respond(cmd));
  }

  private respond(cmd: string) {
    if (cmd === 'uci') this.emit('uciok');
    else if (cmd === 'isready') this.emit('readyok');
    else if (cmd.startsWith('go')) {
      if (this.opts.silentGo) return;
      const stm = this.lastFen.split(' ')[1] === 'b' ? 'b' : 'w';
      const move = stm === 'w' ? 'e2e4' : 'e7e5';
      if (this.multipv > 1) {
        this.emit(`info depth 12 multipv 1 score cp 60 pv ${move}`);
        this.emit('info depth 12 multipv 2 score cp 10 pv d2d4');
      } else {
        this.emit(`info depth 12 score cp 31 pv ${move}`);
      }
      this.emit(`bestmove ${move}`);
    }
  }

  terminate() {
    this.terminated = true;
  }
}

describe('EngineClient', () => {
  it('boots and evaluates a position', async () => {
    const c = new EngineClient(() => new FakeWorker() as unknown as Worker);
    const r = await c.evaluate(START, { movetime: 100 });
    expect(r.bestmove).toBe('e2e4');
    expect(r.depthReached).toBe(12);
  });

  it('rejects a malformed FEN instead of guessing the side to move (W6)', async () => {
    const c = new EngineClient(() => new FakeWorker() as unknown as Worker);
    await expect(c.evaluate('not a valid fen', { depth: 8 })).rejects.toThrow(/malformed FEN/);
  });

  it('serializes concurrent searches — no cross-talk (W1)', async () => {
    // Without serialization both searches share one listener stream and the first
    // bestmove resolves BOTH promises with the same (wrong) move. With the fix each
    // gets its own side-correct result.
    const c = new EngineClient(() => new FakeWorker() as unknown as Worker);
    const [white, black] = await Promise.all([
      c.evaluate(START, { movetime: 100 }),
      c.evaluate(BLACK_TO_MOVE, { movetime: 100 }),
    ]);
    expect(white.bestmove).toBe('e2e4');
    expect(black.bestmove).toBe('e7e5');
  });

  it('analyzeLines returns lines sorted best-first (White POV)', async () => {
    const c = new EngineClient(() => new FakeWorker() as unknown as Worker);
    const lines = await c.analyzeLines(START, { multipv: 2, movetime: 100 });
    expect(lines.length).toBe(2);
    expect(lines[0]?.uci).toBe('e2e4');
    expect(lines[0]!.whiteCp).toBeGreaterThan(lines[1]!.whiteCp);
  });

  it('terminate() rejects an in-flight search instead of leaving it to hang (W1)', async () => {
    const c = new EngineClient(() => new FakeWorker({ silentGo: true }) as unknown as Worker);
    const p = c.evaluate(START, { movetime: 100 });
    await new Promise((r) => setTimeout(r, 20)); // let boot + go happen
    c.terminate();
    await expect(p).rejects.toThrow(/terminated/);
  });

  it('a worker error rejects in-flight searches (W1)', async () => {
    let inst: FakeWorker | null = null;
    const c = new EngineClient(() => {
      inst = new FakeWorker({ silentGo: true });
      return inst as unknown as Worker;
    });
    const p = c.evaluate(START, { movetime: 100 });
    await new Promise((r) => setTimeout(r, 20));
    inst!.onerror?.({});
    await expect(p).rejects.toThrow(/worker error/);
  });
});
