import { describe, it, expect, beforeEach } from 'vitest';
import {
  freshPlayerModel,
  loadPlayerModel,
  savePlayerModel,
  migratePlayerModel,
  loadSettings,
  saveSettings,
  freshSettings,
  CURRENT_PLAYER_SCHEMA_REV,
  DEFAULT_DAILY_GOAL,
} from './playerModel';
import { DB_VERSION, openTrainerDB } from './db';
import { resetDb } from '../test/resetDb';

describe('PlayerModel.conceptSeen (additive, no DB bump)', () => {
  beforeEach(resetDb);

  it('does NOT bump the schema version (still v4)', () => {
    expect(DB_VERSION).toBe(5); // v5 = +sessionLog (PR-09, ADR-0067); additive fields still never bump
  });

  it('freshPlayerModel seeds conceptSeen to an empty array', () => {
    const m = freshPlayerModel(1000);
    expect(m.conceptSeen).toEqual([]);
  });

  it('persists and reloads conceptSeen entries', async () => {
    const m = freshPlayerModel(1000);
    m.conceptSeen = ['fork', 'mate'];
    await savePlayerModel(m, 2000);
    const loaded = await loadPlayerModel(3000);
    expect(loaded.conceptSeen).toEqual(['fork', 'mate']);
  });

  it('an OLD record lacking conceptSeen loads, and consumers read it as [] via ?? []', async () => {
    // Simulate a pre-feature record written without conceptSeen.
    const db = await openTrainerDB();
    const legacy = freshPlayerModel(1000) as unknown as Record<string, unknown>;
    delete legacy.conceptSeen;
    await db.put('playerModel', legacy as never);
    const loaded = await loadPlayerModel(3000);
    expect(loaded.conceptSeen ?? []).toEqual([]);
  });
});

describe('PlayerModel T3 retention (additive, schemaRev 1→2, no DB bump — AP-TINTEG-6)', () => {
  beforeEach(resetDb);

  it('DB_VERSION stays 4; CURRENT_PLAYER_SCHEMA_REV is 2', () => {
    expect(DB_VERSION).toBe(5); // v5 = +sessionLog (PR-09, ADR-0067); additive fields still never bump
    expect(CURRENT_PLAYER_SCHEMA_REV).toBe(2);
  });

  it('freshPlayerModel seeds dailyStreak 0 + the default goal, schemaRev 2, no lastTrainedAt', () => {
    const m = freshPlayerModel(1000);
    expect(m.dailyStreak).toBe(0);
    expect(m.dailyGoal).toBe(DEFAULT_DAILY_GOAL);
    expect(m.lastTrainedAt).toBeUndefined();
    expect(m.schemaRev).toBe(2);
  });

  it('persists and reloads the retention fields', async () => {
    const m = freshPlayerModel(1000);
    m.dailyStreak = 5;
    m.dailyGoal = 20;
    m.lastTrainedAt = 123_456;
    await savePlayerModel(m, 2000);
    const loaded = await loadPlayerModel(3000);
    expect(loaded.dailyStreak).toBe(5);
    expect(loaded.dailyGoal).toBe(20);
    expect(loaded.lastTrainedAt).toBe(123_456);
    expect(loaded.schemaRev).toBe(2);
  });

  it('a rev-1 record (no retention fields) backfills defaults and bumps schemaRev to 2', () => {
    // A record at the previous shape (per-pool maps present, schemaRev 1, no T3 fields).
    const rev1 = freshPlayerModel(1000) as unknown as Record<string, unknown>;
    rev1.schemaRev = 1;
    delete rev1.dailyStreak;
    delete rev1.dailyGoal;
    delete rev1.lastTrainedAt;
    const migrated = migratePlayerModel(rev1);
    expect(migrated.dailyStreak).toBe(0);
    expect(migrated.dailyGoal).toBe(DEFAULT_DAILY_GOAL);
    expect(migrated.lastTrainedAt).toBeUndefined();
    expect(migrated.schemaRev).toBe(2);
  });

  it('a legacy rev-0 record migrates to per-pool AND backfills the T3 retention defaults', () => {
    const rev0 = {
      id: 'singleton',
      puzzleRating: { rating: 1200, rd: 200, vol: 0.06 },
      gameRating: { rating: 1300, rd: 120, vol: 0.06 },
      weaknessCounters: {},
      onboarded: true,
      createdAt: 1,
      updatedAt: 1,
    } as unknown as Record<string, unknown>;
    const migrated = migratePlayerModel(rev0);
    expect(migrated.dailyStreak).toBe(0);
    expect(migrated.dailyGoal).toBe(DEFAULT_DAILY_GOAL);
    expect(migrated.schemaRev).toBe(2);
  });
});

describe('SettingsRecord.autoAnalyzeOnFinish (additive, no DB bump — P1, AP-PLAYLOOP-6)', () => {
  beforeEach(resetDb);

  it('DB_VERSION stays 4 and freshSettings omits the opt-in field (reads false via ??)', () => {
    expect(DB_VERSION).toBe(5); // v5 = +sessionLog (PR-09, ADR-0067); additive fields still never bump
    expect(freshSettings().autoAnalyzeOnFinish).toBeUndefined();
    expect(freshSettings().autoAnalyzeOnFinish ?? false).toBe(false);
  });

  it('persists and reloads autoAnalyzeOnFinish when set', async () => {
    const s = freshSettings();
    s.autoAnalyzeOnFinish = true;
    await saveSettings(s);
    const loaded = await loadSettings();
    expect(loaded.autoAnalyzeOnFinish).toBe(true);
  });

  it('a legacy settings record lacking the field loads fine and reads ?? false', async () => {
    const db = await openTrainerDB();
    const legacy = freshSettings() as unknown as Record<string, unknown>;
    delete legacy.autoAnalyzeOnFinish;
    await db.put('settings', legacy as never);
    const loaded = await loadSettings();
    expect(loaded.autoAnalyzeOnFinish ?? false).toBe(false);
  });
});
