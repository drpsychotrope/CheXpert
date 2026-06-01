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
  it('ranks the most-failed puzzles (any source), capped at k, excluding solved', () => {
    const attempts = [
      { puzzleId: 'p1', solved: false, source: 'personal' },
      { puzzleId: 'p1', solved: false, source: 'personal' },
      { puzzleId: 'c1', solved: false, source: 'curated' }, // failed curated — counts too
      { puzzleId: 'p3', solved: true, source: 'personal' }, // never failed — excluded
    ];
    const ids = buildLapseSet(attempts, 5);
    expect(ids[0]).toBe('p1'); // most-failed first
    expect(ids).toContain('c1'); // a failed CURATED puzzle is a "miss" too
    expect(ids).not.toContain('p3'); // solved excluded
    expect(buildLapseSet(attempts, 1)).toEqual(['p1']); // capped
  });
});
