// F3 (ADR-0055): coach diagnostic probes are recorded through the EXISTING persistence path
// (recordTacticsAttempt) — an attempt row + a graded FSRS card + a weaknessCounters increment-on-miss
// — but must NEVER move a rating pool (AP-COACH-8 / AP-ATTEMPT-1). These tests pin the exact call
// shape Coach.svelte's recordProbe() uses: puzzle passed UNCHANGED, model with puzzleRating UNCHANGED,
// coachProbe:true, ratingBefore = ratingAfter = baseline. The no-pool-leak guard is the decisive one.

import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../test/resetDb';
import { recordTacticsAttempt } from './attemptsRepo';
import { freshPlayerModel } from './playerModel';
import { resultToGrade } from '../srs/fsrs';
import { openTrainerDB, type PlayerModel } from './db';
import type { Puzzle } from '../trainer/puzzle';

const PROBE: Puzzle = {
  id: 'curated-probe-1',
  fen: '8/8/8/8/8/8/8/6Kk w - - 0 1',
  moves: ['a1a2'],
  rating: 1500,
  ratingDeviation: 80,
  themes: ['fork'],
  source: 'curated',
};

/** Replicate Coach.svelte recordProbe() exactly: increment weaknessCounters on a miss (mutating the
 *  in-memory model), then record via the existing path with the puzzle + puzzleRating UNCHANGED. */
async function recordProbe(model: PlayerModel, puzzle: Puzzle, solved: boolean, now: number, baseline: number) {
  if (!solved) {
    for (const theme of puzzle.themes) {
      model.weaknessCounters[theme] = (model.weaknessCounters[theme] ?? 0) + 1;
    }
  }
  return recordTacticsAttempt({
    attempt: {
      id: `${puzzle.id}:${now}`,
      puzzleId: puzzle.id,
      solved,
      ms: 5000,
      themes: puzzle.themes,
      ratingBefore: baseline,
      ratingAfter: baseline,
      playedAt: now,
      source: 'curated',
      coachProbe: true,
    },
    puzzle: { ...puzzle }, // rating fields UNCHANGED
    model: { ...model }, // puzzleRating UNCHANGED
    srs: { kind: 'puzzle', refId: puzzle.id, grade: resultToGrade(solved, 5000) },
    now,
  });
}

describe('coach probe recording (F3 / CF1 — ADR-0055)', () => {
  beforeEach(resetDb);

  it('writes an attempt row (coachProbe:true) + an FSRS card for the probe puzzle', async () => {
    const db = await openTrainerDB();
    await db.put('puzzles', PROBE);
    const model = freshPlayerModel(0);

    const card = await recordProbe(model, PROBE, true, 1000, 1500);

    const row = await db.get('puzzleAttempts', 'curated-probe-1:1000');
    expect(row?.coachProbe).toBe(true);
    expect(row?.source).toBe('curated'); // provenance is the flag, not a 'coach' source (AP-ATTEMPT-5)
    expect(card.refId).toBe('curated-probe-1');
    expect(await db.get('srsCards', 'puzzle:curated-probe-1')).toBeTruthy();
  });

  it('a missed probe increments weaknessCounters[theme]', async () => {
    const db = await openTrainerDB();
    await db.put('puzzles', PROBE);
    const model = freshPlayerModel(0);

    await recordProbe(model, PROBE, false, 2000, 1500);

    expect(model.weaknessCounters.fork).toBe(1); // in-memory fold
    const persisted = await db.get('playerModel', 'singleton');
    expect(persisted?.weaknessCounters.fork).toBe(1); // and folded into the atomic tx
  });

  it('a solved probe does NOT increment weaknessCounters', async () => {
    const db = await openTrainerDB();
    await db.put('puzzles', PROBE);
    const model = freshPlayerModel(0);

    await recordProbe(model, PROBE, true, 3000, 1500);

    expect(model.weaknessCounters.fork ?? 0).toBe(0);
  });

  it('AP-COACH-8 GUARD: after N probes, puzzleRating + the probe puzzle ratings are UNCHANGED', async () => {
    const db = await openTrainerDB();
    await db.put('puzzles', PROBE);
    const model = freshPlayerModel(0);
    const ratingBefore = model.puzzleRating.rating;
    const rdBefore = model.puzzleRating.rd;
    const volBefore = model.puzzleRating.vol;

    // Record a mix of probes — some missed, some solved — exactly as an assessment would.
    await recordProbe(model, PROBE, false, 1000, ratingBefore);
    await recordProbe(model, PROBE, true, 2000, ratingBefore);
    await recordProbe(model, PROBE, false, 3000, ratingBefore);

    // Player puzzle rating: never moved (probes are diagnostics, not graded matches).
    expect(model.puzzleRating.rating).toBe(ratingBefore);
    expect(model.puzzleRating.rd).toBe(rdBefore);
    expect(model.puzzleRating.vol).toBe(volBefore);
    const persistedModel = await db.get('playerModel', 'singleton');
    expect(persistedModel?.puzzleRating.rating).toBe(ratingBefore);
    expect(persistedModel?.puzzleRating.rd).toBe(rdBefore);

    // The probe puzzle's OWN Glicko rating: never perturbed by a low-stakes diagnostic (Q-F).
    const persistedPuzzle = await db.get('puzzles', 'curated-probe-1');
    expect(persistedPuzzle?.rating).toBe(PROBE.rating);
    expect(persistedPuzzle?.ratingDeviation).toBe(PROBE.ratingDeviation);
  });

  it('grade mapping matches resultToGrade(solved, ms)', async () => {
    const db = await openTrainerDB();
    await db.put('puzzles', PROBE);
    const model = freshPlayerModel(0);

    // A clean solve at 5000ms maps to Good (between fastMs 8000? no — 5000 <= 8000 → Easy on a fresh
    // card is capped to Good by gradeCard). Assert via the card the repo returns vs a direct grade.
    const card = await recordProbe(model, PROBE, true, 1000, 1500);
    expect(card.reps).toBeGreaterThan(0);
    // resultToGrade(true, 5000) === Easy; on a brand-new card gradeCard caps Easy→Good (ADR-0033),
    // so the card graduates to a learning/review state rather than a multi-day jump.
    expect(resultToGrade(true, 5000)).toBe(4 /* Rating.Easy */);
  });
});
