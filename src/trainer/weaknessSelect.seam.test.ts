// F3 (ADR-0055): the weakness-steered selection SEAM in Tactics.loadNext, tested against a real
// (fake-indexeddb) PuzzleRepo without a Svelte component harness. The seam is exactly:
//   const steer = steerFromWeakness(counters);
//   if (steer.themes) p = await repo.next({ rating, window: 250, exclude, themes: steer.themes });
//   if (!p) p = await repo.next({ rating, window: 250, exclude });   // plain curated fall-through
// We assert: (1) a dominant weakness biases next() to that theme; (2) no signal → byte-identical to
// the plain curated path; (3) a biased next() returning null falls through (AP-ATTEMPT-2/3).

import { describe, it, expect, beforeEach } from 'vitest';
import { PuzzleRepo } from './PuzzleRepo';
import type { Puzzle } from './puzzle';
import { steerFromWeakness } from './weaknessSelect';
import { resetDb } from '../test/resetDb';

function fakePuzzles(): Puzzle[] {
  const mk = (id: string, rating: number, themes: string[]): Puzzle => ({
    id,
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    moves: ['a1a8'],
    rating,
    ratingDeviation: 80,
    themes,
    source: 'curated',
  });
  return [
    mk('fork-1', 1490, ['fork']),
    mk('fork-2', 1510, ['fork']),
    mk('pin-1', 1500, ['pin']),
    mk('skewer-1', 1505, ['skewer']),
  ];
}
const fakeFetch = (puzzles: Puzzle[]) => async (_url: string) =>
  ({ ok: true, json: async () => ({ puzzles }) }) as unknown as Response;

/** The loadNext curated tail (steered → plain), extracted verbatim so the seam is under test. */
async function selectCurated(repo: PuzzleRepo, counters: Record<string, number>, rating = 1500) {
  const seen = new Set<string>();
  let p: Puzzle | null = null;
  const steer = steerFromWeakness(counters);
  if (steer.themes) {
    p = await repo.next({ rating, window: 250, exclude: seen, themes: steer.themes });
  }
  if (!p) {
    p = await repo.next({ rating, window: 250, exclude: seen });
  }
  return p;
}

describe('weakness-steered selection seam (F3 — ADR-0055)', () => {
  beforeEach(resetDb);

  it('a dominant weakness biases selection to that theme', async () => {
    const repo = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await repo.init();
    const p = await selectCurated(repo, { fork: 4, pin: 1 });
    expect(p?.themes).toContain('fork');
  });

  it('no weakness signal → identical to the plain curated path (no-regression)', async () => {
    const repo = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await repo.init();
    const steered = await selectCurated(repo, {}); // empty counters → undefined themes → plain path
    const plain = await repo.next({ rating: 1500, window: 250, exclude: new Set<string>() });
    expect(steered?.id).toBe(plain?.id); // byte-identical pick
  });

  it('a biased next() returning null falls through to plain curated (AP-ATTEMPT-2/3)', async () => {
    // 'discoveredAttack' is a real weakness above the floor, but NO curated puzzle carries it →
    // the biased next() returns null and the loop must still serve a plain curated puzzle.
    const repo = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await repo.init();
    const p = await selectCurated(repo, { discoveredAttack: 5 });
    expect(p).not.toBeNull(); // never dead-ends
    expect(['fork', 'pin', 'skewer'].some((th) => p!.themes.includes(th))).toBe(true);
  });

  it('a single miss (below the noise floor) does NOT steer — plain path served', async () => {
    const repo = new PuzzleRepo(fakeFetch(fakePuzzles()));
    await repo.init();
    const steered = await selectCurated(repo, { pin: 1 }); // below minCount=2 → no bias
    const plain = await repo.next({ rating: 1500, window: 250, exclude: new Set<string>() });
    expect(steered?.id).toBe(plain?.id);
  });
});
