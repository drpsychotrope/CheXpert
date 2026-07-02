import { describe, it, expect, beforeEach } from 'vitest';
import { openTrainerDB, DB_VERSION, type GameRecord, type PlayerModel } from './db';
import {
  loadPlayerModel,
  savePlayerModel,
  loadSettings,
  saveSettings,
  clearAllData,
} from './playerModel';
import { resetDb } from '../test/resetDb';

describe('IndexedDB store', () => {
  beforeEach(resetDb);

  it('creates all stores at the declared (v5) version', async () => {
    const db = await openTrainerDB();
    expect(db.version).toBe(DB_VERSION);
    expect(DB_VERSION).toBe(5); // PR-09 (ADR-0067): +sessionLog — bump reserved for NEW stores
    expect([...db.objectStoreNames].sort()).toEqual(
      [
        'gameAnalyses',
        'games',
        'importedGames',
        'playerModel',
        'puzzleAttempts',
        'puzzles',
        'repertoire',
        'sessionLog',
        'settings',
        'srsCards',
        'woodpeckerSets',
      ].sort(),
    );
  });

  it('round-trips a game record', async () => {
    const db = await openTrainerDB();
    const rec: GameRecord = {
      id: 'g1',
      pgn: '1. e4 e5',
      result: 'win',
      botElo: 1500,
      playedAt: 123,
      coached: false,
    };
    await db.put('games', rec);
    expect(await db.get('games', 'g1')).toEqual(rec);
  });

  it('creates a fresh player model with the puzzle rating + the 4 standard game-rating pools', async () => {
    const m = await loadPlayerModel(1000);
    expect(m.puzzleRating).toBeDefined();
    expect(m.gameRatings.classical).toBeDefined();
    expect(m.gameRatings.bullet).toBeDefined();
    expect(m.gameRatings.blitz).toBeDefined();
    expect(m.gameRatings.rapid).toBeDefined();
    expect(m.gameRatings.chess960).toBeUndefined();
    expect(m.onboarded).toBe(false);
  });

  it('persists player model updates', async () => {
    const m = await loadPlayerModel(1000);
    m.onboarded = true;
    m.puzzleRating.rating = 1650;
    await savePlayerModel(m, 2000);
    const reloaded = await loadPlayerModel(3000);
    expect(reloaded.onboarded).toBe(true);
    expect(reloaded.puzzleRating.rating).toBe(1650);
  });

  it('settings default to local-only (privacy) and persist', async () => {
    const s = await loadSettings();
    expect(s.allowNetwork).toBe(false); // AP-CHESS-8
    s.coachedMode = true;
    await saveSettings(s);
    expect((await loadSettings()).coachedMode).toBe(true);
  });

  it('clearAllData wipes every store, including Phase 2/3 stores (privacy, ADR-0013)', async () => {
    const db = await openTrainerDB();
    await db.put('games', { id: 'g', pgn: '', result: 'draw', botElo: 1, playedAt: 0, coached: false });
    await loadPlayerModel(0);
    // Seed a v2 store and a v3 store so we prove the wipe is exhaustive.
    await db.put('importedGames', { id: 'ig', pgn: '', playerColor: 'w', headers: {}, importedAt: 0, analyzed: false });
    await db.put('srsCards', {
      id: 'puzzle:p1', kind: 'puzzle', refId: 'p1', due: 0, stability: 0, difficulty: 0,
      elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0,
      last_review: null, createdAt: 0,
    });
    await clearAllData();
    for (const store of db.objectStoreNames) {
      expect(await db.count(store)).toBe(0);
    }
  });

  it('migrates v1 → v5 without dropping existing data (G3)', async () => {
    // Build a real v1 database by hand, seed a row, close it, then open at the
    // current version and confirm the old row survived + new stores exist.
    const { openDB } = await import('idb');
    const v1 = await openDB('chess-trainer', 1, {
      upgrade(db) {
        const games = db.createObjectStore('games', { keyPath: 'id' });
        games.createIndex('playedAt', 'playedAt');
        const pa = db.createObjectStore('puzzleAttempts', { keyPath: 'id' });
        pa.createIndex('puzzleId', 'puzzleId');
        pa.createIndex('playedAt', 'playedAt');
        const puz = db.createObjectStore('puzzles', { keyPath: 'id' });
        puz.createIndex('rating', 'rating');
        puz.createIndex('source', 'source');
        db.createObjectStore('playerModel', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'id' });
      },
    });
    await v1.put('games', { id: 'old', pgn: '1. e4', result: 'win', botElo: 1500, playedAt: 1, coached: false });
    v1.close();

    // Now the app opens at v5 via the real upgrade ladder (v1→v2→v3→v4→v5).
    const upgraded = await openTrainerDB();
    expect(upgraded.version).toBe(5);
    expect(await upgraded.get('games', 'old')).toBeTruthy(); // v1 data preserved
    expect(upgraded.objectStoreNames.contains('importedGames')).toBe(true); // v2
    expect(upgraded.objectStoreNames.contains('gameAnalyses')).toBe(true); // v2
    expect(upgraded.objectStoreNames.contains('srsCards')).toBe(true); // v3
    expect(upgraded.objectStoreNames.contains('repertoire')).toBe(true); // v3
    expect(upgraded.objectStoreNames.contains('woodpeckerSets')).toBe(true); // v4
    expect(upgraded.objectStoreNames.contains('sessionLog')).toBe(true); // v5 (PR-09)
  });

  it('migrates a legacy single-gameRating record to per-pool ratings on load (no version bump)', async () => {
    const db = await openTrainerDB();
    // Write a legacy-shaped record directly (bypassing the typed helper).
    await db.put('playerModel', {
      id: 'singleton',
      puzzleRating: { rating: 1600, rd: 80, vol: 0.06 },
      gameRating: { rating: 1450, rd: 90, vol: 0.06 },
      opponentTargetElo: 1480,
      recentOutcomes: ['win', 'loss'],
      weaknessCounters: {},
      onboarded: true,
      createdAt: 1,
      updatedAt: 2,
    } as unknown as PlayerModel);

    const m = await loadPlayerModel(3000);
    expect(m.gameRatings.classical?.rating).toBe(1450);
    expect(m.gameRatings.bullet?.rating).toBe(1450);
    expect(m.gameRatings.classical?.rd).toBeGreaterThanOrEqual(150);
    expect(m.opponentByPool.rapid).toEqual({ targetElo: 1480, recent: ['win', 'loss'] });
    expect((m as unknown as { gameRating?: unknown }).gameRating).toBeUndefined();
    expect(db.version).toBe(DB_VERSION); // load-path migration — never its own bump
  });
});
