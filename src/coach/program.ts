// Coach program core (ADR-0045). PURE. Turns a CoachProfile into a worst-first,
// budgeted PlanItem[] routed to drills AND game modes. Deliberately does NOT call
// or mutate buildStudyPlan — Insights stays byte-identical (AP-COACH-1).

import type { PlanItem } from '../analysis/studyPlan';
import type { Leak } from '../analysis/fingerprint';
import type { CoachProfile } from './types';

const WEAKNESS_DELTA = -40;
const WEAKNESS_DIM = 35;

/** Deterministic focus → IMBALANCE_LIBRARY id (ids exist in analysis/scenarios.ts). */
export function scenarioForFocus(focus: string): string {
  const f = focus.toLowerCase();
  if (f.includes('endgame') || f.includes('rook')) return 'rook-up';
  if (f.includes('castl') || f.includes('attack') || f.includes('resilien')) return 'opp-castle';
  return 'iqp';
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

export function buildCoachProgram(profile: CoachProfile, minutes = 30): PlanItem[] {
  const plan: PlanItem[] = [];
  let used = 0;
  const take = (m: number) => Math.min(m, Math.max(0, minutes - used));

  // 1) Weak motifs → themed tactics (endgame motif → endgames). Worst-first.
  const weakMotifs = profile.motifs.filter((m) => m.delta <= WEAKNESS_DELTA).sort((a, b) => a.delta - b.delta);
  for (const m of weakMotifs) {
    const mins = take(8);
    if (mins <= 0) break;
    if (m.theme === 'endgame') {
      plan.push({ activity: 'endgames', focus: 'endgame conversion', minutes: mins, reason: `Endgame puzzles −${-m.delta} vs your baseline — drill conversion.` });
    } else {
      plan.push({ activity: 'tactics', focus: m.theme, minutes: mins, reason: `${m.theme} −${-m.delta} vs your baseline — drill the pattern.` });
    }
    used += mins;
  }

  // 2) Weak game dimensions → matching drill / game mode. Worst-first.
  const weakDims = profile.dimensions.filter((d) => d.sampleSize > 0 && d.score <= WEAKNESS_DIM).sort((a, b) => a.score - b.score);
  for (const d of weakDims) {
    if (used >= minutes) break;
    if (d.dimension === 'endgameConversion') {
      const m = take(8); if (m > 0) { plan.push({ activity: 'endgames', focus: 'endgame conversion', minutes: m, reason: `Endgame conversion is a weak spot (score ${d.score}).` }); used += m; }
    } else if (d.dimension === 'openingAccuracy') {
      const m1 = take(6); if (m1 > 0) { plan.push({ activity: 'repertoire', focus: 'opening lines', minutes: m1, reason: `Opening accuracy is a weak spot (score ${d.score}).` }); used += m1; }
      const m2 = take(8); if (m2 > 0) { plan.push({ activity: 'play-steered', focus: 'openingAccuracy', minutes: m2, reason: 'Play a game where the bot steers into your opening gap.' }); used += m2; }
    } else if (d.dimension === 'timeManagement') {
      const m = take(6); if (m > 0) { plan.push({ activity: 'tactics', focus: 'time', minutes: m, reason: `Time management is a weak spot (score ${d.score}) — solve under a clock.` }); used += m; }
    } else if (d.dimension === 'resilience') {
      const m = take(8); if (m > 0) { plan.push({ activity: 'comeback', focus: 'defend & recover', minutes: m, reason: `Resilience is a weak spot (score ${d.score}) — practise worse positions.` }); used += m; }
    }
    // 'tactics' dim intentionally skipped — covered by per-motif steps.
  }

  // 3) Nothing flagged → light maintenance.
  if (plan.length === 0) {
    plan.push({ activity: 'tactics', focus: 'mixed', minutes: Math.min(10, minutes), reason: 'No clear weakness surfaced — keep your pattern recognition sharp.' });
  }
  return plan;
}
