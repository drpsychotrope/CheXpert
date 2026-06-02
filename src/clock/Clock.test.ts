import { describe, it, expect } from 'vitest';
import { initClock, tick, press, flagged, startClock, stopClock } from './Clock';

describe('Clock pure core', () => {
  it('initClock sets both sides, the increment, the side on move, and running=false', () => {
    const s = initClock(60_000, 0, 'w');
    expect(s).toEqual({ whiteMs: 60_000, blackMs: 60_000, incMs: 0, side: 'w', running: false });
  });

  it('initClock defaults the side to white', () => {
    expect(initClock(180_000, 2_000).side).toBe('w');
  });

  it('startClock / stopClock toggle running and return a new object', () => {
    const s = initClock(60_000, 0);
    const started = startClock(s);
    expect(started.running).toBe(true);
    expect(started).not.toBe(s);
    expect(stopClock(started).running).toBe(false);
  });

  it('tick decrements ONLY the running side', () => {
    const s = startClock(initClock(60_000, 0, 'w'));
    const after = tick(s, 1_000);
    expect(after.whiteMs).toBe(59_000);
    expect(after.blackMs).toBe(60_000);
  });

  it('tick decrements black when black is on the move', () => {
    const s = startClock({ ...initClock(60_000, 0, 'b') });
    const after = tick(s, 2_500);
    expect(after.blackMs).toBe(57_500);
    expect(after.whiteMs).toBe(60_000);
  });

  it('tick clamps at 0 (never negative)', () => {
    const s = startClock(initClock(1_000, 0, 'w'));
    const after = tick(s, 5_000);
    expect(after.whiteMs).toBe(0);
  });

  it('tick is a no-op when not running', () => {
    const s = initClock(60_000, 0, 'w');
    expect(tick(s, 1_000)).toEqual(s);
  });

  it('press adds the Fischer increment to the mover and flips the side', () => {
    const s = startClock(initClock(180_000, 2_000, 'w'));
    const after = press(s, 'w');
    expect(after.whiteMs).toBe(182_000);
    expect(after.side).toBe('b');
  });

  it('press adds 0 when the increment is 0 (bullet 1+0)', () => {
    const s = startClock(initClock(60_000, 0, 'w'));
    const after = press(s, 'w');
    expect(after.whiteMs).toBe(60_000);
    expect(after.side).toBe('b');
  });

  it('press is ignored when the mover is not the side on the move', () => {
    const s = startClock(initClock(60_000, 2_000, 'w'));
    expect(press(s, 'b')).toEqual(s);
  });

  it('press does NOT add the increment if the mover is already flagged (time at 0)', () => {
    const s = startClock({ whiteMs: 0, blackMs: 60_000, incMs: 2_000, side: 'w', running: true });
    const after = press(s, 'w');
    expect(after.whiteMs).toBe(0);
    expect(after.side).toBe('b');
  });

  it('flagged returns the side at or below 0, else null', () => {
    expect(flagged(initClock(60_000, 0, 'w'))).toBeNull();
    expect(flagged({ whiteMs: 0, blackMs: 5_000, incMs: 0, side: 'w', running: true })).toBe('w');
    expect(flagged({ whiteMs: 5_000, blackMs: 0, incMs: 0, side: 'b', running: true })).toBe('b');
  });

  it('all transitions return a new object (immutability)', () => {
    const s = startClock(initClock(60_000, 1_000, 'w'));
    expect(tick(s, 100)).not.toBe(s);
    expect(press(s, 'w')).not.toBe(s);
  });

  it('determinism: identical inputs produce identical state', () => {
    const a = press(tick(startClock(initClock(60_000, 1_000, 'w')), 1_234), 'w');
    const b = press(tick(startClock(initClock(60_000, 1_000, 'w')), 1_234), 'w');
    expect(a).toEqual(b);
  });

  it('sequence: bullet 1+0, white burns all time, flags white', () => {
    let s = startClock(initClock(60_000, 0, 'w'));
    s = tick(s, 30_000); // white -> 30s
    s = press(s, 'w');   // flip to black
    s = tick(s, 10_000); // black -> 50s
    s = press(s, 'b');   // flip to white
    s = tick(s, 40_000); // white 30 -> 0, flags
    expect(flagged(s)).toBe('w');
  });
});
