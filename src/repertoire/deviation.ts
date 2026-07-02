// Repertoire-deviation detector (PR-13 repertoire-deviation, ADR-0071). The analysis always
// named where a game left the GENERAL book (firstOutOfBook); nobody ever cross-checked a game
// against the player's OWN committed lines. Pure: the caller loads the lines and the game's UCI
// list; this reports the deepest-matching line's first divergence — the exact card to review.

import type { RepertoireLine } from './types';

export interface Deviation {
  lineId: string;
  lineName: string;
  /** 0-based ply index of the first divergence. */
  ply: number;
  /** 1-based full-move number of that ply (display). */
  moveNumber: number;
  /** What the line prescribes at that ply (SAN). */
  expectedSan: string;
  /** What was actually played (SAN). */
  playedSan: string;
  /** True when the analysed PLAYER deviated from their own line; false when the opponent
   *  left it (an extension opportunity, not a mistake). */
  byPlayer: boolean;
}

/** A line must match at least this many plies before we call the game "in" that line —
 *  1. e4 alone matching a hundred lines would spam false deviations. */
export const MIN_MATCHED_PLIES = 2;

/**
 * Deepest-matching line of the player's colour, first divergence within it. Returns null when
 * no line is in play (< MIN_MATCHED_PLIES matched), when the game FOLLOWED the whole line
 * (success — nothing to report), or when the game ended inside the line.
 */
export function findDeviation(
  lines: RepertoireLine[],
  playedUci: string[],
  playedSan: string[],
  playerColor: 'w' | 'b',
): Deviation | null {
  let best: { line: RepertoireLine; matched: number } | null = null;
  for (const line of lines) {
    if (line.color !== playerColor) continue;
    let matched = 0;
    while (matched < line.moves.length && matched < playedUci.length && line.moves[matched] === playedUci[matched]) {
      matched++;
    }
    if (matched < MIN_MATCHED_PLIES) continue;
    if (!best || matched > best.matched) best = { line, matched };
  }
  if (!best) return null;
  const { line, matched } = best;
  // Whole line followed, or the game ended while still inside it → nothing to flag.
  if (matched >= line.moves.length || matched >= playedUci.length) return null;
  const deviatorIsWhite = matched % 2 === 0;
  return {
    lineId: line.id,
    lineName: line.name,
    ply: matched,
    moveNumber: Math.floor(matched / 2) + 1,
    expectedSan: line.san[matched] ?? line.moves[matched],
    playedSan: playedSan[matched] ?? playedUci[matched],
    byPlayer: (playerColor === 'w') === deviatorIsWhite,
  };
}
