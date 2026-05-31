// UCI text-protocol parsing helpers. Pure functions — unit-testable without a worker.

export interface ScoreInfo {
  /** Centipawns from the side-to-move POV (positive = better for stm). */
  cp?: number;
  /** Mate in N (signed; positive = stm mates in N). */
  mate?: number;
  depth?: number;
}

/** Parse an `info ... score cp X` / `score mate Y` line. */
export function parseInfo(line: string): ScoreInfo | null {
  if (!line.startsWith('info')) return null;
  const out: ScoreInfo = {};
  const depthMatch = line.match(/\bdepth (\d+)/);
  if (depthMatch) out.depth = Number(depthMatch[1]);
  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  if (cpMatch) out.cp = Number(cpMatch[1]);
  const mateMatch = line.match(/\bscore mate (-?\d+)/);
  if (mateMatch) out.mate = Number(mateMatch[1]);
  return out.cp !== undefined || out.mate !== undefined || out.depth !== undefined ? out : null;
}

/** Parse a `bestmove e2e4 [ponder ...]` line → "e2e4" (or null). */
export function parseBestmove(line: string): string | null {
  const m = line.match(/^bestmove (\S+)/);
  if (!m) return null;
  return m[1] === '(none)' ? null : m[1];
}

/**
 * Convert an engine score (from the mover's POV) to a White-POV centipawn value,
 * clamping mate scores to a large finite number so downstream math is stable.
 */
export function scoreToWhiteCp(score: ScoreInfo, whiteToMove: boolean): number {
  const MATE_CP = 100000;
  let stmCp: number;
  if (score.mate !== undefined) {
    stmCp = score.mate > 0 ? MATE_CP - score.mate : -MATE_CP - score.mate;
  } else {
    stmCp = score.cp ?? 0;
  }
  return whiteToMove ? stmCp : -stmCp;
}
