// Multi-day coach program (PR-18 coach-multiday, ADR-0076 — lifts the ADR-0045 deferral).
// The program builder already produces the full worst-first item list; this splits it across
// days within the daily budget and reads progress back from the PR-09 sessionLog (via the
// born-additive programId/day fields, ratified I8 — zero re-migration). Pure throughout.

import type { PlanItem } from '../analysis/studyPlan';
import type { CoachProfile } from './types';
import type { SessionLogRecord } from '../store/db';

/** Stable id tying sessions to the assessment that produced the program. */
export function programIdOf(profile: CoachProfile): string {
  return `coach:${profile.assessedAt}`;
}

/**
 * Greedy day-fill: walk the program IN ORDER (worst-first is the whole point — day 1 gets the
 * biggest weakness) and open a new day when adding the item would exceed `budgetMin`. An item
 * longer than the budget still gets its own day (never dropped). At most `maxDays`; leftover
 * items spill into the LAST day rather than disappearing (honesty: the program is the program).
 */
export function splitProgramDays(items: PlanItem[], budgetMin: number, maxDays: number): PlanItem[][] {
  if (!items.length) return [];
  const days: PlanItem[][] = [[]];
  let used = 0;
  for (const item of items) {
    const cur = days[days.length - 1];
    if (cur.length && used + item.minutes > budgetMin && days.length < maxDays) {
      days.push([item]);
      used = item.minutes;
    } else {
      cur.push(item);
      used += item.minutes;
    }
  }
  return days;
}

/** Days attempted so far: a sessionLog with this programId and day counts as attempted
 *  (finishing the session IS the day — partial completion still moves you forward; the
 *  deprioritizeFocus mechanic (PR-09) re-surfaces what was skipped). */
export function attemptedDays(logs: SessionLogRecord[], programId: string): Set<number> {
  const out = new Set<number>();
  for (const l of logs) if (l.programId === programId && l.day != null) out.add(l.day);
  return out;
}

/** First unattempted day index, or null when every day was attempted (program complete). */
export function nextProgramDay(totalDays: number, attempted: Set<number>): number | null {
  for (let i = 0; i < totalDays; i++) if (!attempted.has(i)) return i;
  return null;
}
