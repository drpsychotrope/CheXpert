// Internal puzzle format. NOTE: we normalize to "user is to move in `fen`, and
// moves[0] is the user's first move". This differs from the raw Lichess CSV
// (where the FEN is one ply BEFORE the user's turn and Moves[0] is the opponent's
// setup move). The ETL (scripts/build-puzzle-subset.mjs) performs that conversion
// once, so the app only ever deals with this normalized shape.

export interface Puzzle {
  id: string;
  /** Position with the SOLVER to move. */
  fen: string;
  /** UCI moves, alternating: [user, opponent, user, opponent, ...]. */
  moves: string[];
  rating: number;
  ratingDeviation: number;
  themes: string[];
  source: 'curated' | 'personal';
  /** Optional: opening tag / source game for personal puzzles (Phase 2). */
  meta?: Record<string, string>;
}

/** Coarse phase bucket from a FEN, for theme/phase filtering (spec §3 trainer). */
export function phaseOf(fen: string): 'opening' | 'middlegame' | 'endgame' {
  const board = fen.split(' ')[0];
  const pieces = board.replace(/[^a-zA-Z]/g, '').length;
  // Count heavy material to disambiguate.
  const majors = (board.match(/[qrQR]/g) || []).length;
  if (pieces <= 12 || majors <= 2) return 'endgame';
  if (pieces >= 26) return 'opening';
  return 'middlegame';
}
