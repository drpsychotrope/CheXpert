// Persistence layer for puzzle attempts (audit W11). Previously the puzzleAttempts store was
// opened ad hoc from Tactics/Review/Calculate/Insights; this centralises every access so the
// components depend on a repo, not on openTrainerDB (mirrors srs/SrsStore + store/playerModel).

import { openTrainerDB, type PuzzleAttemptRecord, type PlayerModel } from './db';
import type { Puzzle } from '../trainer/puzzle';
import type { SrsCardRecord, SrsItemKind } from '../srs/types';
import { newCard, gradeCard, type Grade } from '../srs/fsrs';

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

/**
 * Count SOLVED attempts whose playedAt falls in [`startOfDay`, `now`] (T3/TR8 daily-goal
 * progress). Uses a BOUNDED `playedAt` index range so the read is O(today), not a full
 * allAttempts() scan that grows with the whole log (AP-TINTEG-11). The caller supplies the
 * local start-of-day so the boundary stays deterministic and DST-correct at the call site.
 */
export async function solvedTodayCount(startOfDay: number, now: number): Promise<number> {
  const db = await openTrainerDB();
  const range = IDBKeyRange.bound(startOfDay, now);
  const todays = await db.getAllFromIndex('puzzleAttempts', 'playedAt', range);
  return todays.reduce((n, a) => n + (a.solved ? 1 : 0), 0);
}

/**
 * Record a completed tactics attempt ATOMICALLY (audit W11): the attempt log, the puzzle's drifting
 * rating, the FSRS card, and the player model all commit in ONE IndexedDB transaction. A mid-write
 * failure aborts the whole tx, so we can never end up with e.g. an attempt logged but no SRS card
 * (which would silently leave it out of Review). The FSRS schedule is computed with the pure
 * newCard/gradeCard helpers, so only the card READ happens inside the tx. Returns the new card.
 */
export async function recordTacticsAttempt(opts: {
  attempt: PuzzleAttemptRecord;
  puzzle: Puzzle;
  model: PlayerModel;
  srs: { kind: SrsItemKind; refId: string; grade: Grade };
  now: number;
}): Promise<SrsCardRecord> {
  const db = await openTrainerDB();
  const tx = db.transaction(['puzzleAttempts', 'puzzles', 'srsCards', 'playerModel'], 'readwrite');
  const srsStore = tx.objectStore('srsCards');
  const id = `${opts.srs.kind}:${opts.srs.refId}`;
  const existing = await srsStore.get(id);
  const card = gradeCard(existing ?? newCard(opts.srs.kind, opts.srs.refId, opts.now), opts.srs.grade, opts.now);
  await Promise.all([
    tx.objectStore('puzzleAttempts').put(opts.attempt),
    tx.objectStore('puzzles').put(opts.puzzle),
    srsStore.put(card),
    tx.objectStore('playerModel').put({ ...opts.model, updatedAt: opts.now }),
  ]);
  await tx.done;
  return card;
}
