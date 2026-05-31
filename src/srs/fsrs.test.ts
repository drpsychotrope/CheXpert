import { describe, it, expect } from 'vitest';
import { resultToGrade, newCard, gradeCard, isDue, intervalLabel, Grade } from './fsrs';

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
