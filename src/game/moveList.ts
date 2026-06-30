// Pure, DOM-free move-list formatter (P2, play-in-game-ux §4 A1). Turns a flat SAN history
// (`ChessGame.history()` — SAN, 960-aware) into numbered render-shaped pairs for the in-game move
// list. This is the SINGLE numbering authority (AP-PLAYUX-1): the component must NOT re-derive pairs
// inline from `playedUci` (that list is UCI, not SAN, and would diverge on 960 castles).
//
// Pure: no Date / Math.random / DOM (mirrors the other pure cores). Variant-agnostic — it only
// formats SAN strings, so a 960 castle arrives as `O-O`/`O-O-O` and passes through verbatim. Handles
// a Black-first start (a 960 / loaded mid-game FEN whose side-to-move at ply 0 is Black) via
// `startSide`/`startMoveNo` so the numbering stays correct (mirrors the `pgn()` body builder logic in
// ChessGame.ts:127-136, but pure and render-shaped).

/** One rendered move-number row: the move number plus up to two plies (white/black). The `*Ply`
 *  fields are 0-based indices back into the source `sanHistory` — used for the latest-ply highlight,
 *  and they pre-position the future click target (DEFER D1) without P2 navigating with them. */
export interface MovePair {
  no: number;
  white?: string;
  black?: string;
  whitePly?: number;
  blackPly?: number;
}

/**
 * Build numbered move pairs from a flat SAN history.
 *
 * @param sanHistory SAN strings in play order (e.g. `['e4','e5','Nf3']`).
 * @param startSide   Side to move at ply 0 — `'w'` for the standard start, `'b'` for a Black-first
 *                    position (960 / a loaded mid-game FEN). Default `'w'`.
 * @param startMoveNo The move number of the first row (the FEN fullmove counter). Default `1`.
 * @returns Numbered pairs; an empty history yields `[]`. A Black-first start produces a leading
 *          pair whose `white` is absent (rendered as `1... e5` by the caller).
 */
export function toMovePairs(
  sanHistory: string[],
  startSide: 'w' | 'b' = 'w',
  startMoveNo = 1,
): MovePair[] {
  const pairs: MovePair[] = [];
  let moveNo = startMoveNo;
  // Whose ply the NEXT unconsumed SAN belongs to. Flips every ply.
  let whiteToMove = startSide === 'w';
  let current: MovePair | null = null;

  for (let ply = 0; ply < sanHistory.length; ply++) {
    const san = sanHistory[ply];
    if (whiteToMove) {
      // A white ply always opens a fresh numbered row.
      current = { no: moveNo, white: san, whitePly: ply };
      pairs.push(current);
    } else {
      if (current) {
        current.black = san;
        current.blackPly = ply;
      } else {
        // Black-first row (no white ply this number): `1... e5`.
        current = { no: moveNo, black: san, blackPly: ply };
        pairs.push(current);
      }
      // A completed (or black-first) row advances the move number; the next white ply opens anew.
      moveNo++;
      current = null;
    }
    whiteToMove = !whiteToMove;
  }
  return pairs;
}
