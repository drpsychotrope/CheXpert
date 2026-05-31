// Thin wrapper over chess.js that exposes exactly what the UI (chessground) and
// the trainer need: a legal-destinations map, promotion handling, terminal-state
// detection, and FEN/PGN I/O. Rules logic stays in chess.js (headless).

import { Chess, type Square, type Move, type Color } from 'chess.js';

export type Dests = Map<string, string[]>;

export interface TerminalState {
  over: boolean;
  reason?: 'checkmate' | 'stalemate' | 'insufficient' | 'threefold' | 'fiftyMove' | 'draw';
  winner?: 'w' | 'b';
}

export class ChessGame {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  get fen(): string {
    return this.chess.fen();
  }

  get turn(): Color {
    return this.chess.turn();
  }

  load(fen: string): void {
    this.chess.load(fen);
  }

  loadPgn(pgn: string): void {
    this.chess.loadPgn(pgn);
  }

  pgn(): string {
    return this.chess.pgn();
  }

  history(): string[] {
    return this.chess.history();
  }

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  /** Legal destinations per origin square — the shape chessground wants. */
  dests(): Dests {
    const dests: Dests = new Map();
    for (const move of this.chess.moves({ verbose: true }) as Move[]) {
      const arr = dests.get(move.from);
      if (arr) arr.push(move.to);
      else dests.set(move.from, [move.to]);
    }
    return dests;
  }

  /**
   * Attempt a move. `promotion` defaults to queen. Returns the SAN on success,
   * or null if illegal (chess.js throws on illegal — we normalize to null).
   */
  move(from: string, to: string, promotion: 'q' | 'r' | 'b' | 'n' = 'q'): string | null {
    try {
      const m = this.chess.move({ from: from as Square, to: to as Square, promotion });
      return m ? m.san : null;
    } catch {
      return null;
    }
  }

  /** Play a move given in UCI long-algebraic form (e2e4, e7e8q). */
  moveUci(uci: string): string | null {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = (uci[4] as 'q' | 'r' | 'b' | 'n') || 'q';
    return this.move(from, to, promo);
  }

  /** True if moving from->to would be a pawn reaching the last rank. */
  isPromotion(from: string, to: string): boolean {
    const piece = this.chess.get(from as Square);
    if (!piece || piece.type !== 'p') return false;
    const rank = to[1];
    return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
  }

  undo(): void {
    this.chess.undo();
  }

  terminal(): TerminalState {
    if (this.chess.isCheckmate()) {
      // Side to move is checkmated → the other side won.
      return { over: true, reason: 'checkmate', winner: this.chess.turn() === 'w' ? 'b' : 'w' };
    }
    if (this.chess.isStalemate()) return { over: true, reason: 'stalemate' };
    if (this.chess.isInsufficientMaterial()) return { over: true, reason: 'insufficient' };
    if (this.chess.isThreefoldRepetition()) return { over: true, reason: 'threefold' };
    if (this.chess.isDraw()) return { over: true, reason: 'draw' };
    return { over: false };
  }
}
