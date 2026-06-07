import { describe, it, expect, beforeEach } from 'vitest';
import { PuzzleRepo } from './PuzzleRepo';
import type { Puzzle } from './puzzle';
import { resetDb } from '../test/resetDb';

function fakePuzzles(): Puzzle[] {
  const mk = (id: string, rating: number, themes: string[], fen: string): Puzzle => ({
    id,
    fen,
    moves: ['a1a8'],
    rating,
    ratingDeviation: 80,
    themes,
    source: 'curated',
  });
  return [
    mk('p600', 600, ['mate'], '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'),
    mk('p1000', 1000, ['fork'], '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'),
    mk('p1400', 1400, ['pin'], '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'),
    mk('p1800', 1800, ['fork', 'endgame'], '8/8/8/8/8/8/5PPP/R5K1 w - - 0 1'),
  ];
}

const fakeFetch = (puzzles: Puzzle[]) => async (_url: string) =>
  ({ ok: true, json: async () => ({ puzzles }) }) as unknown as Response;

describe('PuzzleRepo', () => {
  beforeEach(resetDb);

  it('loads + seeds puzzles into IndexedDB and reports size', async () => {
    const repo = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await repo.init();
    expect(repo.size).toBe(4);
  });

  it('returns a puzzle near the requested rating', async () => {
    const repo = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await repo.init();
    const p = repo.next({ rating: 1000, window: 150 });
    expect(p?.id).toBe('p1000');
  });

  it('filters by theme', async () => {
    const repo = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await repo.init();
    const p = repo.next({ rating: 2000, themes: ['pin'] });
    expect(p?.id).toBe('p1400');
  });

  it('honors exclusions', async () => {
    const repo = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await repo.init();
    const p = repo.next({ rating: 600, exclude: new Set(['p600']) });
    expect(p?.id).not.toBe('p600');
  });

  it('byId returns a cached puzzle and null for an unknown id (audit W3)', async () => {
    const repo = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await repo.init();
    expect((await repo.byId('p1000'))?.rating).toBe(1000);
    expect(await repo.byId('missing')).toBeNull();
  });

  it('persists across a second repo instance (no re-seed)', async () => {
    const a = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await a.init();
    // Second instance with an empty fetch must still find the seeded rows.
    const b = new PuzzleRepo(async () => ({ ok: false }) as Response);
    await b.init();
    expect(b.size).toBe(4);
  });

  it('drops malformed puzzles from an untrusted subset (audit W6)', async () => {
    const bad = [
      { id: 'nofen', moves: ['a1a8'], rating: 1000 },
      { id: 'nomoves', fen: '8/8/8/8/8/8/8/8 w - - 0 1', moves: [], rating: 1000 },
    ];
    const repo = new PuzzleRepo(fakeFetch([...fakePuzzles(), ...(bad as unknown as Puzzle[])]));
    await repo.init();
    expect(repo.size).toBe(4); // only the 4 well-formed puzzles were seeded
  });
});
