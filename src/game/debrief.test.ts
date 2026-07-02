import { describe, it, expect } from 'vitest';
import { clockSummary, fmtDuration, avgSecPerMove, ratingDelta } from './debrief';
import type { PlyClockSnap } from './clockTrace';

describe('clockSummary (PR-03 — derived from the PR-02 %clk trace)', () => {
  it('splits spent time per side, accounting the Fischer increment as real thinking time', () => {
    // 60s + 2s inc. White spends 5s then 3s; Black spends 10s.
    const trace: PlyClockSnap[] = [
      { side: 'w', remainingMs: 57_000 }, // 60 − 5 + 2
      { side: 'b', remainingMs: 52_000 }, // 60 − 10 + 2
      { side: 'w', remainingMs: 56_000 }, // 57 − 3 + 2
    ];
    const s = clockSummary(trace, 60_000, 2_000, 'w')!;
    expect(s.playerSpentMs).toBe(8_000);
    expect(s.botSpentMs).toBe(10_000);
    expect(s.playerMoves).toBe(2);
    expect(s.botMoves).toBe(1);
  });

  it('returns null on an empty trace (untimed game — the card skips the row)', () => {
    expect(clockSummary([], 60_000, 0, 'w')).toBeNull();
  });

  it('clamps a negative derived spend to 0 (defensive against a desynced snapshot)', () => {
    // Remaining GREW without an increment explaining it → clamp, never negative.
    const s = clockSummary([{ side: 'w', remainingMs: 70_000 }], 60_000, 0, 'w')!;
    expect(s.playerSpentMs).toBe(0);
  });

  it('attributes sides correctly when the player is Black', () => {
    const trace: PlyClockSnap[] = [
      { side: 'w', remainingMs: 55_000 },
      { side: 'b', remainingMs: 58_000 },
    ];
    const s = clockSummary(trace, 60_000, 0, 'b')!;
    expect(s.playerSpentMs).toBe(2_000);
    expect(s.botSpentMs).toBe(5_000);
  });
});

describe('fmtDuration / avgSecPerMove / ratingDelta', () => {
  it('formats M:SS and clamps junk to 0:00', () => {
    expect(fmtDuration(252_000)).toBe('4:12');
    expect(fmtDuration(9_000)).toBe('0:09');
    expect(fmtDuration(-1)).toBe('0:00');
    expect(fmtDuration(Number.NaN)).toBe('0:00');
  });
  it('averages seconds per move (0 moves → 0)', () => {
    expect(avgSecPerMove(80_000, 10)).toBe(8);
    expect(avgSecPerMove(0, 0)).toBe(0);
  });
  it('signs the rating delta', () => {
    expect(ratingDelta(1500, 1512.4)).toBe('+12');
    expect(ratingDelta(1512, 1504)).toBe('-8');
    expect(ratingDelta(1500, 1500)).toBe('0');
  });
});
