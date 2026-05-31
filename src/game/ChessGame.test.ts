import { describe, it, expect } from 'vitest';
import { ChessGame } from './ChessGame';

describe('ChessGame', () => {
  it('starts from the initial position with 20 legal first moves', () => {
    const g = new ChessGame();
    const dests = g.dests();
    let total = 0;
    for (const arr of dests.values()) total += arr.length;
    expect(total).toBe(20);
    expect(g.turn).toBe('w');
  });

  it('accepts a legal move and rejects an illegal one', () => {
    const g = new ChessGame();
    expect(g.move('e2', 'e4')).toBe('e4');
    expect(g.move('e2', 'e5')).toBeNull(); // nothing on e2 now
  });

  it('plays UCI moves including promotion', () => {
    const g = new ChessGame('8/P7/8/8/8/8/8/k6K w - - 0 1');
    expect(g.isPromotion('a7', 'a8')).toBe(true);
    // Queen on a8 vs the black king on a1 (same file) gives check → SAN includes '+'.
    expect(g.moveUci('a7a8q')).toBe('a8=Q+');
  });

  it('detects checkmate and the winner', () => {
    // Fool's mate position after 1.f3 e5 2.g4 Qh4#
    const g = new ChessGame();
    g.moveUci('f2f3');
    g.moveUci('e7e5');
    g.moveUci('g2g4');
    g.moveUci('d8h4');
    const t = g.terminal();
    expect(t.over).toBe(true);
    expect(t.reason).toBe('checkmate');
    expect(t.winner).toBe('b');
  });

  it('round-trips FEN', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const g = new ChessGame(fen);
    expect(g.fen).toBe(fen);
  });
});
