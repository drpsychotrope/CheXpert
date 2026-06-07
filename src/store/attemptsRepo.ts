// Persistence layer for puzzle attempts (audit W11). Previously the puzzleAttempts store was
// opened ad hoc from Tactics/Review/Calculate/Insights; this centralises every access so the
// components depend on a repo, not on openTrainerDB (mirrors srs/SrsStore + store/playerModel).

import { openTrainerDB, type PuzzleAttemptRecord } from './db';

export async function putAttempt(rec: PuzzleAttemptRecord): Promise<void> {
  const db = await openTrainerDB();
  await db.put('puzzleAttempts', rec);
}

export async function getAttempt(id: string): Promise<PuzzleAttemptRecord | undefined> {
  const db = await openTrainerDB();
  return db.get('puzzleAttempts', id);
}

export async function attemptsByPuzzle(puzzleId: string): Promise<PuzzleAttemptRecord[]> {
  const db = await openTrainerDB();
  return db.getAllFromIndex('puzzleAttempts', 'puzzleId', puzzleId);
}

export async function allAttempts(): Promise<PuzzleAttemptRecord[]> {
  const db = await openTrainerDB();
  return db.getAll('puzzleAttempts');
}
