import { describe, it, expect } from 'vitest';
import { parse960Pgn, sanTokens } from './pgn960';
import { ChessGame } from '../game/ChessGame';
import { chess960PositionById, castleFromStartFen } from '../variant/chess960';

describe('sanTokens (PR-20)', () => {
  it('strips headers, comments, numbers, NAGs and results', () => {
    const pgn = '[Event "x"]\n\n1. e4 {[%clk 0:05:00]} e5 $1 2. Nf3 Nc6 1/2-1/2';
    expect(sanTokens(pgn)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });
});

describe('parse960Pgn (PR-20, ADR-0078 — replay through the shim)', () => {
  it('replays a game from a REAL 960 position and carries engine FENs per ply', () => {
    const pos = chess960PositionById(0); // bbqnnrkr — genuinely non-standard
    const g = new ChessGame(pos.startFen, { variant: 'chess960', castle: pos.castle });
    // Three quiet pawn moves — legal from any 960 start.
    for (const [from, to] of [['e2', 'e4'], ['e7', 'e5'], ['d2', 'd3']] as const) {
      expect(g.move(from, to)).toBeTruthy();
    }
    const parsed = parse960Pgn(g.pgn(), pos.startFen);
    expect(parsed.plies.length).toBe(3);
    expect(parsed.plies.map((p) => p.color)).toEqual(['w', 'b', 'w']);
    expect(parsed.plies[0].uci).toBe('e2e4');
    // UI FEN and engine FEN both present; the engine FEN carries the 960 castling encoding.
    for (const p of parsed.plies) {
      expect(p.fenBefore.split(' ').length).toBe(6);
      expect(p.engineFenBefore).toBeTruthy();
    }
    // Board field matches the start position (chess.js normalises the tail fields).
    expect(parsed.plies[0].fenBefore.split(' ')[0]).toBe(pos.startFen.split(' ')[0]);
  });

  it('SP-518 (the standard layout) replays including castling', () => {
    const pos = chess960PositionById(518); // RNBQKBNR — castling SAN is the standard O-O
    const g = new ChessGame(pos.startFen, { variant: 'chess960', castle: pos.castle });
    const moves: Array<[string, string]> = [
      ['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'], ['f8', 'c5'],
      ['e1', 'h1'], // 960 castling: king onto rook
    ];
    for (const [from, to] of moves) expect(g.move(from, to)).toBeTruthy();
    const parsed = parse960Pgn(g.pgn(), pos.startFen);
    expect(parsed.plies.length).toBe(7);
    expect(parsed.plies[6].san).toMatch(/O-O/);
  });

  it('throws loudly on an unresolvable SAN (never a silently wrong analysis)', () => {
    const pos = chess960PositionById(0);
    expect(() => parse960Pgn('[Event "x"]\n\n1. Qxh9 *', pos.startFen)).toThrow();
  });

  it('castleFromStartFen derives the shim config from the stored FEN', () => {
    const pos = chess960PositionById(37);
    expect(castleFromStartFen(pos.startFen)).toEqual(pos.castle);
  });
});
