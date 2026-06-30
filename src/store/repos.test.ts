import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../test/resetDb';
import { putAttempt, getAttempt, attemptsByPuzzle, allAttempts, recordTacticsAttempt } from './attemptsRepo';
import { putGame, putImportedGame, getAnalysis, getAllGames, getAnalyzedGameIds } from './gamesRepo';
import type { GameAnalysis } from '../analysis/types';
import type { GameRecord } from './db';
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

// F5 (ADR-0056): the `games` store made readable + a batched analysed-set read.
const game = (id: string, playedAt: number): GameRecord => ({
  id, pgn: '1. e4 e5', result: 'win', botElo: 1500, playedAt, coached: false,
});
const analysisFor = (gameId: string): GameAnalysis =>
  ({ gameId, source: 'played', playerColor: 'w', analyzedAt: 1, movetimeMs: 200,
     plies: [], byPhase: {} as GameAnalysis['byPhase'], acpl: 0, blunders: 0, mistakes: 0,
     inaccuracies: 0, puzzlesGenerated: 0 });

describe('gamesRepo.getAllGames (F5)', () => {
  beforeEach(resetDb);

  it('returns [] when no games exist', async () => {
    expect(await getAllGames()).toEqual([]);
  });

  it('returns games ordered ascending by playedAt (caller reverses for newest-first)', async () => {
    // Insert out of chronological order; the playedAt index must sort them.
    await putGame(game('g-mid', 200));
    await putGame(game('g-old', 100));
    await putGame(game('g-new', 300));
    const all = await getAllGames();
    expect(all.map((g) => g.id)).toEqual(['g-old', 'g-mid', 'g-new']);
    // Newest-first (the UI's reverse) is the exact reverse.
    expect([...all].reverse().map((g) => g.id)).toEqual(['g-new', 'g-mid', 'g-old']);
  });

  it('reads ONLY the games store — importedGames never leak in (AP-GAMES-8)', async () => {
    await putGame(game('g1', 1));
    await putImportedGame({ id: 'ig1', pgn: '1. e4', playerColor: 'w', headers: {}, importedAt: 1, analyzed: false });
    const all = await getAllGames();
    expect(all.map((g) => g.id)).toEqual(['g1']);
  });
});

describe('gamesRepo.getAnalyzedGameIds (F5)', () => {
  beforeEach(resetDb);

  it('returns an empty set when nothing is analysed', async () => {
    const ids = await getAnalyzedGameIds();
    expect(ids instanceof Set).toBe(true);
    expect(ids.size).toBe(0);
  });

  it('contains exactly the ids present in gameAnalyses; excludes games with no analysis', async () => {
    const db = await openTrainerDB();
    await putGame(game('g1', 1));
    await putGame(game('g2', 2)); // played but never analysed
    await db.put('gameAnalyses', analysisFor('g1'));
    const ids = await getAnalyzedGameIds();
    expect(ids.has('g1')).toBe(true);
    expect(ids.has('g2')).toBe(false);
    expect(ids.size).toBe(1);
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
