import { describe, it, expect } from 'vitest';
import {
  sameRank, sameFile, sameDiagonal, aligned, squaresBetween, genRelation,
} from './geometry';

describe('square relations', () => {
  it('sameRank: equal rank, distinct squares', () => {
    expect(sameRank('a1', 'h1')).toBe(true);
    expect(sameRank('a1', 'a2')).toBe(false);
    expect(sameRank('a1', 'a1')).toBe(false); // a !== b required
  });

  it('sameFile: equal file, distinct squares', () => {
    expect(sameFile('a1', 'a8')).toBe(true);
    expect(sameFile('a1', 'b1')).toBe(false);
    expect(sameFile('e4', 'e4')).toBe(false);
  });

  it('sameDiagonal: |Δfile| === |Δrank|', () => {
    expect(sameDiagonal('a1', 'h8')).toBe(true);
    expect(sameDiagonal('c1', 'h6')).toBe(true); // anti-checked: c1->h6 Δfile5 Δrank5
    expect(sameDiagonal('h1', 'a8')).toBe(true);
    expect(sameDiagonal('a1', 'b3')).toBe(false); // knight-shaped
    expect(sameDiagonal('a1', 'a1')).toBe(false);
  });

  it('aligned classifies the shared line or null', () => {
    expect(aligned('a1', 'h1')).toBe('rank');
    expect(aligned('a1', 'a8')).toBe('file');
    expect(aligned('a1', 'h8')).toBe('diagonal');
    expect(aligned('a1', 'b3')).toBeNull();
  });
});

describe('squaresBetween', () => {
  it('strictly-between squares along a file', () => {
    expect(squaresBetween('a1', 'a4')).toEqual(['a2', 'a3']);
  });
  it('strictly-between along the a1-h8 diagonal → 6 inner squares', () => {
    expect(squaresBetween('a1', 'h8')).toEqual(['b2', 'c3', 'd4', 'e5', 'f6', 'g7']);
  });
  it('along a rank, order-independent endpoints', () => {
    expect(squaresBetween('h1', 'a1')).toEqual(['b1', 'c1', 'd1', 'e1', 'f1', 'g1']);
  });
  it('adjacent squares → empty', () => {
    expect(squaresBetween('a1', 'b1')).toEqual([]);
  });
  it('non-aligned → empty', () => {
    expect(squaresBetween('a1', 'b3')).toEqual([]);
  });
});

describe('genRelation', () => {
  it('is deterministic for a given pick', () => {
    expect(genRelation(0.42)).toEqual(genRelation(0.42));
  });
  it('answer is consistent with the geometry for every kind, across the pick range', () => {
    for (let i = 0; i < 64; i++) {
      const { a, b, kind, answer } = genRelation(i / 64);
      expect(a).not.toBe(b);
      if (kind === 'same-diagonal') expect(answer).toBe(sameDiagonal(a, b));
      else if (kind === 'same-color') expect(typeof answer).toBe('boolean');
      else if (kind === 'between') {
        expect(answer).toBe(squaresBetween(a, b).length);
        expect(aligned(a, b)).not.toBeNull(); // between only emits aligned pairs
      }
    }
  });
});
