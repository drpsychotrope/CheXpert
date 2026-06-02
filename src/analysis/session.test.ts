import { describe, it, expect } from 'vitest';
import { buildSession } from './session';
import type { PlanItem } from './studyPlan';

const item = (activity: PlanItem['activity'], focus: string, minutes: number): PlanItem => ({
  activity, focus, minutes, reason: `${focus} reason`,
});

describe('buildSession', () => {
  it('maps each PlanItem to a same-kind step, preserving order, focus and reason', () => {
    const plan = [item('vision', 'board vision', 3), item('tactics', 'fork', 8), item('endgames', 'endgame: K+P', 6)];
    const { steps } = buildSession(plan, { includeReview: false });
    // vision, tactics, endgames, reflection
    expect(steps.map((s) => s.kind)).toEqual(['vision', 'tactics', 'endgames', 'reflection']);
    expect(steps[0].focus).toBe('board vision');
    expect(steps[1].reason).toBe('fork reason');
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it('derives tactics themes/timed from the focus the same way the UI does', () => {
    const plan = [item('tactics', 'fork', 8)];
    const timed = [item('tactics', 'time management', 8)];
    const s1 = buildSession(plan, { includeReview: false }).steps[0];
    const s2 = buildSession(timed, { includeReview: false }).steps[0];
    expect(s1.themes).toEqual(['fork']);
    expect(s1.timed).toBe(false);
    expect(s2.timed).toBe(true);
  });

  it('inserts a review step after the drills and before reflection iff includeReview', () => {
    const plan = [item('vision', 'board vision', 3), item('tactics', 'fork', 8)];
    const withReview = buildSession(plan, { includeReview: true });
    const kinds = withReview.steps.map((s) => s.kind);
    expect(kinds).toEqual(['vision', 'tactics', 'review', 'reflection']);
    const without = buildSession(plan, { includeReview: false });
    expect(without.steps.some((s) => s.kind === 'review')).toBe(false);
  });

  it('always ends on a reflection step and sums totalMinutes incl. reflection', () => {
    const plan = [item('tactics', 'fork', 8), item('endgames', 'endgame', 6)];
    const session = buildSession(plan, { includeReview: true, reviewMinutes: 5 });
    expect(session.steps[session.steps.length - 1].kind).toBe('reflection');
    // 8 + 6 + 5 (review) + 0.5 (reflection)
    expect(session.totalMinutes).toBeCloseTo(19.5, 5);
  });

  it('an empty plan yields a session with only the reflection step (length 1, no throw)', () => {
    const session = buildSession([], { includeReview: false });
    expect(session.steps).toHaveLength(1);
    expect(session.steps[0].kind).toBe('reflection');
  });

  it('is deterministic (no Date/random)', () => {
    const plan = [item('vision', 'board vision', 3), item('tactics', 'fork', 8)];
    expect(buildSession(plan, { includeReview: true })).toEqual(buildSession(plan, { includeReview: true }));
  });
});
