import { describe, it, expect } from 'vitest';
import { buildCoachProgram, profileToLeaks, scenarioForFocus, applyGoalWeighting, leverageStepFor, GOAL_PLAN } from './program';
import type { CoachProfile, CoachGoal } from './types';
import type { PlanItem } from '../analysis/studyPlan';
import { buildSession } from '../analysis/session';
import type { DimensionScore } from '../analysis/weakness';

const item = (over: Partial<PlanItem> = {}): PlanItem => ({ activity: 'tactics', focus: 'fork', minutes: 8, reason: 'r', ...over });

const dim = (dimension: DimensionScore['dimension'], score: number, sampleSize = 6): DimensionScore => ({ dimension, score, detail: 'x', sampleSize });

function profile(over: Partial<CoachProfile> = {}): CoachProfile {
  return {
    assessedAt: 1, puzzleRating: 1200, motifs: [], dimensions: [], strengths: [], weaknesses: [],
    source: { ladders: true, game: false }, gameAnalyzed: false, ...over,
  };
}

describe('scenarioForFocus', () => {
  it('maps focus to a stable IMBALANCE_LIBRARY id', () => {
    expect(scenarioForFocus('endgame conversion')).toBe('rook-up');
    expect(scenarioForFocus('opposite-side attack')).toBe('opp-castle');
    expect(scenarioForFocus('fork')).toBe('iqp');
  });
});

describe('buildCoachProgram routing', () => {
  it('routes weak motifs to themed tactics, worst-first', () => {
    const p = profile({ motifs: [
      { theme: 'pin', rating: 1100, baseline: 1200, delta: -100, n: 4 },
      { theme: 'fork', rating: 900, baseline: 1200, delta: -300, n: 4 },
    ] });
    const plan = buildCoachProgram(p, 30);
    expect(plan[0]).toMatchObject({ activity: 'tactics', focus: 'fork' }); // worst first
    expect(plan[1]).toMatchObject({ activity: 'tactics', focus: 'pin' });
  });

  it('routes the endgame motif to endgames', () => {
    const p = profile({ motifs: [{ theme: 'endgame', rating: 1000, baseline: 1200, delta: -200, n: 4 }] });
    expect(buildCoachProgram(p, 30)[0]).toMatchObject({ activity: 'endgames' });
  });

  it('routes weak game dimensions to drills AND game modes', () => {
    const p = profile({ dimensions: [
      dim('openingAccuracy', 25), dim('timeManagement', 20), dim('resilience', 15), dim('endgameConversion', 30),
    ] });
    const acts = buildCoachProgram(p, 60).map((s) => `${s.activity}:${s.focus}`);
    expect(acts).toContain('repertoire:opening lines');
    expect(acts).toContain('play-steered:openingAccuracy');
    expect(acts).toContain('tactics:time');         // timeManagement → timed tactics
    expect(acts).toContain('comeback:defend & recover');
    expect(acts).toContain('endgames:endgame conversion');
  });

  it('respects the minute budget', () => {
    const p = profile({ motifs: [
      { theme: 'fork', rating: 900, baseline: 1200, delta: -300, n: 4 },
      { theme: 'pin', rating: 950, baseline: 1200, delta: -250, n: 4 },
      { theme: 'skewer', rating: 980, baseline: 1200, delta: -220, n: 4 },
    ] });
    const total = buildCoachProgram(p, 10).reduce((s, i) => s + i.minutes, 0);
    expect(total).toBeLessThanOrEqual(10);
  });

  it('falls back to a maintenance step when nothing is weak', () => {
    const plan = buildCoachProgram(profile(), 30);
    expect(plan).toHaveLength(1);
    expect(plan[0].activity).toBe('tactics');
  });
});

describe('profileToLeaks', () => {
  it('emits one worst-first leak per weak motif, no fens', () => {
    const p = profile({ motifs: [
      { theme: 'pin', rating: 1150, baseline: 1200, delta: -50, n: 4 },
      { theme: 'fork', rating: 900, baseline: 1200, delta: -300, n: 4 },
    ] });
    const leaks = profileToLeaks(p);
    expect(leaks.map((l) => l.key)).toEqual(['fork', 'pin']);
    expect(leaks[0].sampleFens).toEqual([]);
  });
});

// ── C5 soft goal weighting (applyGoalWeighting) ──────────────────────────────
describe('applyGoalWeighting (C5/Q-B)', () => {
  const basePlan: PlanItem[] = [
    item({ activity: 'tactics', focus: 'fork' }),
    item({ activity: 'tactics', focus: 'time' }),
    item({ activity: 'comeback', focus: 'defend & recover' }),
  ];

  it('goal === undefined → the SAME plan, unchanged (legacy byte-identical, E4/AP-CINTAKE-5)', () => {
    const out = applyGoalWeighting(basePlan, undefined, profile(), 30, 'en');
    expect(out).toBe(basePlan); // reference identity — total, no copy on the legacy path
    expect(out).toEqual(basePlan);
  });

  it('unknown goal value → unchanged (total)', () => {
    const out = applyGoalWeighting(basePlan, 'no-such-goal' as CoachGoal, profile(), 30, 'en');
    expect(out).toBe(basePlan);
  });

  it("time-trouble floats the focus:'time' step to index 0 (stable for the rest)", () => {
    const out = applyGoalWeighting(basePlan, 'time-trouble', profile(), 30, 'en');
    expect(out[0]).toMatchObject({ activity: 'tactics', focus: 'time' });
    // the remaining steps keep their original relative order
    expect(out.slice(1).map((p) => p.focus)).toEqual(['fork', 'defend & recover']);
    expect(out).toHaveLength(basePlan.length); // a re-order never changes length
  });

  it('opening-prep ensures a repertoire + play-steered pair, tagged kind:goal, without duplicating an existing one', () => {
    // plan already has the repertoire step → only the steered step is appended.
    const withRep: PlanItem[] = [item({ activity: 'repertoire', focus: 'opening lines', minutes: 6 })];
    const out = applyGoalWeighting(withRep, 'opening-prep', profile(), 60, 'en');
    const reps = out.filter((p) => p.activity === 'repertoire' && p.focus === 'opening lines');
    expect(reps).toHaveLength(1); // not duplicated
    const steered = out.filter((p) => p.activity === 'play-steered' && p.focus === 'openingAccuracy');
    expect(steered).toHaveLength(1);
    expect(steered[0].kind).toBe('goal');

    // a plan with neither → BOTH appended as goal steps.
    const out2 = applyGoalWeighting([item({ activity: 'tactics', focus: 'fork' })], 'opening-prep', profile(), 60, 'en');
    expect(out2.some((p) => p.activity === 'repertoire' && p.kind === 'goal')).toBe(true);
    expect(out2.some((p) => p.activity === 'play-steered' && p.kind === 'goal')).toBe(true);
  });

  it('is idempotent: applying twice equals applying once', () => {
    const once = applyGoalWeighting(basePlan, 'opening-prep', profile(), 60, 'en');
    const twice = applyGoalWeighting(once, 'opening-prep', profile(), 60, 'en');
    expect(twice).toEqual(once);
    const onceT = applyGoalWeighting(basePlan, 'time-trouble', profile(), 30, 'en');
    expect(applyGoalWeighting(onceT, 'time-trouble', profile(), 30, 'en')).toEqual(onceT);
  });

  it('invariant: out.length >= in.length and the weakness-step SET is preserved (AP-CINTAKE-5)', () => {
    for (const g of Object.keys(GOAL_PLAN) as CoachGoal[]) {
      const out = applyGoalWeighting(basePlan, g, profile(), 60, 'en');
      expect(out.length).toBeGreaterThanOrEqual(basePlan.length);
      // every original step still present (no drop, no swap of identity)
      for (const orig of basePlan) {
        expect(out.some((p) => p.activity === orig.activity && p.focus === orig.focus)).toBe(true);
      }
    }
  });

  it('does not exceed the minute budget when appending ensured steps', () => {
    // tiny budget already spent → no room to append the opening-prep pair.
    const full: PlanItem[] = [item({ activity: 'tactics', focus: 'fork', minutes: 10 })];
    const out = applyGoalWeighting(full, 'opening-prep', profile(), 10, 'en');
    expect(out).toEqual(full); // budget exhausted ⇒ nothing added
  });
});

// ── C5 strength leverage (leverageStepFor) ───────────────────────────────────
describe('leverageStepFor (C5/Q-D/CO18)', () => {
  it('returns null when there are no strengths', () => {
    expect(leverageStepFor(profile({ strengths: [] }), 30, 0, 'en')).toBeNull();
  });

  it('returns null when no budget remains', () => {
    expect(leverageStepFor(profile({ strengths: ['Forks'] }), 30, 30, 'en')).toBeNull();
  });

  it('maps a tactics strength to ONE attacking steered step (tagged leverage, valid scenario id)', () => {
    const step = leverageStepFor(profile({ strengths: ['Forks'] }), 30, 0, 'en');
    expect(step).not.toBeNull();
    expect(step!.kind).toBe('leverage');
    expect(step!.activity).toBe('play-steered');
    expect(step!.focus).toBe(scenarioForFocus('attack')); // reuses scenarioForFocus (E5)
  });

  it('maps an endgame strength to an endgames maintenance step', () => {
    const step = leverageStepFor(profile({ strengths: ['Endgames'] }), 30, 0, 'en');
    expect(step!.activity).toBe('endgames');
    expect(step!.kind).toBe('leverage');
  });
});

// ── C5 end-to-end through buildCoachProgram + buildSession ────────────────────
describe('buildCoachProgram with goal + leverage (C5)', () => {
  it('a no-strength profile with goal undefined is byte-identical to the 3-arg call', () => {
    const p = profile({ motifs: [{ theme: 'fork', rating: 900, baseline: 1200, delta: -300, n: 4 }] });
    expect(buildCoachProgram(p, 30, 'en', undefined)).toEqual(buildCoachProgram(p, 30, 'en'));
  });

  it('appends ONE leverage step when a strength exists, and goal/leverage steps survive buildSession', () => {
    const p = profile({
      motifs: [{ theme: 'pin', rating: 900, baseline: 1200, delta: -300, n: 4 }],
      strengths: ['Forks'],
    });
    const plan = buildCoachProgram(p, 60, 'en', 'opening-prep');
    const leverage = plan.filter((s) => s.kind === 'leverage');
    const goalSteps = plan.filter((s) => s.kind === 'goal');
    expect(leverage).toHaveLength(1);            // capped at one (Q-D)
    expect(goalSteps.length).toBeGreaterThan(0); // opening-prep ensured at least one step
    // The tagged steps survive the session wrapper (it reads activity/focus, ignores kind).
    const session = buildSession(plan);
    // one SessionStep per PlanItem + review + reflection
    expect(session.steps.length).toBe(plan.length + 2);
    expect(session.steps.some((s) => s.kind === 'play-steered')).toBe(true);
  });
});
