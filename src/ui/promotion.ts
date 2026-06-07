// Promotion helpers shared by Board.svelte and its tests (audit W4). chessground's
// `after` event gives only (from, to); when the move is a pawn reaching the last rank
// the board must ask which piece. Kept here as pure functions so they're unit-testable
// without mounting the component.

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export const PROMOTION_ORDER: readonly PromotionPiece[] = ['q', 'r', 'b', 'n'];

export const PROMOTION_NAME: Record<PromotionPiece, string> = {
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
};

export const PROMOTION_GLYPH: Record<'white' | 'black', Record<PromotionPiece, string>> = {
  white: { q: '♕', r: '♖', b: '♗', n: '♘' },
  black: { q: '♛', r: '♜', b: '♝', n: '♞' },
};

/** The FEN piece letter on a square (e.g. 'P', 'k'), or null if empty/out of range. */
export function pieceAt(fen: string, sq: string): string | null {
  const rows = fen.split(' ')[0]?.split('/');
  if (!rows || rows.length !== 8) return null;
  const file = sq.charCodeAt(0) - 97; // 'a' → 0
  const rank = Number(sq[1]);
  if (file < 0 || file > 7 || !(rank >= 1 && rank <= 8)) return null;
  const row = rows[8 - rank];
  let i = 0;
  for (const ch of row) {
    if (ch >= '1' && ch <= '8') i += Number(ch);
    else {
      if (i === file) return ch;
      i++;
    }
  }
  return null;
}

/** True when moving from→to is a pawn reaching the last rank (needs a promotion choice). */
export function isPromotionMove(fen: string, from: string, to: string): boolean {
  const p = pieceAt(fen, from);
  if (p !== 'P' && p !== 'p') return false;
  return (p === 'P' && to[1] === '8') || (p === 'p' && to[1] === '1');
}
