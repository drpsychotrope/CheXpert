import { describe, it, expect, beforeEach } from 'vitest';
import { openTrainerDB, DB_VERSION, type PuzzleAttemptRecord } from './db';
import { freshSettings } from './playerModel';
import { resetDb } from '../test/resetDb';

describe('metacognition schema (additive — no version bump)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('DB_VERSION stays 4 (additive fields need no bump — AP-META-7)', () => {
    expect(DB_VERSION).toBe(5); // v5 = +sessionLog (PR-09, ADR-0067); additive fields still never bump
  });

  it('a PuzzleAttemptRecord persists confidence + selfTag round-trip', async () => {
    const db = await openTrainerDB();
    const rec: PuzzleAttemptRecord = {
      id: 'curated:7:1000',
      puzzleId: 'curated:7',
      solved: false,
      ms: 5000,
      themes: ['fork'],
      ratingBefore: 1200,
      ratingAfter: 1190,
      playedAt: 1000,
      source: 'curated',
      confidence: 'sure',
      selfTag: 'rushed',
    };
    await db.put('puzzleAttempts', rec);
    const got = await db.get('puzzleAttempts', 'curated:7:1000');
    expect(got?.confidence).toBe('sure');
    expect(got?.selfTag).toBe('rushed');
  });

  it('a legacy attempt without the fields still loads (undefined, no throw)', async () => {
    const db = await openTrainerDB();
    await db.put('puzzleAttempts', {
      id: 'curated:8:2000',
      puzzleId: 'curated:8',
      solved: true,
      ms: 3000,
      themes: [],
      ratingBefore: 1200,
      ratingAfter: 1205,
      playedAt: 2000,
      source: 'curated',
    });
    const got = await db.get('puzzleAttempts', 'curated:8:2000');
    expect(got?.confidence).toBeUndefined();
    expect(got?.selfTag).toBeUndefined();
  });

  it('freshSettings defaults metacogEnabled to false (opt-in, AP-META-4)', () => {
    expect(freshSettings().metacogEnabled).toBe(false);
  });
});

describe('T3 usedHint schema (additive — no version bump, AP-TINTEG-6)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('DB_VERSION stays 4 (usedHint is additive-optional)', () => {
    expect(DB_VERSION).toBe(5); // v5 = +sessionLog (PR-09, ADR-0067); additive fields still never bump
  });

  it('a PuzzleAttemptRecord persists usedHint round-trip', async () => {
    const db = await openTrainerDB();
    const rec: PuzzleAttemptRecord = {
      id: 'curated:9:3000',
      puzzleId: 'curated:9',
      solved: true,
      ms: 4000,
      themes: ['pin'],
      ratingBefore: 1200,
      ratingAfter: 1200,
      playedAt: 3000,
      source: 'curated',
      usedHint: true,
    };
    await db.put('puzzleAttempts', rec);
    const got = await db.get('puzzleAttempts', 'curated:9:3000');
    expect(got?.usedHint).toBe(true);
  });

  it('a legacy attempt without usedHint reads falsy (undefined, no throw)', async () => {
    const db = await openTrainerDB();
    await db.put('puzzleAttempts', {
      id: 'curated:10:4000',
      puzzleId: 'curated:10',
      solved: true,
      ms: 3000,
      themes: [],
      ratingBefore: 1200,
      ratingAfter: 1205,
      playedAt: 4000,
      source: 'curated',
    });
    const got = await db.get('puzzleAttempts', 'curated:10:4000');
    expect(got?.usedHint).toBeFalsy();
  });
});
