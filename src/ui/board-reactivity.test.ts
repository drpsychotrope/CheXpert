import { describe, it, expect } from 'vitest';
import { flushSync } from 'svelte';
import { makeBoardState } from './board-reactivity.svelte';

// ADR-0051 regression. AnalysisBoard derives movableColor/dests/check from a ChessGame held in
// $state, which Svelte 5 does NOT deep-proxy. An in-place game.move() therefore never re-fires
// those deriveds; only reassigning `game` does — so before the fix the board froze after the first
// manual move (a second consecutive move was impossible). The 6 game boards have the same staleness
// for `check` (movableColor/dests survive via a co-dependency on a toggling status), fixed by
// anchoring the binding on the reactive `fen`. `turn` here stands in for the whole game-bound family.
describe('board prop reactivity (ADR-0051)', () => {
  it('game-bound deriveds go stale on in-place mutation, refresh on reassignment', () => {
    const s = makeBoardState();
    expect(s.turn).toBe('w');

    // In-place mutation only: reproduces the blocking bug — the derived never re-fires.
    expect(s.moveInPlace('e2', 'e4')).toBe(true);
    flushSync();
    expect(s.turn).toBe('w'); // STALE: still "white to move" though it is black's turn

    // AnalysisBoard's fix (advance(): reassign `game`) refreshes it.
    s.advance();
    flushSync();
    expect(s.turn).toBe('b');
  });

  it('consecutive manual moves both land once each move reassigns game (the fix)', () => {
    const s = makeBoardState();
    expect(s.move('e2', 'e4')).toBe(true); // mutate + advance (reassign)
    flushSync();
    expect(s.turn).toBe('b'); // board is now movable for black

    // The second consecutive move — impossible before the fix — now lands.
    expect(s.move('e7', 'e5')).toBe(true);
    flushSync();
    expect(s.turn).toBe('w');
  });

  it('check bound only to `game` stays stale; check anchored on `fen` refreshes', () => {
    // White Qh5, Black king e8. Qh5-h8+ gives check along the empty 8th rank.
    const s = makeBoardState('4k3/8/8/7Q/8/8/8/4K3 w - - 0 1');
    expect(s.check).toBe(false);
    expect(s.checkStale).toBe(false);

    // A move as the 6 game boards do it: mutate `game` in place, reassign ONLY `fen`.
    expect(s.moveKeepingGame('h5', 'h8')).toBe(true);
    flushSync();
    expect(s.checkStale).toBe(false); // BUG: check={game.inCheck()} never re-fires
    expect(s.check).toBe(true); // FIX: check={fen ? game.inCheck() : false} refreshes
  });
});
