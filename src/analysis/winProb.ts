// Win-probability model + gaffe classification (Q-F=a: classify by win-probability
// delta, not raw centipawns, because a 200cp swing means different things at ±50 vs
// ±900). Uses the Lichess logistic mapping from centipawns to win%.

import type { Severity } from './types';

/**
 * Convert a White-POV centipawn score to White's winning chance in [0, 1].
 * Lichess constant 0.00368208. Mate scores (clamped to ±100000 by
 * scoreToWhiteCp) saturate to ~0 or ~1 cleanly.
 */
export function winChance(whiteCp: number): number {
  return 1 / (1 + Math.exp(-0.00368208 * whiteCp));
}

/** White's win probability as a percentage in [0, 100]. */
export function winPct(whiteCp: number): number {
  return 100 * winChance(whiteCp);
}

export interface GaffeThresholds {
  /** Win% drop for the mover. Defaults: inaccuracy 5, mistake 10, blunder 20. */
  inaccuracy: number;
  mistake: number;
  blunder: number;
}

export const DEFAULT_THRESHOLDS: GaffeThresholds = {
  inaccuracy: 5,
  mistake: 10,
  blunder: 20,
};

/**
 * Win-probability points the mover lost by playing `playedWhiteCp` instead of the
 * best line `bestWhiteCp`. Always >= 0. Computed from the moving side's POV.
 */
export function winProbLoss(bestWhiteCp: number, playedWhiteCp: number, whiteToMove: boolean): number {
  const bestForMover = whiteToMove ? winPct(bestWhiteCp) : 100 - winPct(bestWhiteCp);
  const gotForMover = whiteToMove ? winPct(playedWhiteCp) : 100 - winPct(playedWhiteCp);
  return Math.max(0, bestForMover - gotForMover);
}

/** Centipawns the mover lost (>= 0), from the moving side's POV. */
export function cpLoss(bestWhiteCp: number, playedWhiteCp: number, whiteToMove: boolean): number {
  const diff = whiteToMove ? bestWhiteCp - playedWhiteCp : playedWhiteCp - bestWhiteCp;
  return Math.max(0, diff);
}

/** Classify a move by the win-probability points lost. */
export function classify(wpLoss: number, t: GaffeThresholds = DEFAULT_THRESHOLDS): Severity {
  if (wpLoss >= t.blunder) return 'blunder';
  if (wpLoss >= t.mistake) return 'mistake';
  if (wpLoss >= t.inaccuracy) return 'inaccuracy';
  if (wpLoss < 1) return 'best';
  return 'good';
}
