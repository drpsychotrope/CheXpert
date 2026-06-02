import { describe, it, expect } from 'vitest';
import { migratePlayerModel, poolRating, poolOpponent, freshPlayerModel } from '../store/playerModel';
import { defaultRating } from './glicko2';
import { STANDARD_POOLS } from './pools';
import type { PlayerModel } from '../store/db';

// A legacy v4 record carrying the OLD single-rating shape.
function legacyRecord(): Record<string, unknown> {
  return {
    id: 'singleton',
    puzzleRating: defaultRating(1600, 80, 0.06),
    gameRating: defaultRating(1450, 90, 0.06),
    opponentTargetElo: 1480,
    recentOutcomes: ['win', 'loss', 'win'],
    weaknessCounters: { fork: 2 },
    onboarded: true,
    createdAt: 10,
    updatedAt: 20,
  };
}

describe('migratePlayerModel', () => {
  it('seeds all 4 standard pools from a legacy gameRating with RD widened to >= 150', () => {
    const m = migratePlayerModel(legacyRecord());
    for (const pool of STANDARD_POOLS) {
      expect(m.gameRatings[pool]).toBeDefined();
      expect(m.gameRatings[pool]!.rating).toBe(1450);
      expect(m.gameRatings[pool]!.rd).toBeGreaterThanOrEqual(150);
    }
  });

  it('seeds opponentByPool for the 4 standard pools from the legacy fields', () => {
    const m = migratePlayerModel(legacyRecord());
    for (const pool of STANDARD_POOLS) {
      expect(m.opponentByPool[pool]).toEqual({ targetElo: 1480, recent: ['win', 'loss', 'win'] });
    }
  });

  it('does NOT seed chess960 (lazy)', () => {
    const m = migratePlayerModel(legacyRecord());
    expect(m.gameRatings.chess960).toBeUndefined();
    expect(m.opponentByPool.chess960).toBeUndefined();
  });

  it('drops the legacy gameRating / opponentTargetElo / recentOutcomes fields', () => {
    const m = migratePlayerModel(legacyRecord()) as unknown as Record<string, unknown>;
    expect(m.gameRating).toBeUndefined();
    expect(m.opponentTargetElo).toBeUndefined();
    expect(m.recentOutcomes).toBeUndefined();
  });

  it('preserves puzzleRating, weaknessCounters, onboarded, timestamps', () => {
    const m = migratePlayerModel(legacyRecord());
    expect(m.puzzleRating.rating).toBe(1600);
    expect(m.weaknessCounters).toEqual({ fork: 2 });
    expect(m.onboarded).toBe(true);
    expect(m.createdAt).toBe(10);
  });

  it('falls back to round(gameRating) for opponent targetElo when opponentTargetElo is absent', () => {
    const raw = legacyRecord();
    delete raw.opponentTargetElo;
    delete raw.recentOutcomes;
    const m = migratePlayerModel(raw);
    expect(m.opponentByPool.classical).toEqual({ targetElo: 1450, recent: [] });
  });

  it('leaves an already-migrated record untouched', () => {
    const fresh = freshPlayerModel(100);
    fresh.gameRatings.bullet = defaultRating(1700, 120, 0.06);
    const m = migratePlayerModel(fresh as unknown as Record<string, unknown>);
    expect(m.gameRatings.bullet!.rating).toBe(1700);
    expect(m.gameRatings.classical).toBeDefined();
  });
});

describe('poolRating / poolOpponent fallback', () => {
  it('returns the pool rating directly when seeded', () => {
    const m = freshPlayerModel(0);
    m.gameRatings.rapid = defaultRating(1333, 100, 0.06);
    expect(poolRating(m, 'rapid').rating).toBe(1333);
  });

  it('falls back to the nearest seeded standard pool for an empty pool (chess960)', () => {
    const m = freshPlayerModel(0) as PlayerModel;
    // freshPlayerModel seeds the 4 standard pools at defaultRating(); chess960 is empty.
    expect(poolRating(m, 'chess960').rating).toBe(defaultRating().rating);
  });

  it('falls back to defaultRating() when no pool at all is seeded', () => {
    const m = freshPlayerModel(0);
    m.gameRatings = {};
    expect(poolRating(m, 'blitz')).toEqual(defaultRating());
  });

  it('poolOpponent falls back to { targetElo: 1500, recent: [] } when nothing is seeded', () => {
    const m = freshPlayerModel(0);
    m.opponentByPool = {};
    expect(poolOpponent(m, 'bullet')).toEqual({ targetElo: 1500, recent: [] });
  });

  it('poolOpponent returns the seeded pool when present', () => {
    const m = freshPlayerModel(0);
    m.opponentByPool.blitz = { targetElo: 1620, recent: ['win'] };
    expect(poolOpponent(m, 'blitz')).toEqual({ targetElo: 1620, recent: ['win'] });
  });
});

describe('freshPlayerModel', () => {
  it('seeds the 4 standard pools at defaultRating() and opponentByPool at targetElo 1500', () => {
    const m = freshPlayerModel(42);
    for (const pool of STANDARD_POOLS) {
      expect(m.gameRatings[pool]).toEqual(defaultRating());
      expect(m.opponentByPool[pool]).toEqual({ targetElo: 1500, recent: [] });
    }
    expect(m.gameRatings.chess960).toBeUndefined();
  });
});
