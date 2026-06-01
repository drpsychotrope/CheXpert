// Study-plan generator (spec A / ADR-0027): turn the weakness fingerprint + the
// weakest radar dimension into a deterministic daily practice plan within a time
// budget. Worst-impact leaks first, mapped to the matching training activity. Pure,
// no Date (the UI stamps dates), no engine, no LLM.

import type { Leak } from './fingerprint';
import type { Dimension } from './weakness';

export interface PlanItem {
  activity: 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'vision';
  focus: string;
  minutes: number;
  reason: string;
}

function activityForLeak(leak: Leak): { activity: PlanItem['activity']; focus: string } {
  const m = leak.motif.toLowerCase();
  if (leak.key.startsWith('opening') || m.includes('opening')) return { activity: 'repertoire', focus: `opening: ${leak.motif}` };
  if (leak.key.startsWith('endgame') || leak.phase === 'endgame' || m.includes('endgame')) return { activity: 'endgames', focus: `endgame: ${leak.motif}` };
  return { activity: 'tactics', focus: leak.motif };
}

/** Build a single day's plan (≤ minutesPerDay), worst-impact leaks first. */
export function buildStudyPlan(leaks: Leak[], weakest: Dimension | null, minutesPerDay: number): PlanItem[] {
  const plan: PlanItem[] = [];
  let used = 0;

  const warmup = Math.min(3, minutesPerDay);
  if (warmup > 0) {
    plan.push({ activity: 'vision', focus: 'board vision', minutes: warmup, reason: 'Warm-up: spot all checks, captures, and hanging pieces.' });
    used += warmup;
  }

  if (weakest === 'resilience' && used < minutesPerDay) {
    const m = Math.min(10, minutesPerDay - used);
    plan.push({ activity: 'comeback', focus: 'defend & recover', minutes: m, reason: 'Resilience is your weakest dimension — practise holding worse positions.' });
    used += m;
  }

  for (const leak of leaks) {
    if (used >= minutesPerDay) break;
    const { activity, focus } = activityForLeak(leak);
    const m = Math.min(Math.max(5, Math.round(leak.count)), minutesPerDay - used);
    if (m <= 0) break;
    plan.push({ activity, focus, minutes: m, reason: `${leak.count}× (avg −${Math.round(leak.avgWpl)}% win) — drill this leak.` });
    used += m;
  }

  return plan;
}
