// FSRS scheduling wrapper (Phase 3, ADR-0010). Thin layer over ts-fsrs:
//  - create a card for a trainable item,
//  - map a solve outcome (solved? + time) to an FSRS grade (Q-I),
//  - apply the grade and return the updated, storable card.
//
// Grade mapping (Q-I=a): fail → Again, slow pass → Hard, clean → Good,
// fast clean → Easy. Thresholds tunable. Honors active recall (AP-CHESS-15):
// the caller only grades after the user actually played the move.

import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from 'ts-fsrs';
import type { SrsCardRecord, SrsItemKind } from './types';

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export const Grade = { Again: Rating.Again, Hard: Rating.Hard, Good: Rating.Good, Easy: Rating.Easy } as const;
export type Grade = (typeof Grade)[keyof typeof Grade];

export interface GradeThresholds {
  /** A pass at/under this many ms is "fast" → Easy. */
  fastMs: number;
  /** A pass over this many ms is "slow" → Hard. */
  slowMs: number;
}

export const DEFAULT_GRADE_THRESHOLDS: GradeThresholds = { fastMs: 8000, slowMs: 25000 };

/** Map an attempt outcome to an FSRS grade (Q-I). */
export function resultToGrade(
  solved: boolean,
  ms: number,
  t: GradeThresholds = DEFAULT_GRADE_THRESHOLDS,
): Grade {
  if (!solved) return Grade.Again;
  if (ms <= t.fastMs) return Grade.Easy;
  if (ms >= t.slowMs) return Grade.Hard;
  return Grade.Good;
}

// --- Card <-> record conversion (Dates <-> epoch ms) -----------------------

function cardToRecord(card: Card, base: Pick<SrsCardRecord, 'id' | 'kind' | 'refId' | 'createdAt'>): SrsCardRecord {
  return {
    ...base,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps ?? 0,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
  };
}

function recordToCard(rec: SrsCardRecord): Card {
  return {
    due: new Date(rec.due),
    stability: rec.stability,
    difficulty: rec.difficulty,
    elapsed_days: rec.elapsed_days,
    scheduled_days: rec.scheduled_days,
    learning_steps: rec.learning_steps,
    reps: rec.reps,
    lapses: rec.lapses,
    state: rec.state as State,
    last_review: rec.last_review != null ? new Date(rec.last_review) : undefined,
  };
}

/** Create a fresh SRS card record for an item, due immediately. */
export function newCard(kind: SrsItemKind, refId: string, now: number): SrsCardRecord {
  const card = createEmptyCard(new Date(now));
  return cardToRecord(card, { id: `${kind}:${refId}`, kind, refId, createdAt: now });
}

/** Apply a grade to a card record at time `now`; return the updated record. */
export function gradeCard(rec: SrsCardRecord, grade: Grade, now: number): SrsCardRecord {
  const card = recordToCard(rec);
  // A fast FIRST solve (Easy on a brand-new card) would graduate it straight to a
  // multi-day interval, skipping the short learning steps — so the puzzle never comes
  // due in Review for days. Cap the first exposure to Good (~10 min) so it reliably
  // resurfaces; it graduates normally on the next review. (ADR-0033)
  const effective = grade === Grade.Easy && card.state === State.New ? Grade.Good : grade;
  const result = scheduler.repeat(card, new Date(now));
  const next = result[effective].card;
  return cardToRecord(next, { id: rec.id, kind: rec.kind, refId: rec.refId, createdAt: rec.createdAt });
}

/** Is this card due at time `now`? */
export function isDue(rec: SrsCardRecord, now: number): boolean {
  return rec.due <= now;
}

/** Human-readable next-interval label for UI (e.g. "in 3 days", "in 10 min"). */
export function intervalLabel(rec: SrsCardRecord, now: number): string {
  const ms = rec.due - now;
  if (ms <= 0) return 'now';
  const min = ms / 60000;
  if (min < 60) return `in ${Math.round(min)} min`;
  const hr = min / 60;
  if (hr < 24) return `in ${Math.round(hr)} h`;
  return `in ${Math.round(hr / 24)} d`;
}

export { Rating, State };
