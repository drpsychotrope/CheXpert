import { describe, it, expect } from 'vitest';
import { interleave, buildLapseSet, failCountByPuzzle, isLeech, type AttemptLike } from './schedule';

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

// --- new focused coverage for the failCountByPuzzle extraction + isLeech ---

const failAttempts: AttemptLike[] = [
  { puzzleId: 'a', solved: false },
  { puzzleId: 'a', solved: false },
  { puzzleId: 'a', solved: false }, // a: 3 fails
  { puzzleId: 'b', solved: false },
  { puzzleId: 'b', solved: true }, // solved attempt does NOT count
  { puzzleId: 'c', solved: true }, // c never fails → absent
];

describe('failCountByPuzzle', () => {
  it('counts only failures, keyed by puzzleId', () => {
    const m = failCountByPuzzle(failAttempts);
    expect(m.get('a')).toBe(3);
    expect(m.get('b')).toBe(1);
    expect(m.has('c')).toBe(false); // no failures → not present
    expect(m.size).toBe(2);
  });

  it('matches the tallies buildLapseSet ranks by', () => {
    const m = failCountByPuzzle(failAttempts);
    // a (3) ranks above b (1).
    expect([...m.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id)).toEqual(['a', 'b']);
  });
});

describe('buildLapseSet (output unchanged after extraction — regression)', () => {
  it('ranks puzzles by failure count, ties broken by id, sliced to k', () => {
    expect(buildLapseSet(failAttempts, 2)).toEqual(['a', 'b']);
    expect(buildLapseSet(failAttempts, 1)).toEqual(['a']);
  });

  it('breaks ties deterministically by ascending id', () => {
    const tied: AttemptLike[] = [
      { puzzleId: 'z', solved: false },
      { puzzleId: 'y', solved: false },
    ];
    expect(buildLapseSet(tied, 2)).toEqual(['y', 'z']);
  });

  it('returns an empty set when there are no failures', () => {
    expect(buildLapseSet([{ puzzleId: 'c', solved: true }], 5)).toEqual([]);
  });
});

describe('isLeech', () => {
  it('is true at or above the threshold, false below', () => {
    expect(isLeech(3, 3)).toBe(true);
    expect(isLeech(4, 3)).toBe(true);
    expect(isLeech(2, 3)).toBe(false);
    expect(isLeech(0, 3)).toBe(false);
  });
});
