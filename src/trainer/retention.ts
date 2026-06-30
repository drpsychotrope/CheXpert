// Day-based training streak + daily-goal progress (T3, TR8 / Q-C, Q-E). PURE —
// no Date, no Math.random. The caller injects `now` (epoch ms); the day boundary is a
// LOCAL calendar day computed by an injected `dayKey(ms) -> string` (default: local
// YYYY-MM-DD) so the rollover is deterministic under test (AP-TINTEG-5/9).
//
// The persisted field is `dailyStreak` (never the bare `streak`, which is Vision's in-drill
// counter — AP-TINTEG-4). The streak increments at most ONCE per new calendar day: a
// multi-session same day does not double-count; a gap of >1 day resets to 1.

/** Local-calendar-day key (YYYY-MM-DD) for an epoch ms. Default `dayKey` for rollStreak. */
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface RetentionState {
  dailyStreak: number;
  lastTrainedAt: number;
}

export interface RetentionUpdate {
  dailyStreak: number;
  lastTrainedAt: number;
  /** True when `now` falls on a different calendar day than the stored lastTrainedAt
   *  (or there was no prior) — i.e. the streak value changed this event. */
  isNewDay: boolean;
}

/**
 * Fold one training event at `now` into the streak:
 *   - same calendar day as lastTrainedAt → streak unchanged, isNewDay = false
 *   - exactly the next calendar day      → streak + 1, isNewDay = true
 *   - a gap of > 1 day (or no prior)     → streak = 1, isNewDay = true
 *
 * Adjacency is decided ONLY through the injected `dayKey` (never by parsing its output or by a
 * fixed 24h window): `prev` counts as "yesterday" iff its key equals the key of (now − 1 day).
 * So 23:59 → 00:01 the following day is +1 even though < 24h elapsed, and two events on
 * different calendar dates 25h apart still increment — the dayKey defines the day, robust to
 * DST and to any custom key format used in tests. Always returns lastTrainedAt = now.
 */
export function rollStreak(
  prev: RetentionState | undefined,
  now: number,
  dayKey: (ms: number) => string = localDayKey,
): RetentionUpdate {
  if (!prev || !prev.lastTrainedAt || prev.dailyStreak <= 0) {
    return { dailyStreak: 1, lastTrainedAt: now, isNewDay: true };
  }
  const prevKey = dayKey(prev.lastTrainedAt);
  const nowKey = dayKey(now);
  if (prevKey === nowKey) {
    // Same calendar day: streak unchanged (multi-session does not double-count).
    return { dailyStreak: prev.dailyStreak, lastTrainedAt: now, isNewDay: false };
  }
  // "Yesterday relative to now": bucket (now − 24h) with the same dayKey and compare. Stepping
  // back a day and re-keying handles month/year rollovers and DST without arithmetic on the key.
  const yesterdayKey = dayKey(now - 86_400_000);
  if (prevKey === yesterdayKey) {
    return { dailyStreak: prev.dailyStreak + 1, lastTrainedAt: now, isNewDay: true };
  }
  // Gap of > 1 day (or any non-adjacent / out-of-order key) → restart at 1.
  return { dailyStreak: 1, lastTrainedAt: now, isNewDay: true };
}

/** Default daily puzzle goal (Q-E = 10 puzzles, configurable). */
export const DEFAULT_DAILY_GOAL = 10;

/**
 * Daily progress label inputs: solved-today count vs goal (default 10). PURE; the count is
 * supplied by the caller (solves whose playedAt falls on today's dayKey). `met` is true once
 * the count reaches the goal. A goal ≤ 0 is treated as the default to avoid an "always met"
 * or divide-by-zero readout downstream.
 */
export function goalProgress(
  solvedToday: number,
  goal: number = DEFAULT_DAILY_GOAL,
): { done: number; goal: number; met: boolean } {
  const g = goal > 0 ? goal : DEFAULT_DAILY_GOAL;
  const done = Math.max(0, solvedToday);
  return { done, goal: g, met: done >= g };
}
