// Blindfold drill primitives (ADR-0043). Pure: read a piece off a FEN, and generate a
// single-square query deterministically. Colour is part of the answer (case-sensitive FEN char).

import { allSquares } from './vision';

/** Piece on `square` as the case-sensitive FEN char ('N' white knight, 'n' black), or null. */
export function pieceAt(fen: string, square: string): string | null {
  if (!/^[a-h][1-8]$/.test(square)) return null;
  const ranks = fen.split(' ')[0].split('/'); // ranks[0] = rank 8 … ranks[7] = rank 1
  if (ranks.length !== 8) return null;
  const file = 'abcdefgh'.indexOf(square[0]);
  const row = ranks[8 - Number(square[1])];
  let f = 0;
  for (const ch of row) {
    if (ch >= '1' && ch <= '8') {
      const n = Number(ch);
      if (file < f + n) return null; // target square lies inside this empty run
      f += n;
    } else {
      if (f === file) return ch;
      f += 1;
    }
    if (f > file) break;
  }
  return null;
}

const SQ = allSquares();

/** Deterministic blindfold query from a pick in [0,1): which square, and the truth there. */
export function genBlindfold(fen: string, pick: number): { square: string; answer: string | null } {
  const i = Math.min(63, Math.max(0, Math.floor(pick * 64)));
  const square = SQ[i];
  return { square, answer: pieceAt(fen, square) };
}
