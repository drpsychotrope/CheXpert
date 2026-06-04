import { describe, it, expect } from 'vitest';
import { buildCoachProgram, profileToLeaks, scenarioForFocus } from './program';
import type { CoachProfile } from './types';
import type { DimensionScore } from '../analysis/weakness';

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
