// "Only move" detection (PR-21 only-move, ADR-0079 — lifts the critical-moment §11 deferral).
// Ratified Q-E=c: the batch pass stays single-PV; a TARGETED MultiPV=2 re-pass runs only on the
// player's plies already classified mistake/blunder (the only plies the badge concerns), and the
// second-best eval persists as the additive `secondBestCp`. These helpers are the pure half.

import type { GameAnalysis, PlyAnalysis } from './types';

/** Mover-POV gap (cp) between the best and second-best move at fenBefore. */
export function onlyMoveGap(bestWhiteCp: number, secondBestCp: number, mover: 'w' | 'b'): number {
  const gap = bestWhiteCp - secondBestCp;
  return mover === 'w' ? gap : -gap;
}

/** The best move stood alone: everything else lost at least this much (mover POV). */
export const ONLY_MOVE_GAP_CP = 120;

/** True when the stored second-best eval says the best move was forced. Absent data → false
 *  (no measurement, no claim). */
export function isOnlyMove(p: Pick<PlyAnalysis, 'bestWhiteCp' | 'secondBestCp' | 'color'>): boolean {
  if (p.secondBestCp == null) return false;
  return onlyMoveGap(p.bestWhiteCp, p.secondBestCp, p.color) >= ONLY_MOVE_GAP_CP;
}

/** The Q-E=c target set: indices of the PLAYER's mistake/blunder plies. */
export function onlyMoveTargets(analysis: Pick<GameAnalysis, 'plies' | 'playerColor'>): number[] {
  const out: number[] = [];
  for (const p of analysis.plies) {
    if (p.color === analysis.playerColor && (p.severity === 'mistake' || p.severity === 'blunder')) {
      out.push(p.ply);
    }
  }
  return out;
}
