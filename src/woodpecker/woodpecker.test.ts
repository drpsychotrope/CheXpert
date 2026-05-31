import { describe, it, expect } from 'vitest';
import {
  createSet, startCycle, currentCycle, nextIndex, recordResult, completeCycle,
  cycleStats, improvement,
} from './woodpecker';

const T0 = Date.UTC(2026, 4, 31);
const IDS = ['p1', 'p2', 'p3'];

describe('woodpecker pure logic', () => {
  it('creates a fixed set', () => {
    const s = createSet('w1', 'Set A', IDS, T0);
    expect(s.puzzleIds).toEqual(IDS);
    expect(s.cycles).toHaveLength(0);
  });

  it('runs a cycle through all puzzles in order', () => {
    let s = createSet('w1', 'A', IDS, T0);
    s = startCycle(s, T0);
    expect(currentCycle(s)?.cycle).toBe(1);
    expect(nextIndex(s)).toBe(0);

    s = recordResult(s, 0, true, 5000);
    expect(nextIndex(s)).toBe(1);
    s = recordResult(s, 1, true, 6000);
    s = recordResult(s, 2, false, 9000);
    expect(nextIndex(s)).toBe(-1);

    s = completeCycle(s, T0 + 20000);
    const stats = cycleStats(s.cycles[0]);
    expect(stats.totalMs).toBe(20000);
    expect(stats.solvedCount).toBe(2);
    expect(stats.accuracy).toBeCloseTo(2 / 3, 5);
    expect(s.cycles[0].completedAt).toBe(T0 + 20000);
  });

  it('keeps the set fixed across cycles and detects improvement', () => {
    let s = createSet('w1', 'A', IDS, T0);
    s = startCycle(s, T0);
    [0, 1, 2].forEach((i) => (s = recordResult(s, i, true, 6000)));
    s = completeCycle(s, T0 + 18000);
    s = startCycle(s, T0 + 100000);
    expect(s.puzzleIds).toEqual(IDS); // same ids
    expect(currentCycle(s)?.cycle).toBe(2);
    [0, 1, 2].forEach((i) => (s = recordResult(s, i, true, 3000)));
    s = completeCycle(s, T0 + 109000);

    const imp = improvement(s);
    expect(imp).not.toBeNull();
    expect(imp!.fasterMs).toBe(18000 - 9000);
    expect(imp!.moreAccurate).toBe(true);
  });

  it('improvement is null with fewer than two completed cycles', () => {
    let s = createSet('w1', 'A', IDS, T0);
    s = startCycle(s, T0);
    expect(improvement(s)).toBeNull();
  });

  it('recordResult with no active cycle is a no-op', () => {
    const s = createSet('w1', 'A', IDS, T0);
    expect(recordResult(s, 0, true, 1000)).toEqual(s);
  });
});
