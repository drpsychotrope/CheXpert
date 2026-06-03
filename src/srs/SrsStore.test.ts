import { describe, it, expect, beforeEach } from 'vitest';
import { ensureCard, reviewItem, dueCards, dueCount, allCards } from './SrsStore';
import { Grade } from './fsrs';
import { resetDb } from '../test/resetDb';

const T0 = Date.UTC(2026, 4, 31);

describe('SrsStore', () => {
  beforeEach(resetDb);

  it('creates a card once and reuses it', async () => {
    const a = await ensureCard('puzzle', 'p1', T0);
    const b = await ensureCard('puzzle', 'p1', T0 + 1000);
    expect(a.id).toBe(b.id);
    expect((await allCards()).length).toBe(1);
  });

  it('a new card is due now; a Good review removes it from the due queue', async () => {
    await ensureCard('puzzle', 'p1', T0);
    expect(await dueCount(T0)).toBe(1);
    await reviewItem('puzzle', 'p1', Grade.Good, T0);
    expect(await dueCount(T0)).toBe(0); // pushed into the future
  });

  it('dueCards filters by kind', async () => {
    await ensureCard('puzzle', 'p1', T0);
    await ensureCard('repertoire', 'r1', T0);
    const puzzles = await dueCards(T0, 'puzzle');
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].kind).toBe('puzzle');
  });

  it('a failed review keeps the card due soon', async () => {
    await ensureCard('puzzle', 'p1', T0);
    await reviewItem('puzzle', 'p1', Grade.Good, T0);
    expect(await dueCount(T0)).toBe(0);
    // Fail it later when it comes due.
    const cards = await allCards();
    const due = cards[0].due;
    await reviewItem('puzzle', 'p1', Grade.Again, due);
    // After a lapse it should be due again within a day.
    expect(await dueCount(due + 86400000)).toBe(1);
  });

  // ADR-0042: per-square vision cards must not leak into the puzzle Review gate.
  it('vision-square cards round-trip and do not inflate the puzzle due-count', async () => {
    await ensureCard('vision-square', 'e4', T0);
    await ensureCard('puzzle', 'p1', T0);

    const vision = await dueCards(T0, 'vision-square');
    expect(vision).toHaveLength(1);
    expect(vision[0].id).toBe('vision-square:e4');

    // The session Review gate scopes to 'puzzle' — the due vision card is invisible to it.
    expect(await dueCount(T0, 'puzzle')).toBe(1);
    expect(await dueCount(T0, 'vision-square')).toBe(1);
  });
});
