// Study-plan generator (spec A / ADR-0027): turn the weakness fingerprint + the
// weakest radar dimension into a deterministic daily practice plan within a time
// budget. Worst-impact leaks first, mapped to the matching training activity. Pure,
// no Date (the UI stamps dates), no engine, no LLM.

import { leakTarget, type Leak } from './fingerprint';
import type { Dimension } from './weakness';
import { gt } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

/** Mastery criterion for a coach step (C7/CO16). Optional: study-plan items omit it
 *  (Insights stays time-boxed); coach items carry it. The step is done when the
 *  criterion is met OR `minutes` (the cap) elapses — whichever first (Q-B / AP-CPROG-2/3). */
export interface MasteryCriterion {
  kind: 'streak' | 'missRate';   // "N correct in a row" | "recent miss-rate below threshold"
  target: number;                // streak: N (e.g. 4); missRate: fraction 0..1 (e.g. 0.25)
  /** Stable routing/measurement key (motif key or 'endgame'); never translated (AP-CPROG-8). */
  motifKey?: string;
}

export interface PlanItem {
  activity: 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'vision' | 'sparring' | 'play-steered';
  focus: string;
  minutes: number;               // for coach steps this is the SAFETY CAP (C7/Q-B); study-plan steps keep it as the block length
  reason: string;
  /** Additive provenance tag (C5): a step added because the user has a clear STRENGTH (`'leverage'`)
   *  or because their intake GOAL asked for it (`'goal'`). Absent on every weakness/maintenance step
   *  AND on every `buildStudyPlan` item — so Insights output stays byte-identical (AP-CINTAKE-8). The
   *  UI uses it only to render a small tag; routing (`activity`/`focus`) is untouched. */
  kind?: 'leverage' | 'goal';
  /** Mastery criterion (C7/CO16) — coach-only, additive-optional. `buildStudyPlan` never sets it,
   *  so Insights output (and its snapshot) stays byte-identical (AP-CPROG-6). */
  mastery?: MasteryCriterion;
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
