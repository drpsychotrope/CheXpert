import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../test/resetDb';
import { putAttempt, getAttempt, attemptsByPuzzle, allAttempts, recordTacticsAttempt } from './attemptsRepo';
import { putGame, putImportedGame, getAnalysis } from './gamesRepo';
import { freshPlayerModel } from './playerModel';
import { resultToGrade } from '../srs/fsrs';
import { openTrainerDB, type PuzzleAttemptRecord } from './db';
import type { Puzzle } from '../trainer/puzzle';

const attempt = (id: string, puzzleId: string, solved: boolean): PuzzleAttemptRecord => ({
  id, puzzleId, solved, ms: 1000, themes: ['fork'], ratingBefore: 1500, ratingAfter: 1500, playedAt: 1, source: 'curated',
});

describe('attemptsRepo (W11)', () => {
  beforeEach(resetDb);
  it('puts, gets, lists by puzzle, and lists all', async () => {
    await putAttempt(attempt('p1:1', 'p1', false));
    await putAttempt(attempt('p1:2', 'p1', true));
    await putAttempt(attempt('p2:1', 'p2', false));
    expect((await getAttempt('p1:1'))?.solved).toBe(false);
    expect((await attemptsByPuzzle('p1')).length).toBe(2);
    expect((await allAttempts()).length).toBe(3);
    expect(await getAttempt('missing')).toBeUndefined();
  });
});

describe('gamesRepo (W11)', () => {
  beforeEach(resetDb);
  it('puts a game + an imported game and round-trips them; getAnalysis is undefined when absent', async () => {
    await putGame({ id: 'g1', pgn: '1. e4', result: 'win', botElo: 1500, playedAt: 1, coached: false });
    await putImportedGame({ id: 'ig1', pgn: '1. e4', playerColor: 'w', headers: {}, importedAt: 1, analyzed: false });
    const db = await openTrainerDB();
    expect((await db.get('games', 'g1'))?.result).toBe('win');
    expect((await db.get('importedGames', 'ig1'))?.analyzed).toBe(false);
    expect(await getAnalysis('nope')).toBeUndefined();
  });
});

describe('recordTacticsAttempt — atomic 4-store write (W11)', () => {
  beforeEach(resetDb);
  it('commits attempt + puzzle rating + FSRS card + player model together', async () => {
    const db = await openTrainerDB();
    const puzzle: Puzzle = {
      id: 'pz1', fen: '8/8/8/8/8/8/8/6Kk w - - 0 1', moves: ['a1a2'],
      rating: 1500, ratingDeviation: 80, themes: ['fork'], source: 'curated',
    };
    await db.put('puzzles', puzzle);

    const card = await recordTacticsAttempt({
      attempt: attempt('pz1:1', 'pz1', false),
      puzzle: { ...puzzle, rating: 1480 },
      model: freshPlayerModel(0),
      srs: { kind: 'puzzle', refId: 'pz1', grade: resultToGrade(false, 1000) },
      now: 1000,
    });

    expect(card.refId).toBe('pz1');
    expect((await db.get('puzzleAttempts', 'pz1:1'))?.solved).toBe(false);
    expect((await db.get('puzzles', 'pz1'))?.rating).toBe(1480);
    expect(await db.get('srsCards', 'puzzle:pz1')).toBeTruthy();
    expect((await db.get('playerModel', 'singleton'))?.updatedAt).toBe(1000);
  });
});
