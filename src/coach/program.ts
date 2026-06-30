// Coach program core (ADR-0045). PURE. Turns a CoachProfile into a worst-first,
// budgeted PlanItem[] routed to drills AND game modes. Deliberately does NOT call
// or mutate buildStudyPlan — Insights stays byte-identical (AP-COACH-1).
//
// V2-W18 (F3): the `reason` display strings are bilingual via an INJECTED `locale`.
// `activity`/`focus` are STABLE routing keys (focus feeds tacticsFilterThemes) — never translated.
// Fixes P3-19: the motif name in a reason now goes through the motif label, not the raw key.

import type { PlanItem } from '../analysis/studyPlan';
import type { Leak } from '../analysis/fingerprint';
import type { CoachProfile, CoachGoal } from './types';
import { gt } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

const WEAKNESS_DELTA = -40;
const WEAKNESS_DIM = 35;

/** Deterministic focus → IMBALANCE_LIBRARY id (ids exist in analysis/scenarios.ts). */
export function scenarioForFocus(focus: string): string {
  const f = focus.toLowerCase();
  if (f.includes('endgame') || f.includes('rook')) return 'rook-up';
  if (f.includes('castl') || f.includes('attack') || f.includes('resilien')) return 'opp-castle';
  return 'iqp';
}

// ── C5 (CO3/Q-B): soft goal weighting ────────────────────────────────────────
// A deliberately THIN re-ordering pass layered AFTER the weakness-first builder (NOT a hard override —
// AP-CINTAKE-1; C7 supersedes it without a rewrite). Every goal's behaviour lives in this ONE table
// (the single source of truth — E6/AP-CINTAKE-2). A 5th goal = one new row here, nothing else.

/** One row per goal. `floatFocus`: lift any step whose `focus` matches to the front (stable).
 *  `floatWeakestMotif`: lift the weakest scored motif's tactics step (dynamic — derived from profile).
 *  `ensure`: append these steps (tagged `kind:'goal'`) iff absent AND budget remains. */
interface GoalRule {
  floatFocus?: string;
  floatWeakestMotif?: true;
  ensure?: Array<Pick<PlanItem, 'activity' | 'focus' | 'minutes'> & { reasonKey: string }>;
}

export const GOAL_PLAN: Record<CoachGoal, GoalRule> = {
  // No reweight — today's weakness-first plan already serves "I just want to get stronger".
  'target-rating': {},
  // The metacog line (coaching.ts) is the PRIMARY lever (surfaced by the UI); we also float the
  // single worst motif's drill to the top so the most error-prone pattern leads.
  'fix-blunders': { floatWeakestMotif: true },
  // Ensure a repertoire + steered-game pair leads the opening work.
  'opening-prep': {
    ensure: [
      { activity: 'repertoire', focus: 'opening lines', minutes: 6, reasonKey: 'program.goalOpening' },
      { activity: 'play-steered', focus: 'openingAccuracy', minutes: 8, reasonKey: 'program.goalOpeningSteer' },
    ],
  },
  // Float the time-pressure tactics step (focus:'time') to the very top.
  'time-trouble': { floatFocus: 'time' },
};

/** The weakest scored motif's theme (the `focus` of its tactics step), or null. Pure read of profile. */
function weakestMotifFocus(profile: CoachProfile): string | null {
  const weak = profile.motifs
    .filter((m) => m.delta <= WEAKNESS_DELTA && m.theme !== 'endgame')
    .sort((a, b) => a.delta - b.delta);
  return weak.length ? weak[0].theme : null;
}

/**
 * Soft goal weighting (Q-B). TOTAL & IDEMPOTENT (E4/AP-CINTAKE-5):
 *  - `goal === undefined` or an unknown value → return `plan` UNCHANGED (legacy/byte-identical path).
 *  - else: a STABLE re-order that floats the goal's affinity step(s) to the front (never drops or
 *    duplicates a step — the weakness-step set is preserved), then APPENDS the goal's `ensure` steps
 *    only when absent AND budget remains. Invariant `out.length >= plan.length`. Running it twice is a
 *    no-op (stable sort is idempotent; `ensure` skips already-present steps).
 */
export function applyGoalWeighting(
  plan: PlanItem[],
  goal: CoachGoal | undefined,
  profile: CoachProfile,
  minutes: number,
  locale: Locale,
): PlanItem[] {
  const rule = goal ? GOAL_PLAN[goal] : undefined;
  if (!rule) return plan; // undefined / unknown goal ⇒ unchanged (total, AP-CINTAKE-5)

  // Resolve the focus to float (static literal, or the dynamic weakest motif).
  const floatFocus = rule.floatWeakestMotif ? weakestMotifFocus(profile) : rule.floatFocus;

  // 1) Stable re-order: matching-focus steps first, everything else in its original order.
  let out = plan;
  if (floatFocus) {
    const matches = plan.filter((p) => p.focus === floatFocus);
    if (matches.length && matches.length < plan.length) {
      out = [...matches, ...plan.filter((p) => p.focus !== floatFocus)];
    }
  }

  // 2) Append ensured steps (tagged kind:'goal') only if absent AND budget remains.
  if (rule.ensure) {
    out = out === plan ? [...plan] : out; // copy before pushing if we haven't already
    let used = out.reduce((s, p) => s + p.minutes, 0);
    for (const e of rule.ensure) {
      const present = out.some((p) => p.activity === e.activity && p.focus === e.focus);
      const room = Math.min(e.minutes, Math.max(0, minutes - used));
      if (!present && room > 0) {
        out.push({ activity: e.activity, focus: e.focus, minutes: room, reason: gt(e.reasonKey, locale), kind: 'goal' });
        used += room;
      }
    }
  }

  return out;
}

/**
 * ONE optional strength-leverage step (Q-D/CO18) — so a clear strength stops being a dead checkmark.
 * Returns `null` when there is no strength to leverage OR no budget remains. Else maps the TOP strength
 * to a single step, REUSING `scenarioForFocus` for the scenario id. Tagged `kind:'leverage'`. The
 * mapping keys off the strength label (the same display labels diagnostic.ts emits): strong tactics →
 * an attacking steered game; strong endgame → endgame maintenance; anything else → sparring.
 */
export function leverageStepFor(
  profile: CoachProfile,
  minutes: number,
  used: number,
  locale: Locale,
): PlanItem | null {
  const room = Math.min(8, Math.max(0, minutes - used));
  if (profile.strengths.length === 0 || room <= 0) return null;

  const top = profile.strengths[0];
  const t = top.toLowerCase();
  // Endgame strength → maintain it with endgames; tactics/attacking strength → an attacking steered
  // game; otherwise sparring. scenarioForFocus is reused so the routing id stays consistent (E5).
  if (t.includes('endgame') || t.includes('finale') || t.includes('conversion')) {
    return { activity: 'endgames', focus: 'endgame maintenance', minutes: room, reason: gt('program.leverageEndgame', locale, { strength: top }), kind: 'leverage' };
  }
  if (t.includes('résilien') || t.includes('resilien')) {
    return { activity: 'sparring', focus: scenarioForFocus('resilience'), minutes: room, reason: gt('program.leverageResilience', locale, { strength: top }), kind: 'leverage' };
  }
  // Default: a sharp tactical/positional strength → play it (attacking steered game).
  return { activity: 'play-steered', focus: scenarioForFocus('attack'), minutes: room, reason: gt('program.leverageTactics', locale, { strength: top }), kind: 'leverage' };
}

/** Synthesize ranked pseudo-leaks (weak motifs, worst-first) — for callers that want the leak shape. */
export function profileToLeaks(profile: CoachProfile): Leak[] {
  return profile.motifs
    .filter((m) => m.delta <= WEAKNESS_DELTA)
    .sort((a, b) => a.delta - b.delta)
    .map((m) => ({
      key: m.theme,
      motif: m.theme,
      phase: m.theme === 'endgame' ? 'endgame' : 'middlegame',
      count: Math.max(1, Math.round(-m.delta / 50)),
      avgWpl: Math.min(100, -m.delta / 5),
      sampleFens: [],
      severity: { mistake: 1, blunder: 0 },
    }));
}

export function buildCoachProgram(
  profile: CoachProfile,
  minutes = 30,
  locale: Locale = 'fr',
  goal?: CoachGoal,
): PlanItem[] {
  const plan: PlanItem[] = [];
  let used = 0;
  const take = (m: number) => Math.min(m, Math.max(0, minutes - used));

  // 1) Weak motifs → themed tactics (endgame motif → endgames). Worst-first.
  const weakMotifs = profile.motifs.filter((m) => m.delta <= WEAKNESS_DELTA).sort((a, b) => a.delta - b.delta);
  for (const m of weakMotifs) {
    const mins = take(8);
    if (mins <= 0) break;
    if (m.theme === 'endgame') {
      plan.push({ activity: 'endgames', focus: 'endgame conversion', minutes: mins, reason: gt('program.endgameDrill', locale, { delta: -m.delta }) });
    } else {
      plan.push({
        activity: 'tactics',
        focus: m.theme,
        minutes: mins,
        reason: gt('program.motifDrill', locale, { motif: gt('motif.' + m.theme, locale), delta: -m.delta }),
      });
    }
    used += mins;
  }

  // 2) Weak game dimensions → matching drill / game mode. Worst-first.
  const weakDims = profile.dimensions.filter((d) => d.sampleSize > 0 && d.score <= WEAKNESS_DIM).sort((a, b) => a.score - b.score);
  for (const d of weakDims) {
    if (used >= minutes) break;
    if (d.dimension === 'endgameConversion') {
      const m = take(8); if (m > 0) { plan.push({ activity: 'endgames', focus: 'endgame conversion', minutes: m, reason: gt('program.endgameConversion', locale, { score: d.score }) }); used += m; }
    } else if (d.dimension === 'openingAccuracy') {
      const m1 = take(6); if (m1 > 0) { plan.push({ activity: 'repertoire', focus: 'opening lines', minutes: m1, reason: gt('program.openingAccuracy', locale, { score: d.score }) }); used += m1; }
      const m2 = take(8); if (m2 > 0) { plan.push({ activity: 'play-steered', focus: 'openingAccuracy', minutes: m2, reason: gt('program.openingSteer', locale) }); used += m2; }
    } else if (d.dimension === 'timeManagement') {
      const m = take(6); if (m > 0) { plan.push({ activity: 'tactics', focus: 'time', minutes: m, reason: gt('program.timeManagement', locale, { score: d.score }) }); used += m; }
    } else if (d.dimension === 'resilience') {
      const m = take(8); if (m > 0) { plan.push({ activity: 'comeback', focus: 'defend & recover', minutes: m, reason: gt('program.resilience', locale, { score: d.score }) }); used += m; }
    }
    // 'tactics' dim intentionally skipped — covered by per-motif steps.
  }

  // 3) Nothing flagged → light maintenance.
  if (plan.length === 0) {
    const m = Math.min(10, minutes);
    plan.push({ activity: 'tactics', focus: 'mixed', minutes: m, reason: gt('program.maintenance', locale) });
    used += m;
  }

  // 4) C5/CO18: ONE optional strength-leverage step when a clear strength exists & budget remains —
  //    strengths stop being a dead checkmark. Null (no strength / no budget) ⇒ nothing appended, so a
  //    no-strength profile (every legacy test fixture) stays byte-identical (Q-D/AP-CINTAKE-1).
  const lev = leverageStepFor(profile, minutes, used, locale);
  if (lev) plan.push(lev);

  // 5) C5/CO3 (Q-B): soft goal weighting, layered AFTER the weakness-first plan. `goal === undefined`
  //    ⇒ unchanged (legacy 3-arg byte-identical — E4/AP-CINTAKE-5). Never a hard override.
  return applyGoalWeighting(plan, goal, profile, minutes, locale);
}
