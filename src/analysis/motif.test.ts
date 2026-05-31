import { describe, it, expect } from 'vitest';
import { detectMotif } from './motif';

describe('detectMotif', () => {
  it('tags a missed mate (high confidence)', () => {
    const m = detectMotif({
      fenBefore: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
      bestUci: 'a1a8',
      mate: 1,
      phase: 'endgame',
      severity: 'blunder',
    });
    expect(m.confidence).toBe('high');
    expect(m.tags).toContain('mate');
    expect(m.tags).toContain('mateIn1');
    expect(m.tags).toContain('backRankMate');
  });

  it('tags a missed hanging piece capture (high confidence)', () => {
    // White rook on d1 can take an undefended black queen on d5.
    const m = detectMotif({
      fenBefore: '7k/8/8/3q4/8/8/8/3R2K1 w - - 0 1',
      bestUci: 'd1d5',
      phase: 'middlegame',
      severity: 'blunder',
    });
    expect(m.confidence).toBe('high');
    expect(m.tags).toContain('hangingPiece');
  });

  it('tags a missed knight fork (high confidence)', () => {
    // Knight e5 -> d7 forks the king on b8 and rook on f8.
    const m = detectMotif({
      fenBefore: '1k3r2/8/8/4N3/8/8/8/6K1 w - - 0 1',
      bestUci: 'e5d7',
      phase: 'middlegame',
      severity: 'mistake',
    });
    expect(m.confidence).toBe('high');
    expect(m.tags).toContain('fork');
    expect(m.tags).toContain('knightFork');
  });

  it('falls back to phase + magnitude when no detector fires (low confidence)', () => {
    // A quiet pawn push that captures/checks nothing.
    const m = detectMotif({
      fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      bestUci: 'd2d4',
      phase: 'opening',
      severity: 'mistake',
    });
    expect(m.confidence).toBe('low');
    expect(m.tag).toBe('openingMistake');
  });

  it('handles a null best move with the fallback', () => {
    const m = detectMotif({
      fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      bestUci: null,
      phase: 'middlegame',
      severity: 'blunder',
    });
    expect(m.confidence).toBe('low');
    expect(m.tag).toBe('middlegameMistake');
  });
});
