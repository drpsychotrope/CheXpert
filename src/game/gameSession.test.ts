import { describe, it, expect } from 'vitest';
import { createGameSession, type EnginePort, type GameSessionConfig } from './gameSession';

// DOM-free parity tests for the shared game-session controller (F6, ADR-0057). Mirrors
// playSession.test.ts + board-reactivity.test.ts: no component mount, no engine worker.
//
// PURITY GUARD (spec §5 C3-2): determinism here comes ENTIRELY from the faked engine port
// (scripted moves) — NOT from vi.useFakeTimers()/seeded Math.random. The core must not read
// Date/Math.random/performance.now; if any test below needed a global patch to pass, the core
// leaked impurity. None do.

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A deferred promise handle for driving an in-flight engine search from the test. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Scriptable fake engine implementing the controller's port. Records the args each pick received
 *  so tests can assert the budget/fen the controller passed (loop-parity evidence). */
class FakeEngine implements EnginePort {
  pickMoveCalls: Array<{ fen: string; movetime?: number }> = [];
  pickHumanCalls: Array<{ fen: string; movetime?: number }> = [];
  interruptCount = 0;
  /** Queue of moves (or thrown errors) returned by the next pick, FIFO. */
  private script: Array<string | null | Error> = [];
  /** When set, pick returns this pending promise instead of resolving immediately (for P1-14). */
  pending: ReturnType<typeof deferred<string | null>> | null = null;

  constructor(script: Array<string | null | Error> = []) {
    this.script = script;
  }

  private next(): string | null {
    const v = this.script.shift();
    if (v instanceof Error) throw v;
    return v ?? null;
  }

  async pickMove(fen: string, movetime?: number): Promise<string | null> {
    this.pickMoveCalls.push({ fen, movetime });
    if (this.pending) return this.pending.promise;
    return this.next();
  }
  async pickHumanMove(fen: string, movetime?: number): Promise<string | null> {
    this.pickHumanCalls.push({ fen, movetime });
    if (this.pending) return this.pending.promise;
    return this.next();
  }
  async interrupt(): Promise<void> {
    this.interruptCount++;
  }
}

function makeSession(engine: EnginePort, config: GameSessionConfig = {}, playerSide: 'white' | 'black' = 'white', startFen = START_FEN) {
  return createGameSession({ startFen, playerSide, engine, config });
}

describe('gameSession controller (F6, ADR-0057)', () => {
  // §5.1 — Loop parity (engine style): siblings' path = pickMove with fixed 500ms, no retry.
  it('engine-style loop: applyPlayerMove then engineReply advances via pickMove(500)', async () => {
    const engine = new FakeEngine(['e7e5']); // bot's scripted reply
    const s = makeSession(engine); // no humanMove, no movetime → pickMove/500 (sibling defaults)

    const after = s.applyPlayerMove('e2', 'e4');
    expect(after).not.toBeNull();
    expect(after!.lastMove).toEqual(['e2', 'e4']);
    expect(s.turn).toBe('black'); // player moved; bot (black) to move

    const reply = await s.engineReply();
    expect(engine.pickMoveCalls).toHaveLength(1);
    expect(engine.pickMoveCalls[0].movetime).toBe(500); // sibling fixed budget
    expect(engine.pickHumanCalls).toHaveLength(0); // engine style never samples human moves
    expect(reply.lastMove).toEqual(['e7', 'e5']);
    expect(reply.status).toBe('playing');
    expect(s.turn).toBe('white'); // back to the player
  });

  // §5.2 — Loop parity (human style + clock): pickHumanMove with the budgeted movetime.
  it('human-style loop: engineReply calls pickHumanMove with the provider budget', async () => {
    const engine = new FakeEngine(['e7e5']);
    const s = makeSession(engine, { humanMove: true, movetime: () => 137 });

    s.applyPlayerMove('e2', 'e4');
    await s.engineReply();

    expect(engine.pickHumanCalls).toHaveLength(1);
    expect(engine.pickHumanCalls[0].movetime).toBe(137); // budgeted movetime forwarded
    expect(engine.pickMoveCalls).toHaveLength(0);
  });

  // §5.2b — movetime provider receives the bot side and the game (clock-aware budget shape).
  it('movetime provider receives the bot side', async () => {
    const engine = new FakeEngine(['e7e5']);
    let seenSide: 'w' | 'b' | null = null;
    const s = makeSession(engine, { humanMove: true, movetime: (_g, side) => { seenSide = side; return 200; } });
    s.applyPlayerMove('e2', 'e4');
    await s.engineReply();
    expect(seenSide).toBe('b'); // player is white → bot is black
  });

  // §5.2c — null movetime → pickHumanMove default (Play's untimed branch: pickHumanMove(fen)).
  it('null movetime budget falls through to pickHumanMove default (no movetime arg)', async () => {
    const engine = new FakeEngine(['e7e5']);
    const s = makeSession(engine, { humanMove: true, movetime: () => null });
    s.applyPlayerMove('e2', 'e4');
    await s.engineReply();
    expect(engine.pickHumanCalls[0].movetime).toBeUndefined(); // default 300 inside the port
  });

  // §5.3 — Illegal engine move halt (P1-17): status 'over', no phantom move, fen unchanged.
  it('illegal engine move halts the game without advancing (P1-17)', async () => {
    const engine = new FakeEngine(['e7e9']); // not a legal square / move
    const s = makeSession(engine);
    s.applyPlayerMove('e2', 'e4');
    const fenBefore = s.fen;

    const reply = await s.engineReply();
    expect(reply.status).toBe('over');
    expect(s.illegalHalt).toBe(true);
    expect(s.movePlayed).toBe(false);
    expect(s.fen).toBe(fenBefore); // no phantom move applied
    expect(reply.lastMove).toEqual(['e2', 'e4']); // still the player's move
  });

  // §5.4 — Resign-during-think guard (P1-14): the late move is dropped, status stays 'over'.
  it('resign during an in-flight engineReply drops the late move (P1-14)', async () => {
    const engine = new FakeEngine();
    engine.pending = deferred<string | null>(); // bot search hangs until we resolve it
    const s = makeSession(engine);
    s.applyPlayerMove('e2', 'e4');
    const fenBeforeReply = s.fen;

    const replyPromise = s.engineReply(); // starts the search (pending)
    // Player resigns while the bot is "thinking".
    const r = s.resign();
    expect(r.status).toBe('over');

    // The search now returns a (would-be legal) move — it must be dropped.
    engine.pending.resolve('e7e5');
    const reply = await replyPromise;
    expect(reply.status).toBe('over');
    expect(s.movePlayed).toBe(false);
    expect(s.fen).toBe(fenBeforeReply); // late move not applied
  });

  // §5.5 — Terminal mapping: checkmate (player winner / loser) + draw, structured (no string).
  it('terminal mapping: checkmate with the player as winner → outcome win', async () => {
    // Fool's mate: 1.f3 e5 2.g4 Qh4#. Player is white (the mated side) here → loss for player.
    const engine = new FakeEngine(['e7e5', 'd8h4']);
    const s = makeSession(engine); // player = white
    s.applyPlayerMove('f2', 'f3');
    await s.engineReply(); // bot: e5
    s.applyPlayerMove('g2', 'g4');
    const reply = await s.engineReply(); // bot: Qh4#

    expect(reply.terminal.over).toBe(true);
    expect(reply.terminal.reason).toBe('checkmate');
    expect(reply.terminal.winner).toBe('b'); // black mated white
    expect(reply.terminal.outcome).toBe('loss'); // player (white) lost
    expect(reply.status).toBe('over');
    // AP-CTRL-1: the result is STRUCTURED only — exactly these keys, no localized message field.
    expect(Object.keys(reply.terminal).sort()).toEqual(['outcome', 'over', 'reason', 'winner']);
  });

  it('terminal mapping: player delivers checkmate → outcome win', async () => {
    // Scholar's mate, player = white: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7# (Qf7 defended by Bc4).
    const engine = new FakeEngine(['e7e5', 'b8c6', 'g8f6']);
    const s = makeSession(engine); // player = white
    s.applyPlayerMove('e2', 'e4');
    await s.engineReply(); // bot e5
    s.applyPlayerMove('d1', 'h5');
    await s.engineReply(); // bot Nc6
    s.applyPlayerMove('f1', 'c4');
    await s.engineReply(); // bot Nf6??
    const reply = s.applyPlayerMove('h5', 'f7'); // Qxf7#

    expect(reply).not.toBeNull();
    expect(reply!.terminal.over).toBe(true);
    expect(reply!.terminal.reason).toBe('checkmate');
    expect(reply!.terminal.winner).toBe('w');
    expect(reply!.terminal.outcome).toBe('win'); // player (white) won
    expect(reply!.status).toBe('over');
  });

  it('terminal mapping: stalemate → draw outcome, no winner', async () => {
    // Classic stalemate position, black to move and stalemated after white plays.
    // FEN: black king a8, white king c7 (not adjacent illegally), white queen, white to move plays Qc8?? no.
    // Use a known stalemate-in-1: white Kf6, Qg6 vs black Kh8? That's mate. Use: black to move stalemated
    // already is not allowed (game must end on the move). Drive: white Qb6, Kb8?... Use a verified one:
    // 7k/5Q2/6K1/8/8/8/8/8 b - - 0 1 is stalemate (black king h8, Qf7, Kg6). Seed and assert directly.
    const s = makeSession(new FakeEngine(), {}, 'white', '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(s.checkTerminal()).toEqual({ over: true, reason: 'stalemate', outcome: 'draw' });
  });

  // §5.6 — ADR-0051 fen reassignment: every move returns a NEW fen snapshot (no in-place reliance).
  it('every move returns a fresh fen snapshot (ADR-0051 reactivity contract)', async () => {
    const engine = new FakeEngine(['e7e5']);
    const s = makeSession(engine);
    const fen0 = s.fen;
    const afterPlayer = s.applyPlayerMove('e2', 'e4')!;
    expect(afterPlayer.fen).not.toBe(fen0); // distinct FEN string after the player's move
    const afterBot = await s.engineReply();
    expect(afterBot.fen).not.toBe(afterPlayer.fen); // distinct again after the bot's move
  });

  // §5.7 — startFen seeding (C3 enabler): init with a non-start FEN → first turn/side correct.
  it('seeds from a non-start FEN with the correct side to move', () => {
    // Black to move in this FEN.
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
    const s = makeSession(new FakeEngine(), {}, 'black', fen);
    expect(s.fen).toBe(fen);
    expect(s.turn).toBe('black'); // side-to-move read from the seeded FEN
    expect(s.botSide).toBe('w'); // player black → bot white
  });

  it('startFen seeding lets the player (black) move first from the seeded position', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
    const s = makeSession(new FakeEngine(['nope']), {}, 'black', fen);
    const after = s.applyPlayerMove('g8', 'f6'); // a legal black move
    expect(after).not.toBeNull();
    expect(after!.lastMove).toEqual(['g8', 'f6']);
  });

  // §5.8 — Retry opt-in: retry:true → engine throw sets an error state (no fallback move);
  // retry:false (sibling default) → the throw surfaces.
  it('retry:true sets engineError on an engine throw (no fallback move)', async () => {
    const engine = new FakeEngine([new Error('worker crashed')]);
    const s = makeSession(engine, { retry: true });
    s.applyPlayerMove('e2', 'e4');
    const fenBefore = s.fen;
    const reply = await s.engineReply();
    expect(s.engineError).toBe(true);
    expect(s.movePlayed).toBe(false);
    expect(reply.fen).toBe(fenBefore); // board frozen on the bot's turn, awaiting Retry
    expect(reply.status).toBe('thinking'); // not 'over', not 'playing' — Retry is offered
  });

  it('retry:false (sibling default) surfaces the engine throw to the caller', async () => {
    const engine = new FakeEngine([new Error('worker crashed')]);
    const s = makeSession(engine); // no retry flag
    s.applyPlayerMove('e2', 'e4');
    await expect(s.engineReply()).rejects.toThrow('worker crashed');
    expect(s.engineError).toBe(false); // no retry state for siblings
  });

  it('retryEngineMove interrupts then re-asks the engine', async () => {
    const engine = new FakeEngine([new Error('boom')]);
    const s = makeSession(engine, { retry: true });
    s.applyPlayerMove('e2', 'e4');
    await s.engineReply(); // errors
    expect(s.engineError).toBe(true);

    engine.pending = null;
    // Queue a good move for the retry.
    (engine as unknown as { script: Array<string | null | Error> }).script = ['e7e5'];
    const reply = await s.retryEngineMove();
    expect(engine.interruptCount).toBe(1);
    expect(reply.lastMove).toEqual(['e7', 'e5']);
    expect(s.engineError).toBe(false);
    expect(reply.status).toBe('playing');
  });

  // §5.9 — No auto-chain (C1-1): applyPlayerMove must NOT call the engine port; engineReply is a
  // separate explicit step. Guards Play's coached-takeback interposition + clock-press ordering.
  it('applyPlayerMove does NOT trigger an engine reply (no auto-chain, C1-1)', () => {
    const engine = new FakeEngine(['e7e5']);
    const s = makeSession(engine, { humanMove: true, movetime: () => 100 });
    s.applyPlayerMove('e2', 'e4');
    // The engine port was not touched by applyPlayerMove.
    expect(engine.pickMoveCalls).toHaveLength(0);
    expect(engine.pickHumanCalls).toHaveLength(0);
    expect(s.turn).toBe('black'); // exactly one ply advanced
  });

  // §5.9b — applyPlayerMove rejects an out-of-turn / illegal move (the inline onMove `if (!san)`).
  it('applyPlayerMove returns null on an illegal move and does not advance', () => {
    const s = makeSession(new FakeEngine());
    const before = s.fen;
    expect(s.applyPlayerMove('e2', 'e5')).toBeNull(); // illegal pawn jump
    expect(s.fen).toBe(before);
    expect(s.turn).toBe('white');
  });

  it('applyPlayerMove returns null when it is not the player to move', () => {
    // Player is white but the seeded FEN has black to move.
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
    const s = makeSession(new FakeEngine(), {}, 'white', fen);
    expect(s.applyPlayerMove('g8', 'f6')).toBeNull(); // black's move, but player is white
  });

  // Coached-takeback hook (spec §2): undoPlayerMove reverts one ply, player stays on move.
  it('undoPlayerMove reverts the player move and keeps the player on move', () => {
    const s = makeSession(new FakeEngine());
    s.applyPlayerMove('e2', 'e4');
    expect(s.turn).toBe('black');
    const after = s.undoPlayerMove();
    expect(after.lastMove).toBeNull();
    expect(after.fen).toBe(START_FEN);
    expect(s.turn).toBe('white'); // back on move
  });

  // bookMove capability: a provided book move is played WITHOUT consulting the engine port.
  it('bookMove plays the book move and skips the engine port', async () => {
    const engine = new FakeEngine(['should-not-be-used']);
    const s = makeSession(engine, { bookMove: () => 'e7e5' });
    s.applyPlayerMove('e2', 'e4');
    const reply = await s.engineReply();
    expect(reply.lastMove).toEqual(['e7', 'e5']);
    expect(engine.pickMoveCalls).toHaveLength(0); // book short-circuits the search
    expect(engine.pickHumanCalls).toHaveLength(0);
  });

  it('bookMove returning null falls back to the engine pick', async () => {
    const engine = new FakeEngine(['e7e5']);
    const s = makeSession(engine, { bookMove: () => null });
    s.applyPlayerMove('e2', 'e4');
    await s.engineReply();
    expect(engine.pickMoveCalls).toHaveLength(1); // fell through to the engine
  });

  // checkTerminal idempotency (W6 / AP-CTRL-9): calling it repeatedly is side-effect free.
  it('checkTerminal is idempotent and pure (callable any number of times)', async () => {
    const engine = new FakeEngine(['e7e5', 'd8h4']);
    const s = makeSession(engine); // player white, drive Fool's mate
    s.applyPlayerMove('f2', 'f3');
    await s.engineReply();
    s.applyPlayerMove('g2', 'g4');
    await s.engineReply(); // Qh4#
    const a = s.checkTerminal();
    const b = s.checkTerminal();
    const c = s.checkTerminal();
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.over).toBe(true);
    expect(a.reason).toBe('checkmate');
  });
});
