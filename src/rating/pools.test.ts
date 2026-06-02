import { describe, it, expect } from 'vitest';
import { STANDARD_POOLS, type RatingPool } from './pools';

describe('RatingPool union + STANDARD_POOLS', () => {
  it('STANDARD_POOLS lists exactly the 4 standard pools (chess960 seeded lazily)', () => {
    expect(STANDARD_POOLS).toEqual(['bullet', 'blitz', 'rapid', 'classical']);
  });

  it('the union accepts every standard member and chess960', () => {
    const all: RatingPool[] = ['bullet', 'blitz', 'rapid', 'classical', 'chess960'];
    expect(all).toHaveLength(5);
  });

  it('STANDARD_POOLS is a readonly tuple usable for iteration', () => {
    const seen: string[] = [];
    for (const p of STANDARD_POOLS) seen.push(p);
    expect(seen.sort()).toEqual(['blitz', 'bullet', 'classical', 'rapid']);
  });
});
