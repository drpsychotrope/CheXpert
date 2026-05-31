import { describe, it, expect, beforeEach } from 'vitest';
import { openTrainerDB, DB_VERSION, type GameRecord } from './db';
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

  it('creates all v1 stores at the declared version', async () => {
    const db = await openTrainerDB();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(
      ['games', 'playerModel', 'puzzleAttempts', 'puzzles', 'settings'].sort(),
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

  it('creates a fresh player model with both ratings separate', async () => {
    const m = await loadPlayerModel(1000);
    expect(m.puzzleRating).toBeDefined();
    expect(m.gameRating).toBeDefined();
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

  it('clearAllData wipes every store', async () => {
    const db = await openTrainerDB();
    await db.put('games', { id: 'g', pgn: '', result: 'draw', botElo: 1, playedAt: 0, coached: false });
    await loadPlayerModel(0);
    await clearAllData();
    expect(await db.count('games')).toBe(0);
    expect(await db.count('playerModel')).toBe(0);
  });
});
