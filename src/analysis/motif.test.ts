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

  // --- Geometric detectors (spec motif-detectors, extends ADR-0007) ---------

  it('tags an absolute pin (piece pinned to the king)', () => {
    // Bf1-b5: bishop on b5 hits Nc6, behind it (d7 empty) the king on e8.
    const m = detectMotif({
      fenBefore: '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1',
      bestUci: 'f1b5',
      phase: 'middlegame',
      severity: 'mistake',
    });
    expect(m.confidence).toBe('high');
    expect(m.tags).toContain('pin');
    expect(m.tags).toContain('absolutePin');
  });

  it('tags a relative pin (minor pinned in front of a rook)', () => {
    // Bf1-b5: hits Nc6 (front, 3) with Rd7 (back, 5) behind it. Not a skewer.
    const m = detectMotif({
      fenBefore: '7k/3r4/2n5/8/8/8/8/4KB2 w - - 0 1',
      bestUci: 'f1b5',
      phase: 'middlegame',
      severity: 'mistake',
    });
    expect(m.confidence).toBe('high');
    expect(m.tags).toContain('pin');
    expect(m.tags).toContain('relativePin');
    expect(m.tags).not.toContain('skewer');
  });

  it('does NOT tag a pin when nothing stands behind the attacked piece', () => {
    // Bf1-b5 hits Nc6 but d7/e8 are empty (king on a8): no back piece → no pin.
    const m = detectMotif({
      fenBefore: 'k7/8/2n5/8/8/8/8/4KB2 w - - 0 1',
      bestUci: 'f1b5',
      phase: 'middlegame',
      severity: 'mistake',
    });
    expect(m.confidence).toBe('low');
    expect(m.tags).not.toContain('pin');
  });

  it('tags a skewer (more valuable piece in front)', () => {
    // Bf1-b5: hits Qc6 (front, 9) with Rd7 (back, 5) behind → skewer, not pin.
    const m = detectMotif({
      fenBefore: '7k/3r4/2q5/8/8/8/8/4KB2 w - - 0 1',
      bestUci: 'f1b5',
      phase: 'middlegame',
      severity: 'blunder',
    });
    expect(m.confidence).toBe('high');
    expect(m.tags).toContain('skewer');
    expect(m.tags).not.toContain('pin');
  });

  it('tags a discovered attack (vacating a square unveils a rook on the queen)', () => {
    // Nd4-f5 clears the d-file; Rd1 now hits Qd8. Target is not the king.
    const m = detectMotif({
      fenBefore: '3q2k1/8/8/8/3N4/8/8/3RK3 w - - 0 1',
      bestUci: 'd4f5',
      phase: 'middlegame',
      severity: 'blunder',
    });
    expect(m.confidence).toBe('high');
    expect(m.tags).toContain('discoveredAttack');
    expect(m.tags).not.toContain('discoveredCheck');
    expect(m.tags).not.toContain('doubleCheck');
  });

  it('does NOT tag a discovered attack when the line is still blocked', () => {
    // A black pawn on d6 still blocks Rd1 after Nd4-f5 moves: no discovery.
    const m = detectMotif({
      fenBefore: '3q2k1/8/3p4/8/3N4/8/8/3RK3 w - - 0 1',
      bestUci: 'd4f5',
      phase: 'middlegame',
      severity: 'mistake',
    });
    expect(m.confidence).toBe('low');
    expect(m.tags).not.toContain('discoveredAttack');
  });

  it('tags a double check (knight checks while unveiling a rook check)', () => {
    // Nd4-e6+: the knight checks Kd8 AND unveils Rd1 down the d-file.
    const m = detectMotif({
      fenBefore: '3k4/8/8/8/3N4/8/8/3RK3 w - - 0 1',
      bestUci: 'd4e6',
      phase: 'middlegame',
      severity: 'blunder',
    });
    expect(m.confidence).toBe('high');
    expect(m.tags).toContain('doubleCheck');
    expect(m.tags).toContain('discoveredCheck');
  });

  it('does NOT tag a double check for a single discovered check', () => {
    // Nd4-f3 unveils Rd1's check but the knight itself does not check d8.
    const m = detectMotif({
      fenBefore: '3k4/8/8/8/3N4/8/8/3RK3 w - - 0 1',
      bestUci: 'd4f3',
      phase: 'middlegame',
      severity: 'blunder',
    });
    expect(m.tags).toContain('discoveredCheck');
    expect(m.tags).not.toContain('doubleCheck');
  });
});
