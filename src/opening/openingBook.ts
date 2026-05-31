// Loop closure — the opponent reads the weakness profile and biases the OPENING
// toward the player's weak dimension (spec §4 item 1, ADR-0014). This is the payoff
// of the whole architecture: losses → puzzles → profile → an opponent that probes
// the same gaps.
//
// HONEST mechanism (AP-CHESS-22: bias, don't obsess): we do NOT bend the engine's
// strength or force a structure move-by-move. We pick the bot's OPENING from a small
// curated book, weighting toward an opening statistically associated with the
// player's weakest dimension. The engine still plays at the calibrated ~55% Elo, so
// the flow band is preserved. When the player leaves book, the engine takes over.
//
// Each entry lists the line as UCI moves from the start (both sides alternating);
// the bot plays its colour's moves while the game follows the prefix.

import type { Dimension } from '../analysis/weakness';

export interface OpeningEntry {
  id: string;
  name: string;
  /** The colour the BOT plays in this line. */
  botColor: 'w' | 'b';
  /** Line as UCI moves from startpos, alternating w,b,w,b… */
  moves: string[];
  /** Which weak dimension this opening tends to exercise. */
  targets: Dimension;
}

// A deliberately small, correctness-checked book. Each line is a few mainline
// moves — enough to steer the structure, not a full repertoire.
export const OPENING_BOOK: OpeningEntry[] = [
  // --- tactics: sharp open games / gambits → tactical middlegames ---
  { id: 'italian-w', name: 'Italian Game', botColor: 'w', targets: 'tactics',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] },
  { id: 'scotch-w', name: 'Scotch Game', botColor: 'w', targets: 'tactics',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4'] },
  { id: 'kingsgambit-w', name: "King's Gambit", botColor: 'w', targets: 'tactics',
    moves: ['e2e4', 'e7e5', 'f2f4'] },
  { id: 'openSicilian-w', name: 'Open Sicilian', botColor: 'w', targets: 'tactics',
    moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4'] },

  // --- openingAccuracy: heavy-theory mainlines → precise opening play rewarded ---
  { id: 'ruylopez-w', name: 'Ruy López', botColor: 'w', targets: 'openingAccuracy',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'] },
  { id: 'qgd-w', name: "Queen's Gambit", botColor: 'w', targets: 'openingAccuracy',
    moves: ['d2d4', 'd7d5', 'c2c4'] },
  { id: 'ruylopez-b', name: 'Ruy López (as Black)', botColor: 'b', targets: 'openingAccuracy',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'] },

  // --- endgameConversion: exchange lines / symmetry → reach endgames sooner ---
  { id: 'exchangeFrench-w', name: 'Exchange French', botColor: 'w', targets: 'endgameConversion',
    moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4d5', 'e6d5'] },
  { id: 'exchangeSlav-w', name: 'Exchange Slav', botColor: 'w', targets: 'endgameConversion',
    moves: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'c4d5', 'c6d5'] },
  { id: 'symmEnglish-w', name: 'Symmetrical English', botColor: 'w', targets: 'endgameConversion',
    moves: ['c2c4', 'c7c5'] },

  // --- resilience: gambit accepted as the worse side → practise recovering ---
  // The bot (Black) accepts space/initiative so the PLAYER must convert/press,
  // and vice-versa positions force the player to defend.
  { id: 'scandi-b', name: 'Scandinavian', botColor: 'b', targets: 'resilience',
    moves: ['e2e4', 'd7d5'] },
  { id: 'philidor-b', name: 'Philidor Defence', botColor: 'b', targets: 'resilience',
    moves: ['e2e4', 'e7e5', 'g1f3', 'd7d6'] },

  // --- timeManagement: no opening steers a clock habit; use neutral variety ---
  { id: 'london-w', name: 'London System', botColor: 'w', targets: 'timeManagement',
    moves: ['d2d4', 'd7d5', 'c1f4'] },
  { id: 'caro-b', name: 'Caro-Kann', botColor: 'b', targets: 'timeManagement',
    moves: ['e2e4', 'c7c6'] },
];

/**
 * Pick an opening for the bot to play, biased toward the player's weakest
 * dimension while preserving variety (AP-CHESS-22). Deterministic given `pick`
 * (0..1) so callers vary it per game without Math.random in pure code.
 *
 * Weighting: openings targeting the weak dimension get weight 3; everything else
 * weight 1. So the weak area dominates (~roughly 3:1) but other openings still
 * appear — the bot probes the gap without becoming a one-note machine.
 */
export function selectOpening(
  botColor: 'w' | 'b',
  weakest: Dimension | null,
  pick: number,
): OpeningEntry {
  const pool = OPENING_BOOK.filter((o) => o.botColor === botColor);
  if (pool.length === 0) {
    // Fallback: any opening (shouldn't happen — book covers both colours).
    return OPENING_BOOK[0];
  }
  const weight = (o: OpeningEntry) => (weakest && o.targets === weakest ? 3 : 1);
  const total = pool.reduce((s, o) => s + weight(o), 0);
  let r = Math.min(0.999999, Math.max(0, pick)) * total;
  for (const o of pool) {
    r -= weight(o);
    if (r < 0) return o;
  }
  return pool[pool.length - 1];
}

/**
 * Given the moves played so far (UCI) and a chosen opening, return the bot's next
 * book move, or null if the game has left the book (player deviated, or line done).
 * The bot only plays a book move on its own turn.
 */
export function nextBookMove(opening: OpeningEntry, playedUci: string[]): string | null {
  // The game must still match the book prefix exactly.
  if (playedUci.length >= opening.moves.length) return null;
  for (let i = 0; i < playedUci.length; i++) {
    if (playedUci[i] !== opening.moves[i]) return null; // off book
  }
  // It must be the bot's turn: even index = White's move.
  const nextIsWhite = playedUci.length % 2 === 0;
  const botIsWhite = opening.botColor === 'w';
  if (nextIsWhite !== botIsWhite) return null; // it's the player's move
  return opening.moves[playedUci.length];
}

const DIMENSION_LABEL: Record<Dimension, string> = {
  tactics: 'tactics',
  openingAccuracy: 'opening accuracy',
  endgameConversion: 'endgame conversion',
  timeManagement: 'time management',
  resilience: 'resilience',
};

export function steeringNote(opening: OpeningEntry, weakest: Dimension | null): string {
  if (weakest && opening.targets === weakest) {
    return `Steering toward your weakest area (${DIMENSION_LABEL[weakest]}) with the ${opening.name}.`;
  }
  return `Playing the ${opening.name}.`;
}
