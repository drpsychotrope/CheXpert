import { describe, it, expect } from 'vitest';
import { resultToGrade, clampForConfidence, newCard, gradeCard, isDue, intervalLabel, Grade } from './fsrs';

const T0 = Date.UTC(2026, 4, 31, 0, 0, 0);

describe('resultToGrade (Q-I mapping)', () => {
  it('fail → Again', () => {
    expect(resultToGrade(false, 3000)).toBe(Grade.Again);
    expect(resultToGrade(false, 99999)).toBe(Grade.Again);
  });
  it('fast clean pass → Easy', () => {
    expect(resultToGrade(true, 4000)).toBe(Grade.Easy);
  });
  it('normal pass → Good', () => {
    expect(resultToGrade(true, 15000)).toBe(Grade.Good);
  });
  it('slow pass → Hard', () => {
    expect(resultToGrade(true, 30000)).toBe(Grade.Hard);
  });
});

describe('clampForConfidence (T1, Q-E / TR3)', () => {
  it('downgrades Easy and Good to Good for guess/unsure (a self-flagged lucky solve)', () => {
    expect(clampForConfidence(Grade.Easy, 'guess')).toBe(Grade.Good);
    expect(clampForConfidence(Grade.Good, 'guess')).toBe(Grade.Good);
    expect(clampForConfidence(Grade.Easy, 'unsure')).toBe(Grade.Good);
    expect(clampForConfidence(Grade.Good, 'unsure')).toBe(Grade.Good);
  });
  it('is a no-op for high confidence (sure) and for an undefined/absent confidence', () => {
    expect(clampForConfidence(Grade.Easy, 'sure')).toBe(Grade.Easy);
    expect(clampForConfidence(Grade.Good, 'sure')).toBe(Grade.Good);
    expect(clampForConfidence(Grade.Easy)).toBe(Grade.Easy);
    expect(clampForConfidence(Grade.Good, undefined)).toBe(Grade.Good);
  });
  it('never upgrades and leaves Again (a miss) untouched', () => {
    // Again is the miss floor; low confidence must not lift it, nor raise Hard.
    expect(clampForConfidence(Grade.Again, 'guess')).toBe(Grade.Again);
    expect(clampForConfidence(Grade.Again, 'unsure')).toBe(Grade.Again);
    expect(clampForConfidence(Grade.Hard, 'guess')).toBe(Grade.Hard); // already ≤ Good, unchanged
  });
  it('composes with gradeCard first-exposure clamp: a guess first solve still resurfaces < 1 day', () => {
    // resultToGrade(fast solve) = Easy; clampForConfidence(guess) → Good; gradeCard New also caps.
    const grade = clampForConfidence(resultToGrade(true, 4000), 'guess');
    expect(grade).toBe(Grade.Good);
    const c = newCard('puzzle', 'pg', T0);
    const next = gradeCard(c, grade, T0);
    expect((next.due - T0) / 86_400_000).toBeLessThan(1);
  });
});

describe('card lifecycle', () => {
  it('new card is due immediately', () => {
    const c = newCard('puzzle', 'p1', T0);
    expect(c.id).toBe('puzzle:p1');
    expect(c.kind).toBe('puzzle');
    expect(isDue(c, T0)).toBe(true);
    expect(c.reps).toBe(0);
  });

  it('a Good grade pushes the due date into the future and increments reps', () => {
    const c = newCard('puzzle', 'p1', T0);
    const next = gradeCard(c, Grade.Good, T0);
    expect(next.due).toBeGreaterThan(T0);
    expect(next.reps).toBe(1);
    expect(next.id).toBe('puzzle:p1');
  });

  it('Easy schedules further out than Hard', () => {
    const c = newCard('puzzle', 'p2', T0);
    const easy = gradeCard(c, Grade.Easy, T0);
    const hard = gradeCard(c, Grade.Hard, T0);
    expect(easy.due).toBeGreaterThan(hard.due);
  });

  it('caps a fast FIRST solve so a new puzzle resurfaces soon, not in ~10 days', () => {
    // ts-fsrs would graduate a New card on Easy straight to a multi-day interval,
    // skipping the learning steps — so it never comes due in Review. The first
    // exposure is capped to Good (~10 min) so the puzzle reliably resurfaces.
    const c = newCard('puzzle', 'pe', T0);
    const easy = gradeCard(c, Grade.Easy, T0);
    expect((easy.due - T0) / 86_400_000).toBeLessThan(1); // < 1 day
  });

  it('Again keeps the card due soon (relearn) and counts a lapse on a review card', () => {
    let c = newCard('puzzle', 'p3', T0);
    c = gradeCard(c, Grade.Good, T0); // becomes learning/review
    const lapsed = gradeCard(c, Grade.Again, c.due);
    expect(lapsed.due).toBeGreaterThanOrEqual(c.due);
  });

  it('intervalLabel formats relative due time', () => {
    const c = newCard('puzzle', 'p4', T0);
    expect(intervalLabel(c, T0)).toBe('now');
    const future = { ...c, due: T0 + 3 * 86400000 };
    expect(intervalLabel(future, T0)).toBe('in 3 d');
    const soon = { ...c, due: T0 + 30 * 60000 };
    expect(intervalLabel(soon, T0)).toBe('in 30 min');
  });
});
