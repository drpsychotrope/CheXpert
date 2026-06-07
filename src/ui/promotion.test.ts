import { describe, it, expect } from 'vitest';
import { isPromotionMove, pieceAt } from './promotion';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('promotion helpers (W4)', () => {
  it('reads a piece off the FEN board', () => {
    expect(pieceAt(START, 'e1')).toBe('K');
    expect(pieceAt(START, 'e8')).toBe('k');
    expect(pieceAt(START, 'a2')).toBe('P');
    expect(pieceAt(START, 'h7')).toBe('p');
    expect(pieceAt(START, 'e4')).toBe(null);
  });

  it('detects a white pawn reaching the 8th rank', () => {
    expect(isPromotionMove('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7', 'a8')).toBe(true);
  });

  it('detects a black pawn reaching the 1st rank', () => {
    expect(isPromotionMove('4k3/8/8/8/8/8/7p/4K3 b - - 0 1', 'h2', 'h1')).toBe(true);
  });

  it('is false for a non-pawn move or a pawn not reaching the last rank', () => {
    expect(isPromotionMove(START, 'g1', 'f3')).toBe(false); // knight
    expect(isPromotionMove(START, 'e2', 'e4')).toBe(false); // pawn, not last rank
  });
});
