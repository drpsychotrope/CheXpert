import { describe, it, expect } from 'vitest';
import { gradeCalcLine, firstWrongUserMove, formatSanLine } from './calc';

// solutionMoves alternate user,opp,user,opp,... starting with the user's move.
const SOL = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7'];

describe('gradeCalcLine', () => {
  it('passes when the user supplies the whole correct line (user-side moves)', () => {
    const r = gradeCalcLine(SOL, ['e2e4', 'd1h5', 'f1c4', 'h5f7']);
    expect(r.correct).toBe(true);
    expect(r.solvedPlies).toBe(7);
  });

  it('fails at the first wrong user move and reports how far they got', () => {
    const r = gradeCalcLine(SOL, ['e2e4', 'd1f3', 'f1c4', 'h5f7']); // 2nd user move wrong
    expect(r.correct).toBe(false);
    expect(r.solvedPlies).toBe(2); // matched the first user move + opp reply
  });

  it('fails when the line is too short', () => {
    expect(gradeCalcLine(SOL, ['e2e4', 'd1h5']).correct).toBe(false);
  });

  it('tolerates a missing queen-promotion suffix', () => {
    expect(gradeCalcLine(['a7a8q'], ['a7a8']).correct).toBe(true);
  });
});

describe('firstWrongUserMove', () => {
  it('maps solvedPlies (even solution index) to a 1-based user-move number', () => {
    expect(firstWrongUserMove(0)).toBe(1); // first user move wrong
    expect(firstWrongUserMove(2)).toBe(2); // second user move wrong
    expect(firstWrongUserMove(4)).toBe(3);
    expect(firstWrongUserMove(6)).toBe(4);
  });
});

describe('formatSanLine', () => {
  it('numbers plies white-first', () => {
    expect(formatSanLine(['Nf3', 'e5', 'Bc4'])).toBe('1.Nf3 e5 2.Bc4');
  });
  it('handles a single ply (no black move)', () => {
    expect(formatSanLine(['Qxf7#'])).toBe('1.Qxf7#');
  });
  it('handles an empty line', () => {
    expect(formatSanLine([])).toBe('');
  });
});
