// Study-plan generator (spec A / ADR-0027): turn the weakness fingerprint + the
// weakest radar dimension into a deterministic daily practice plan within a time
// budget. Worst-impact leaks first, mapped to the matching training activity. Pure,
// no Date (the UI stamps dates), no engine, no LLM.

import { leakTarget, type Leak } from './fingerprint';
import type { Dimension } from './weakness';
import { gt } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

export interface PlanItem {
  activity: 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'vision' | 'sparring' | 'play-steered';
  focus: string;
  minutes: number;
  reason: string;
}

function activityForLeak(leak: Leak): { activity: PlanItem['activity']; focus: string } {
  switch (leakTarget(leak)) {
    case 'repertoire':
      return { activity: 'repertoire', focus: `opening: ${leak.motif}` };
    case 'endgames':
      return { activity: 'endgames', focus: `endgame: ${leak.motif}` };
    default:
      return { activity: 'tactics', focus: leak.motif };
  }
}

export interface StudyPlanOpts {
  /** Due vision squares (ADR-0043). When present, the warm-up becomes targeted recall. */
  visionWeakSquares?: string[];
  /** UI locale for the `reason` display strings (V2-W18). `focus`/`activity` stay English routing keys. */
  locale?: Locale;
}

/** Build a single day's plan (≤ minutesPerDay), worst-impact leaks first. */
export function buildStudyPlan(
  leaks: Leak[],
  weakest: Dimension | null,
  minutesPerDay: number,
  opts: StudyPlanOpts = {},
): PlanItem[] {
  const plan: PlanItem[] = [];
  let used = 0;
  const locale: Locale = opts.locale ?? 'fr';

  const warmup = Math.min(3, minutesPerDay);
  if (warmup > 0) {
    const weak = opts.visionWeakSquares ?? [];
    plan.push(
      weak.length
        ? { activity: 'vision', focus: 'targeted recall', minutes: warmup, reason: gt('studyPlan.warmupTargeted', locale, { n: weak.length }) }
        : { activity: 'vision', focus: 'board vision', minutes: warmup, reason: gt('studyPlan.warmupVision', locale) },
    );
    used += warmup;
  }

  if (weakest === 'resilience' && used < minutesPerDay) {
    const m = Math.min(10, minutesPerDay - used);
    plan.push({ activity: 'comeback', focus: 'defend & recover', minutes: m, reason: gt('studyPlan.resilience', locale) });
    used += m;
  }

  for (const leak of leaks) {
    if (used >= minutesPerDay) break;
    const { activity, focus } = activityForLeak(leak);
    const m = Math.min(Math.max(5, Math.round(leak.count)), minutesPerDay - used);
    if (m <= 0) break;
    plan.push({ activity, focus, minutes: m, reason: gt('studyPlan.leak', locale, { count: leak.count, wpl: Math.round(leak.avgWpl) }) });
    used += m;
  }

  return plan;
}
