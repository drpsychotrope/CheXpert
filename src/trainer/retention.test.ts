import { describe, it, expect } from 'vitest';
import { rollStreak, goalProgress, localDayKey, DEFAULT_DAILY_GOAL } from './retention';

// Deterministic day boundaries via an injected dayKey: map an epoch "day index" (ms / 1 day)
// to a stable YYYY-MM-DD-like key so we never touch the real Date in assertions.
const DAY = 86_400_000;
const keyOf = (ms: number) => `D${Math.floor(ms / DAY)}`;

describe('rollStreak (T3/TR8, Q-C — day-based streak, injected dayKey)', () => {
  it('no prior → streak 1, isNewDay true', () => {
    expect(rollStreak(undefined, 5 * DAY, keyOf)).toEqual({ dailyStreak: 1, lastTrainedAt: 5 * DAY, isNewDay: true });
  });

  it('a zeroed prior (fresh model, streak 0) → streak 1, isNewDay true', () => {
    expect(rollStreak({ dailyStreak: 0, lastTrainedAt: 0 }, 5 * DAY, keyOf)).toEqual({
      dailyStreak: 1,
      lastTrainedAt: 5 * DAY,
      isNewDay: true,
    });
  });

  it('same calendar day (two events) → streak unchanged, isNewDay false (no double-count, AP-TINTEG-5)', () => {
    const prev = { dailyStreak: 3, lastTrainedAt: 10 * DAY + 1000 };
    const r = rollStreak(prev, 10 * DAY + 50_000, keyOf); // later, same day index
    expect(r.dailyStreak).toBe(3);
    expect(r.isNewDay).toBe(false);
    expect(r.lastTrainedAt).toBe(10 * DAY + 50_000);
  });

  it('exactly the next day → streak + 1, isNewDay true', () => {
    const prev = { dailyStreak: 3, lastTrainedAt: 10 * DAY + 1000 };
    const r = rollStreak(prev, 11 * DAY + 1000, keyOf);
    expect(r.dailyStreak).toBe(4);
    expect(r.isNewDay).toBe(true);
  });

  it('a gap of > 1 day resets to 1', () => {
    const prev = { dailyStreak: 7, lastTrainedAt: 10 * DAY };
    expect(rollStreak(prev, 13 * DAY, keyOf).dailyStreak).toBe(1);
    expect(rollStreak(prev, 13 * DAY, keyOf).isNewDay).toBe(true);
  });

  it('midnight boundary: 23:59 then 00:01 next day → +1 (different dayKey, even though < 24h)', () => {
    // Use the REAL localDayKey to prove the calendar-day delta logic, not a 24h window.
    const base = new Date(2026, 5, 30, 23, 59, 0).getTime(); // 30 Jun 2026 23:59 local
    const justAfterMidnight = new Date(2026, 6, 1, 0, 1, 0).getTime(); // 1 Jul 2026 00:01 local
    expect(localDayKey(base)).not.toBe(localDayKey(justAfterMidnight));
    const prev = { dailyStreak: 2, lastTrainedAt: base };
    const r = rollStreak(prev, justAfterMidnight, localDayKey);
    expect(r.dailyStreak).toBe(3);
    expect(r.isNewDay).toBe(true);
  });

  it('25h apart but same calendar date is NOT a new day (delta from midnight, not elapsed time)', () => {
    // 1 Jul 00:30 then 2 Jul 01:30 = different dates → +1 (proves we key on the date, not 24h).
    const a = new Date(2026, 6, 1, 0, 30, 0).getTime();
    const b = new Date(2026, 6, 2, 1, 30, 0).getTime();
    const r = rollStreak({ dailyStreak: 1, lastTrainedAt: a }, b, localDayKey);
    expect(r.dailyStreak).toBe(2); // adjacent calendar days
  });
});

describe('goalProgress (T3/TR8, Q-E — solved-today vs goal)', () => {
  it('below goal → met false, done/goal echoed', () => {
    expect(goalProgress(3, 10)).toEqual({ done: 3, goal: 10, met: false });
  });
  it('at goal → met true', () => {
    expect(goalProgress(10, 10).met).toBe(true);
  });
  it('over goal → met true (done not clamped to goal)', () => {
    expect(goalProgress(12, 10)).toEqual({ done: 12, goal: 10, met: true });
  });
  it('defaults the goal to 10 when omitted or non-positive', () => {
    expect(goalProgress(5).goal).toBe(DEFAULT_DAILY_GOAL);
    expect(goalProgress(5, 0).goal).toBe(DEFAULT_DAILY_GOAL);
    expect(goalProgress(5, -3).goal).toBe(DEFAULT_DAILY_GOAL);
  });
  it('clamps a negative count to 0', () => {
    expect(goalProgress(-2, 10).done).toBe(0);
  });
});
