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
