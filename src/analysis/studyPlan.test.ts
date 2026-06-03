import { describe, it, expect } from 'vitest';
import { buildStudyPlan } from './studyPlan';
import type { Leak } from './fingerprint';

const leak = (motif: string, phase: Leak['phase'], count: number, avgWpl: number): Leak => ({
  key: motif, motif, phase, count, avgWpl, sampleFens: [], severity: { mistake: count, blunder: 0 },
});

describe('buildStudyPlan', () => {
  it('orders items by leak impact (worst first) and stays within the time budget', () => {
    const leaks = [leak('fork', 'middlegame', 5, 30), leak('endgameMistake', 'endgame', 2, 20)];
    const plan = buildStudyPlan(leaks, 'tactics', 30);
    const total = plan.reduce((s, i) => s + i.minutes, 0);
    expect(total).toBeLessThanOrEqual(30);
    // First non-warmup item targets the worst leak (fork).
    const drills = plan.filter((i) => i.activity !== 'vision');
    expect(drills[0].focus).toContain('fork');
  });

  it('maps leaks to the right activity', () => {
    const plan = buildStudyPlan(
      [leak('fork', 'middlegame', 3, 20), leak('openingMistake', 'opening', 3, 15), leak('endgameMistake', 'endgame', 3, 15)],
      'tactics', 60,
    );
    expect(plan.find((i) => i.focus.includes('fork'))?.activity).toBe('tactics');
    expect(plan.find((i) => i.focus.includes('opening'))?.activity).toBe('repertoire');
    expect(plan.find((i) => i.focus.includes('endgame'))?.activity).toBe('endgames');
  });

  it('includes a vision warm-up and routes resilience to comeback', () => {
    const plan = buildStudyPlan([], 'resilience', 30);
    expect(plan.some((i) => i.activity === 'vision')).toBe(true);
    expect(plan.some((i) => i.activity === 'comeback')).toBe(true);
  });

  it('is deterministic', () => {
    const leaks = [leak('fork', 'middlegame', 5, 30)];
    expect(buildStudyPlan(leaks, 'tactics', 30)).toEqual(buildStudyPlan(leaks, 'tactics', 30));
  });

  // ADR-0043: due vision squares retarget the warm-up.
  it('targets weak squares in the vision step when provided', () => {
    const plan = buildStudyPlan([], null, 30, { visionWeakSquares: ['a8', 'h1', 'e4'] });
    const vision = plan.find((i) => i.activity === 'vision')!;
    expect(vision.focus).toBe('targeted recall');
    expect(vision.reason).toContain('3 squares');
  });

  it('keeps the generic vision warm-up when no weak squares are given', () => {
    const vision = buildStudyPlan([], null, 30).find((i) => i.activity === 'vision')!;
    expect(vision.focus).toBe('board vision');
  });
});
