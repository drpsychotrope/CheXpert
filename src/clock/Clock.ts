// Pure chess-clock core (spec §4.1, AP-TC-1, AP-TC-5).
//
// State machine for a two-sided Fischer-increment clock. NO Date.now() and NO
// Math.random() / performance.now() inside — the Play loop measures elapsed ms
// via performance.now() deltas and passes them to tick(). Mirrors the
// rand-injection discipline in humanMove.ts and the immutable transitions in
// AdaptiveOpponent.recordGame. Every transition returns a NEW object.

export type Side = 'w' | 'b';

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  incMs: number;
  /** Whose clock is currently running. */
  side: Side;
  running: boolean;
}

/** Build a clock with both sides at `initialMs`, the given Fischer increment, and `running=false`. */
export function initClock(initialMs: number, incMs: number, side: Side = 'w'): ClockState {
  return { whiteMs: initialMs, blackMs: initialMs, incMs, side, running: false };
}

export function startClock(s: ClockState): ClockState {
  return { ...s, running: true };
}

export function stopClock(s: ClockState): ClockState {
  return { ...s, running: false };
}

/** Subtract `elapsedMs` from the running side; clamps at 0 (never negative). No-op if !running. */
export function tick(s: ClockState, elapsedMs: number): ClockState {
  if (!s.running) return s;
  if (s.side === 'w') return { ...s, whiteMs: Math.max(0, s.whiteMs - elapsedMs) };
  return { ...s, blackMs: Math.max(0, s.blackMs - elapsedMs) };
}

/**
 * Move-completion event: the side that just moved (`mover`) presses. Adds the Fischer
 * increment to the mover, then flips `side` to the opponent. Ignored if `mover` is not
 * the side on the move. The increment is NOT added if the mover is already flagged
 * (time at 0) — you cannot gain time after flagging.
 */
export function press(s: ClockState, mover: Side): ClockState {
  if (mover !== s.side) return s;
  const other: Side = mover === 'w' ? 'b' : 'w';
  if (mover === 'w') {
    const whiteMs = s.whiteMs > 0 ? s.whiteMs + s.incMs : s.whiteMs;
    return { ...s, whiteMs, side: other };
  }
  const blackMs = s.blackMs > 0 ? s.blackMs + s.incMs : s.blackMs;
  return { ...s, blackMs, side: other };
}

/** Returns the flagged side ('w'|'b') if its time is ≤ 0, else null. */
export function flagged(s: ClockState): Side | null {
  if (s.whiteMs <= 0) return 'w';
  if (s.blackMs <= 0) return 'b';
  return null;
}
