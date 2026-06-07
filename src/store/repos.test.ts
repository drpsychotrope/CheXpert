import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../test/resetDb';
import { putAttempt, getAttempt, attemptsByPuzzle, allAttempts } from './attemptsRepo';
import { putGame, putImportedGame, getAnalysis } from './gamesRepo';
import { openTrainerDB, type PuzzleAttemptRecord } from './db';

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
