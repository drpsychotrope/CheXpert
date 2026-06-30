// Persistence layer for played/imported games + their analyses (audit W11). Centralises the
// games / importedGames / gameAnalyses access that Play and Import used to do via openTrainerDB.
// (The analysis pipeline in analysis/runAnalysis.ts owns the WRITE of gameAnalyses; this exposes
// the component-facing reads/writes.)

import { openTrainerDB, type GameRecord, type ImportedGameRecord } from './db';
import type { GameAnalysis } from '../analysis/types';

export async function putGame(rec: GameRecord): Promise<void> {
  const db = await openTrainerDB();
  await db.put('games', rec);
}

export async function putImportedGame(rec: ImportedGameRecord): Promise<void> {
  const db = await openTrainerDB();
  await db.put('importedGames', rec);
}

export async function getAnalysis(gameId: string): Promise<GameAnalysis | undefined> {
  const db = await openTrainerDB();
  return db.get('gameAnalyses', gameId);
}

/**
 * All played games, ascending by `playedAt` (F5, ADR-0056). Thin index read over the EXISTING
 * `games` store + `playedAt` index (created in the v1 upgrade) — NO `DB_VERSION` bump, NO new
 * store/index (AP-GAMES-1). Callers reverse for newest-first. Reads ONLY `games`; the separate
 * `importedGames` store is out of scope (AP-GAMES-8).
 */
export async function getAllGames(): Promise<GameRecord[]> {
  const db = await openTrainerDB();
  return db.getAllFromIndex('games', 'playedAt');
}

/**
 * The set of game ids that already have a stored analysis (F5, ADR-0056). Resolved in ONE
 * `getAllKeys('gameAnalyses')` read so a history list can mark analysed/not without N per-row
 * `getAnalysis` calls (FOLD-G1 / AP-GAMES-3). `gameAnalyses` is keyed by `gameId`.
 */
export async function getAnalyzedGameIds(): Promise<Set<string>> {
  const db = await openTrainerDB();
  return new Set(await db.getAllKeys('gameAnalyses'));
}
