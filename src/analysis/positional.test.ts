import { describe, it, expect } from 'vitest';
import { positionalFeatures, explainPositional } from './positional';

describe('positionalFeatures', () => {
  it('detects doubled, isolated, and passed pawns', () => {
    // White pawns c2 and c3 only; no black pawns at all.
    const f = positionalFeatures('7k/8/8/8/8/2P5/2P5/7K w - - 0 1');
    expect(f.w.doubledFiles).toContain('c');
    expect(f.w.isolated.sort()).toEqual(['c2', 'c3']); // no b- or d-file friends
    expect(f.w.passed.length).toBeGreaterThan(0); // no black pawns ahead
  });

  it('reports clean structure for the starting position', () => {
    const f = positionalFeatures('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(f.w.doubledFiles).toHaveLength(0);
    expect(f.w.isolated).toHaveLength(0);
    expect(f.w.passed).toHaveLength(0);
    expect(f.material).toBe(0);
  });
});

describe('explainPositional', () => {
  it('names present features honestly (and nothing on a clean position)', () => {
    const phrases = explainPositional('7k/8/8/8/8/2P5/2P5/7K w - - 0 1', 'w', 'en');
    expect(phrases.join(' ')).toMatch(/isolated|doubled|passed/i);
    expect(explainPositional('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w', 'en')).toHaveLength(0);
    // FR: the same feature, localized (verb agreement baked per-locale).
    expect(explainPositional('7k/8/8/8/8/2P5/2P5/7K w - - 0 1', 'w', 'fr').join(' ')).toMatch(/isolé|doublés|passé/i);
  });
});
