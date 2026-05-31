import { describe, it, expect } from 'vitest';
import { TacticalTrainer, sameMove, gradeAttempt } from './TacticalTrainer';
import type { Puzzle } from './puzzle';
import { defaultRating } from '../rating/glicko2';

const matePuzzle: Puzzle = {
  id: 't1',
  fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
  moves: ['a1a8'],
  rating: 700,
  ratingDeviation: 80,
  themes: ['mate', 'mateIn1'],
  source: 'curated',
};

const multiPuzzle: Puzzle = {
  id: 't2',
  fen: '7k/8/3q4/6N1/8/8/8/6K1 w - - 0 1',
  moves: ['g5f7', 'h8g8', 'f7d6'],
  rating: 1100,
  ratingDeviation: 90,
  themes: ['fork'],
  source: 'curated',
};

describe('TacticalTrainer (active recall)', () => {
  it('solves a one-move puzzle when the correct move is played', () => {
    const t = new TacticalTrainer(matePuzzle, 0);
    expect(t.playUserMove('a1a8')).toBe('solved');
    expect(t.state.status).toBe('solved');
  });

  it('fails the puzzle on a wrong move (no auto-solution)', () => {
    const t = new TacticalTrainer(matePuzzle, 0);
    expect(t.playUserMove('g1h1')).toBe('wrong');
    expect(t.state.status).toBe('failed');
  });

  it('walks a multi-move line, auto-playing the opponent reply', () => {
    const t = new TacticalTrainer(multiPuzzle, 0);
    expect(t.playUserMove('g5f7')).toBe('correct'); // check; opponent Kg8 auto-played
    expect(t.playUserMove('f7d6')).toBe('solved'); // wins the queen
  });

  it('tolerates promotion suffix differences', () => {
    expect(sameMove('e7e8', 'e7e8q')).toBe(true);
    expect(sameMove('e7e8q', 'e7e8r')).toBe(false);
  });

  it('grading raises the player rating on solve and lowers it on fail', () => {
    const base = defaultRating(1000, 200, 0.06);
    const solved = gradeAttempt(base, matePuzzle, true);
    const failed = gradeAttempt(base, matePuzzle, false);
    expect(solved.player.rating).toBeGreaterThan(base.rating);
    expect(failed.player.rating).toBeLessThan(base.rating);
    // Puzzle rating moves opposite to the player.
    expect(solved.puzzle.rating).toBeLessThan(matePuzzle.rating);
  });
});
