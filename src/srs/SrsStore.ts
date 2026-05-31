// Persistence + due-queue selection for FSRS cards (Phase 3).

import { openTrainerDB } from '../store/db';
import type { SrsCardRecord, SrsItemKind } from './types';
import { newCard, gradeCard, isDue, type Grade } from './fsrs';

/** Get an existing card for an item, or create + persist a fresh one. */
export async function ensureCard(kind: SrsItemKind, refId: string, now: number): Promise<SrsCardRecord> {
  const db = await openTrainerDB();
  const id = `${kind}:${refId}`;
  const existing = await db.get('srsCards', id);
  if (existing) return existing;
  const card = newCard(kind, refId, now);
  await db.put('srsCards', card);
  return card;
}

/** Grade an item's card and persist the result. Creates the card if missing. */
export async function reviewItem(
  kind: SrsItemKind,
  refId: string,
  grade: Grade,
  now: number,
): Promise<SrsCardRecord> {
  const card = await ensureCard(kind, refId, now);
  const next = gradeCard(card, grade, now);
  const db = await openTrainerDB();
  await db.put('srsCards', next);
  return next;
}

/** Cards due at or before `now`, optionally filtered by kind, soonest first. */
export async function dueCards(now: number, kind?: SrsItemKind, limit = 50): Promise<SrsCardRecord[]> {
  const db = await openTrainerDB();
  // Range over the `due` index up to now (epoch ms) — cheap and ordered.
  const all = await db.getAllFromIndex('srsCards', 'due', IDBKeyRange.upperBound(now));
  const filtered = kind ? all.filter((c) => c.kind === kind) : all;
  return filtered.filter((c) => isDue(c, now)).slice(0, limit);
}

/** Count due cards (for the Home/Review badge). */
export async function dueCount(now: number, kind?: SrsItemKind): Promise<number> {
  const db = await openTrainerDB();
  const all = await db.getAllFromIndex('srsCards', 'due', IDBKeyRange.upperBound(now));
  return kind ? all.filter((c) => c.kind === kind).length : all.length;
}

/** All cards (for stats / debugging). */
export async function allCards(): Promise<SrsCardRecord[]> {
  const db = await openTrainerDB();
  return db.getAll('srsCards');
}
