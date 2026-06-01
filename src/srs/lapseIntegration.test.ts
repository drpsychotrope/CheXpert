import { describe, it, expect, beforeEach } from 'vitest';
import { openTrainerDB } from '../store/db';
import { resetDb } from '../test/resetDb';
import { buildLapseSet } from './schedule';

describe('lapse set integration: a failed Tactics attempt → buildLapseSet (via the DB)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('picks up a failed curated attempt written exactly as Tactics writes it', async () => {
    const db = await openTrainerDB();
    // Mirror Tactics.finish(false) for a curated puzzle miss.
    await db.put('puzzleAttempts', {
      id: 'curated:42:1000',
      puzzleId: 'curated:42',
      solved: false,
      ms: 4000,
      themes: ['fork'],
      ratingBefore: 1000,
      ratingAfter: 990,
      playedAt: 1000,
      source: 'curated',
    });
    const attempts = await db.getAll('puzzleAttempts');
    expect(attempts.length).toBe(1);
    expect(buildLapseSet(attempts as Array<{ puzzleId: string; solved: boolean }>, 12)).toEqual(['curated:42']);
  });
});
