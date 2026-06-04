import { describe, it, expect, beforeEach } from 'vitest';
import {
  acplToElo,
  seedGameRating,
  priorFromDeclarative,
  PuzzleLadder,
  LADDER_MAX,
} from './Calibration';
import { PuzzleRepo } from '../trainer/PuzzleRepo';
import type { Puzzle } from '../trainer/puzzle';
import { defaultRating } from '../rating/glicko2';
import { resetDb } from '../test/resetDb';

describe('acplToElo', () => {
  it('is monotonic decreasing in ACPL', () => {
    const xs = [5, 15, 30, 50, 75, 110, 180, 250];
    const ys = xs.map(acplToElo);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]);
  });

  it('maps strong play high and weak play low', () => {
    expect(acplToElo(8)).toBeGreaterThan(2000);
    expect(acplToElo(200)).toBeLessThan(900);
  });
});

describe('seedGameRating', () => {
  it('skip path blends puzzle + prior with a wide RD', () => {
    const r = seedGameRating(defaultRating(1400), defaultRating(1200), null);
    expect(r.rating).toBeGreaterThan(1200);
    expect(r.rating).toBeLessThan(1400);
    expect(r.rd).toBeGreaterThanOrEqual(250); // AP-CHESS-24: rough seed
  });

  it('Stage-2 path seeds from ACPL and nudges by game result', () => {
    const win = seedGameRating(defaultRating(1500), defaultRating(1500), 40, 'win', 1600);
    const loss = seedGameRating(defaultRating(1500), defaultRating(1500), 40, 'loss', 1600);
    expect(win.rating).toBeGreaterThan(loss.rating);
  });
});

describe('priorFromDeclarative', () => {
  it('orders self-rated levels', () => {
    expect(priorFromDeclarative({ selfLevel: 'new' }).rating).toBeLessThan(
      priorFromDeclarative({ selfLevel: 'advanced' }).rating,
    );
  });
  it('trusts a stated prior rating', () => {
    expect(priorFromDeclarative({ selfLevel: 'new', priorRating: 1700 }).rating).toBe(1700);
  });
});

describe('PuzzleLadder', () => {
  beforeEach(resetDb);

  function ladderPuzzles(): Puzzle[] {
    const out: Puzzle[] = [];
    for (let r = 600; r <= 2200; r += 100) {
      out.push({
        id: `p${r}`,
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        moves: ['a1a8'],
        rating: r,
        ratingDeviation: 80,
        themes: ['mate'],
        source: 'curated',
      });
    }
    return out;
  }

  it('terminates within the max ladder length and yields a rating', async () => {
    const repo = new PuzzleRepo(async () => ({ ok: true, json: async () => ({ puzzles: ladderPuzzles() }) }) as unknown as Response);
    await repo.init();
    const ladder = new PuzzleLadder(repo, defaultRating(1200, 300, 0.06));

    let guard = 0;
    while (!ladder.isDone() && guard < 50) {
      const t = ladder.next(0);
      if (!t) break;
      // Simulate: solve everything (all-correct run).
      ladder.report(true);
      guard++;
    }
    expect(ladder.count).toBeLessThanOrEqual(LADDER_MAX);
    expect(ladder.rating.rating).toBeGreaterThan(0);
  });

  it('an all-correct run ends higher than an all-wrong run', async () => {
    const make = async () => {
      const repo = new PuzzleRepo(
        async () => ({ ok: true, json: async () => ({ puzzles: ladderPuzzles() }) }) as unknown as Response,
      );
      await repo.init();
      return repo;
    };

    const up = new PuzzleLadder(await make(), defaultRating(1200, 300, 0.06));
    for (let i = 0; i < 8; i++) {
      up.next(0);
      up.report(true);
    }

    await resetDb();

    const down = new PuzzleLadder(await make(), defaultRating(1200, 300, 0.06));
    for (let i = 0; i < 8; i++) {
      down.next(0);
      down.report(false);
    }
    expect(up.rating.rating).toBeGreaterThan(down.rating.rating);
  });

  it('PuzzleLadder honors a short min/max via opts', async () => {
    const repo = new PuzzleRepo(
      async () => ({ ok: true, json: async () => ({ puzzles: ladderPuzzles() }) }) as unknown as Response,
    );
    await repo.init();
    const ladder = new PuzzleLadder(repo, defaultRating(1200, 300, 0.06), { min: 3, max: 5 });

    // After 2 puzzles (count < min=3), ladder should not yet be done.
    ladder.next(0); ladder.report(true);
    ladder.next(0); ladder.report(true);
    expect(ladder.count).toBe(2);
    expect(ladder.isDone()).toBe(false);

    // After 5 puzzles (count === max=5), ladder must be done regardless of RD.
    ladder.next(0); ladder.report(true);
    ladder.next(0); ladder.report(true);
    ladder.next(0); ladder.report(true);
    expect(ladder.count).toBe(5);
    expect(ladder.isDone()).toBe(true);
  });
});
