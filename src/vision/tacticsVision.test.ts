import { describe, it, expect } from 'vitest';
import { allChecks, allCaptures, hangingPieces } from './tacticsVision';

describe('board-vision generators', () => {
  it('allChecks finds a checking move', () => {
    // White Ra1 → a8+ checks the black king on g8 along the 8th rank.
    expect(allChecks('6k1/8/8/8/8/8/5PPP/R5K1 w - - 0 1')).toContain('a1a8');
  });

  it('allChecks is empty when no check is available', () => {
    expect(allChecks('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toHaveLength(0);
  });

  it('allCaptures finds an available capture', () => {
    // White e4 pawn can take d5.
    expect(allCaptures('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1')).toContain('e4d5');
  });

  it('hangingPieces flags a free enemy piece', () => {
    // White Rd1 wins the undefended black queen on d5.
    expect(hangingPieces('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1')).toContain('d5');
  });

  it('hangingPieces ignores a defended equal trade', () => {
    // Black pawn c6 defends d5; White pawn e4 takes d5 but it is recaptured — not hanging.
    expect(hangingPieces('4k3/8/2p5/3p4/4P3/8/8/4K3 w - - 0 1')).not.toContain('d5');
  });
});
