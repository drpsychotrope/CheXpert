import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../test/resetDb';
import { validateBackup, exportAll, importAll, backupFilename, BACKUP_MARKER, type BackupFile } from './backup';
import { openTrainerDB, DB_VERSION, type GameRecord, type PuzzleAttemptRecord } from './db';
import { freshPlayerModel, clearAllData } from './playerModel';
import type { Puzzle } from '../trainer/puzzle';
import type { GameAnalysis } from '../analysis/types';

const game = (id: string): GameRecord => ({
  id, pgn: '1. e4 e5', result: 'win', botElo: 1500, playedAt: 10, coached: false, playerColor: 'w',
});
const attempt = (id: string, puzzleId: string): PuzzleAttemptRecord => ({
  id, puzzleId, solved: true, ms: 900, themes: ['fork'], ratingBefore: 1500, ratingAfter: 1512, playedAt: 11, source: 'personal',
});
const puzzle = (id: string, source: 'curated' | 'personal'): Puzzle => ({
  id, fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', moves: ['d1d8'], rating: 1400, themes: ['backRankMate'], source,
} as unknown as Puzzle);
const analysis = (gameId: string): GameAnalysis =>
  ({ gameId, source: 'played', playerColor: 'w', analyzedAt: 12, movetimeMs: 200,
     plies: [], byPhase: {} as GameAnalysis['byPhase'], acpl: 0, blunders: 0, mistakes: 0,
     inaccuracies: 0, puzzlesGenerated: 0 });

describe('validateBackup (PR-01, garde I5)', () => {
  it('refuses non-objects and wrong markers as not-a-backup', () => {
    expect(validateBackup(null, 4)).toEqual({ ok: false, error: 'not-a-backup' });
    expect(validateBackup('x', 4)).toEqual({ ok: false, error: 'not-a-backup' });
    expect(validateBackup({ marker: 'something-else', schema: 4, stores: {} }, 4)).toEqual({ ok: false, error: 'not-a-backup' });
  });

  it('refuses a backup written by a NEWER schema (I5) but accepts same/older', () => {
    const b = { marker: BACKUP_MARKER, schema: 5, exportedAt: 1, stores: {} };
    expect(validateBackup(b, 4)).toEqual({ ok: false, error: 'newer-schema' });
    expect(validateBackup({ ...b, schema: 4 }, 4).ok).toBe(true);
    expect(validateBackup({ ...b, schema: 3 }, 4).ok).toBe(true);
  });

  it('flags malformed shapes (bad schema, non-object stores, non-array rows)', () => {
    expect(validateBackup({ marker: BACKUP_MARKER, schema: 'x', stores: {} }, 4)).toEqual({ ok: false, error: 'malformed' });
    expect(validateBackup({ marker: BACKUP_MARKER, schema: 4, stores: [] }, 4)).toEqual({ ok: false, error: 'malformed' });
    expect(validateBackup({ marker: BACKUP_MARKER, schema: 4, stores: { games: 'not-rows' } }, 4)).toEqual({ ok: false, error: 'malformed' });
  });
});

describe('backupFilename (pure, no Date.now)', () => {
  it('derives a stable date-stamped name from the injected now', () => {
    expect(backupFilename(Date.UTC(2026, 6, 2, 12))).toMatch(/^chess-trainer-backup-2026-07-0\d\.json$/);
  });
});

describe('exportAll / importAll round-trip (gate vague 0)', () => {
  beforeEach(resetDb);

  async function seedProfile(): Promise<void> {
    const db = await openTrainerDB();
    await db.put('games', game('g1'));
    await db.put('puzzleAttempts', attempt('p1:11', 'p1'));
    await db.put('puzzles', puzzle('p1', 'personal'));
    await db.put('puzzles', puzzle('c1', 'curated'));
    await db.put('playerModel', freshPlayerModel(1));
    await db.put('settings', { id: 'singleton', coachedMode: true, allowNetwork: false, boardOrientation: 'white' });
    await db.put('importedGames', { id: 'ig1', pgn: '1. d4', playerColor: 'b', headers: { White: 'A' }, importedAt: 13, analyzed: true });
    await db.put('gameAnalyses', analysis('g1'));
    await db.put('srsCards', { id: 'card1', kind: 'puzzle', refId: 'p1', due: 99, state: 0, reps: 0, lapses: 0, stability: 0, difficulty: 0, lastReview: 0 } as never);
    await db.put('repertoire', { id: 'line1', color: 'white', name: 'Italian', sanLine: ['e4', 'e5'], addedAt: 14 } as never);
    await db.put('woodpeckerSets', { id: 'set1', name: 'Misses', puzzleIds: ['p1'], createdAt: 15, cycles: [] } as never);
  }

  it('export → wipe → import reproduces every store; curated puzzles are excluded by design (AP-BACKUP-4)', async () => {
    await seedProfile();
    const json = await exportAll(1234);

    const parsed: unknown = JSON.parse(json);
    const v = validateBackup(parsed, DB_VERSION);
    expect(v.ok).toBe(true);
    const backup = (v as { ok: true; backup: BackupFile }).backup;
    expect(backup.exportedAt).toBe(1234);
    // Curated puzzle filtered out at export; personal kept.
    expect((backup.stores.puzzles as Puzzle[]).map((p) => p.id)).toEqual(['p1']);

    await clearAllData();
    const db = await openTrainerDB();
    expect(await db.count('games')).toBe(0); // wipe really wiped

    const res = await importAll(backup);
    expect(res.skipped).toEqual([]);
    expect(res.restored.games).toBe(1);

    expect(await db.get('games', 'g1')).toEqual(game('g1'));
    expect(await db.get('puzzleAttempts', 'p1:11')).toEqual(attempt('p1:11', 'p1'));
    expect((await db.get('playerModel', 'singleton'))?.onboarded).toBe(freshPlayerModel(1).onboarded);
    expect((await db.get('settings', 'singleton'))?.coachedMode).toBe(true);
    expect((await db.get('importedGames', 'ig1'))?.analyzed).toBe(true);
    expect((await db.get('gameAnalyses', 'g1'))?.analyzedAt).toBe(12);
    expect(await db.count('srsCards')).toBe(1);
    expect(await db.count('repertoire')).toBe(1);
    expect(await db.count('woodpeckerSets')).toBe(1);
    // Personal puzzle restored; curated store row count is 0 → PuzzleRepo.init() re-seeds on boot.
    expect((await db.getAllFromIndex('puzzles', 'source', 'personal')).length).toBe(1);
    expect((await db.getAllFromIndex('puzzles', 'source', 'curated')).length).toBe(0);
  });

  it('replace-everything: a store absent from the backup ends EMPTY (no hybrid state, AP-BACKUP-2)', async () => {
    await seedProfile();
    const json = await exportAll(1);
    const backup = (validateBackup(JSON.parse(json), DB_VERSION) as { ok: true; backup: BackupFile }).backup;
    delete backup.stores.woodpeckerSets; // simulate an older backup without that store

    await importAll(backup);
    const db = await openTrainerDB();
    expect(await db.count('woodpeckerSets')).toBe(0); // cleared, not left over
    expect(await db.count('games')).toBe(1);
  });

  it('skips (and reports) a store name the live DB does not have', async () => {
    await seedProfile();
    const backup = (validateBackup(JSON.parse(await exportAll(1)), DB_VERSION) as { ok: true; backup: BackupFile }).backup;
    backup.stores.futureStore = [{ id: 'x' }];

    const res = await importAll(backup);
    expect(res.skipped).toEqual(['futureStore']);
    const db = await openTrainerDB();
    expect(await db.count('games')).toBe(1); // rest imported normally
  });
});
