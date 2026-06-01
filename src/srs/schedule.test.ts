import { describe, it, expect } from 'vitest';
import { interleave, buildLapseSet } from './schedule';

function adjacentSame<T>(arr: T[], key: (t: T) => string): number {
  let n = 0;
  for (let i = 1; i < arr.length; i++) if (key(arr[i]) === key(arr[i - 1])) n++;
  return n;
}

describe('interleave', () => {
  it('reduces adjacent same-theme items', () => {
    const out = interleave(['a', 'a', 'b'], (x) => x);
    expect(adjacentSame(out, (x) => x)).toBe(0); // a,b,a
    expect([...out].sort()).toEqual(['a', 'a', 'b']); // same multiset
  });

  it('keeps all items when every theme is identical', () => {
    expect(interleave(['x', 'x', 'x'], (x) => x)).toHaveLength(3);
  });
});

describe('buildLapseSet', () => {
  it('ranks the most-failed personal puzzles, capped at k, excluding curated/solved', () => {
    const attempts = [
      { puzzleId: 'p1', solved: false, source: 'personal' },
      { puzzleId: 'p1', solved: false, source: 'personal' },
      { puzzleId: 'p2', solved: false, source: 'personal' },
      { puzzleId: 'p3', solved: true, source: 'personal' }, // never failed
      { puzzleId: 'c1', solved: false, source: 'curated' }, // not personal
    ];
    expect(buildLapseSet(attempts, 2)).toEqual(['p1', 'p2']);
    expect(buildLapseSet(attempts, 5)).not.toContain('c1');
    expect(buildLapseSet(attempts, 5)).not.toContain('p3');
  });
});
