// Wrapper-level chess-rule coverage that the existing tests left as blind spots
// (audit W9): stalemate, insufficient material, threefold (standard), fifty-move,
// en passant, and under-promotion — plus the Chess960 regressions fixed in W5
// (repetition + PGN surviving a manual castle).

import { describe, it, expect } from 'vitest';
import { ChessGame } from './ChessGame';
import { chess960PositionById } from '../variant/chess960';

describe('ChessGame — rule terminal states (W9)', () => {
  it('detects stalemate', () => {
    // Black king a8 has no legal move and is not in check.
    const g = new ChessGame('k7/8/1Q6/8/8/8/8/7K b - - 0 1');
    expect(g.terminal()).toEqual({ over: true, reason: 'stalemate' });
  });

  it('detects insufficient material (K vs K)', () => {
    const g = new ChessGame('8/8/8/4k3/8/8/4K3/8 w - - 0 1');
    expect(g.terminal()).toEqual({ over: true, reason: 'insufficient' });
  });

  it('detects threefold repetition (standard)', () => {
    const g = new ChessGame();
    // Shuffle both knights back to the start position twice more (3 occurrences total).
    for (const u of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) {
      expect(g.moveUci(u)).toBeTruthy();
    }
    expect(g.terminal().reason).toBe('threefold');
  });

  it('detects the fifty-move rule (reported as a draw)', () => {
    // K+R vs K (sufficient material) with the halfmove clock already at 100.
    const g = new ChessGame('4k3/8/4K3/8/8/8/8/4R3 w - - 100 60');
    expect(g.terminal()).toEqual({ over: true, reason: 'draw' });
  });

  it('plays en passant (destination offered + SAN correct)', () => {
    const g = new ChessGame();
    for (const u of ['e2e4', 'a7a6', 'e4e5', 'd7d5']) expect(g.moveUci(u)).toBeTruthy();
    expect(g.dests().get('e5')).toContain('d6'); // EP target offered
    expect(g.move('e5', 'd6')).toBe('exd6'); // executed as an en-passant capture
  });

  it('supports under-promotion to a knight', () => {
    const g = new ChessGame('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(g.move('a7', 'a8', 'n')).toBe('a8=N');
    const g2 = new ChessGame('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(g2.moveUci('a7a8n')).toBe('a8=N'); // UCI path also under-promotes
  });
});

describe('ChessGame — Chess960 regressions (W5)', () => {
  it('detects threefold repetition across the shim (post-setup)', () => {
    const pos = chess960PositionById(518); // 518 = the standard arrangement
    const g = new ChessGame(pos.startFen, { variant: 'chess960', castle: pos.castle });
    for (const u of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) {
      expect(g.moveUci(u)).toBeTruthy();
    }
    expect(g.terminal().reason).toBe('threefold');
  });

  it('rebuilds a complete PGN after a 960 castle (no truncation)', () => {
    const pos = chess960PositionById(518);
    const g = new ChessGame(pos.startFen, { variant: 'chess960', castle: pos.castle });
    for (const u of ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6']) {
      expect(g.moveUci(u)).toBeTruthy();
    }
    expect(g.move('e1', 'h1')).toBe('O-O'); // king onto own rook = kingside castle
    const pgn = g.pgn();
    expect(pgn).toContain('[Variant "Chess960"]');
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain('O-O'); // the castle is present (chess.js pgn() would have dropped earlier moves)
    expect(pgn).toContain('1. e4 e5'); // and so is the opening, proving no truncation
  });
});
