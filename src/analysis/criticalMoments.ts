// Pure selectors for the analysis view: the win-probability curve and the game's
// "critical moments" (biggest swings). No engine work — everything derives from the
// stored GameAnalysis (ADR-0021). No global accuracy grade is computed (honesty notes).

import type { GameAnalysis } from './types';
import { winPct } from './winProb';

export interface CurvePoint {
  /** Index into analysis.plies. */
  plyIndex: number;
  /** Win chance in [0,100], from the PLAYER's point of view. */
  winPct: number;
}

export interface CriticalMoment {
  plyIndex: number;
  ply: GameAnalysis['plies'][number];
  /** Whose move caused the swing. */
  side: 'player' | 'opponent';
  /** Win-probability points lost on this move (mover POV). */
  winProbLoss: number;
}

/** Player-POV win% after each ply. */
export function winCurve(analysis: GameAnalysis): CurvePoint[] {
  const playerWhite = analysis.playerColor === 'w';
  return analysis.plies.map((p, i) => {
    const white = winPct(p.playedWhiteCp);
    return { plyIndex: i, winPct: playerWhite ? white : 100 - white };
  });
}

export interface CriticalOptions {
  /** Max moments returned (default 5). */
  max?: number;
  /** Minimum win-prob loss to count (default 10 = a "mistake"). */
  minLoss?: number;
}

/** The biggest swings of the game, either side, ranked and capped. */
export function criticalMoments(analysis: GameAnalysis, opts: CriticalOptions = {}): CriticalMoment[] {
  const max = opts.max ?? 5;
  const minLoss = opts.minLoss ?? 10;
  return analysis.plies
    .map((ply, plyIndex) => ({
      plyIndex,
      ply,
      side: (ply.color === analysis.playerColor ? 'player' : 'opponent') as 'player' | 'opponent',
      winProbLoss: ply.winProbLoss,
    }))
    .filter((m) => m.winProbLoss >= minLoss)
    // Sort by loss desc; tie-break by ply index asc for determinism.
    .sort((a, b) => b.winProbLoss - a.winProbLoss || a.plyIndex - b.plyIndex)
    .slice(0, max);
}
