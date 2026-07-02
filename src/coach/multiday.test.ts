import { describe, it, expect } from 'vitest';
import { splitProgramDays, attemptedDays, nextProgramDay, programIdOf } from './multiday';
import type { PlanItem } from '../analysis/studyPlan';
import type { SessionLogRecord } from '../store/db';
import type { CoachProfile } from './types';

const item = (minutes: number, focus = 'x'): PlanItem => ({ activity: 'tactics', focus, minutes, reason: 'r' });
const log = (programId: string | undefined, day: number | undefined): SessionLogRecord => ({
  id: `s:${Math.abs(day ?? 9)}${programId ?? ''}`, startedAt: 1, endedAt: 2, budgetMin: 30, steps: [], programId, day,
});

describe('splitProgramDays (PR-18 — greedy, order preserved, nothing dropped)', () => {
  it('fills days within the budget, worst-first order intact', () => {
    const days = splitProgramDays([item(10, 'a'), item(10, 'b'), item(10, 'c'), item(10, 'd')], 25, 5);
    expect(days.map((d) => d.map((i) => i.focus))).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('an item longer than the budget still gets its own day; spill lands in the LAST day at maxDays', () => {
    expect(splitProgramDays([item(40, 'big')], 30, 3).length).toBe(1);
    const capped = splitProgramDays([item(20, 'a'), item(20, 'b'), item(20, 'c'), item(20, 'd')], 20, 2);
    expect(capped.length).toBe(2);
    expect(capped[1].map((i) => i.focus)).toEqual(['b', 'c', 'd']); // spilled, never dropped
  });
  it('empty program → no days', () => {
    expect(splitProgramDays([], 30, 3)).toEqual([]);
  });
});

describe('attemptedDays / nextProgramDay / programIdOf', () => {
  it('reads only THIS program\'s stamped logs (I8 fields) and finds the first gap', () => {
    const id = 'coach:123';
    const attempted = attemptedDays(
      [log(id, 0), log(id, 2), log('coach:999', 1), log(undefined, 1)],
      id,
    );
    expect([...attempted].sort()).toEqual([0, 2]);
    expect(nextProgramDay(3, attempted)).toBe(1);
    expect(nextProgramDay(3, new Set([0, 1, 2]))).toBeNull(); // complete
  });
  it('programIdOf is stable on assessedAt', () => {
    expect(programIdOf({ assessedAt: 42 } as CoachProfile)).toBe('coach:42');
  });
});
