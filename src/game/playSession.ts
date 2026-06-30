// Pure, testable game-session logic extracted from Play.svelte (audit W12): the bot's
// clock-aware move budget, FIDE Art. 6.9 flag resolution, and folding a finished game into a
// rating pool. Kept DOM-free so each piece can be unit-tested without mounting the component.

import type { Category } from '../clock/categories';
import { insufficientMatingMaterial } from '../clock/categories';
import type { Side } from '../clock/Clock';
import { recordGame, type GameOutcome, type OpponentState } from '../engine/AdaptiveOpponent';
import { updateRating, type Rating } from '../rating/glicko2';

export type BudgetBounds = Record<Category, [number, number]>;

/** Per-category [floor, ceil] ms budget for the bot's move (spec §4.3, Q-D). */
export const BUDGET_BOUNDS: BudgetBounds = {
  bullet: [40, 250],
  blitz: [80, 500],
  rapid: [150, 1200],
  classical: [200, 2000],
};

/** Clock-aware bot movetime: scale with the bot's remaining time using a phase-aware moves-left
 *  estimate, clamped per category. Pure. */
export function botMovetime(remainingMs: number, ply: number, cat: Category, bounds: BudgetBounds = BUDGET_BOUNDS): number {
  const movesLeft = Math.max(8, 40 - Math.floor(ply / 2));
  const raw = remainingMs / movesLeft;
  const [floor, ceil] = bounds[cat];
  return Math.round(Math.min(ceil, Math.max(floor, raw)));
}

/** Resolve a flag-fall per FIDE Art. 6.9: if the side that did NOT flag has no mating material it's
 *  a draw; otherwise the flagging side loses. Outcome is from the player's POV. Pure. */
export function flagOutcome(flaggedSide: Side, playerSideClock: Side, fen: string): { outcome: GameOutcome; draw: boolean } {
  const winnerSide: Side = flaggedSide === 'w' ? 'b' : 'w';
  if (insufficientMatingMaterial(fen, winnerSide)) return { outcome: 'draw', draw: true };
  return { outcome: flaggedSide === playerSideClock ? 'loss' : 'win', draw: false };
}

/** Fold a finished game into a pool: nudge the adaptive opponent toward the ~55% band and update
 *  the Glicko rating via one match vs the bot Elo. Pure — the caller assigns the results back. */
export function applyGameResult(
  prevRating: Rating,
  prevOpp: OpponentState,
  outcome: GameOutcome,
  botElo: number,
): { nextOpp: OpponentState; nextRating: Rating } {
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const nextOpp = recordGame({ targetElo: prevOpp.targetElo, recent: prevOpp.recent }, outcome);
  const nextRating = updateRating(prevRating, [{ opponentRating: botElo, opponentRd: 60, score }]);
  return { nextOpp, nextRating };
}

/** Rating-integrity policy (P2/ADR-0058): a game counts toward the rating UNLESS it was marked
 *  un-counted by an in-play takeback. `finishGame` calls this to decide whether to run
 *  `applyGameResult` + persist the rating. Pure — the single decision authority for the skip so the
 *  abuse vector (undo a blunder, keep the gain) is closed in one testable place (AP-PLAYUX-3). */
export function shouldRate(unrated: boolean): boolean {
  return !unrated;
}

/** Pure takeback-eligibility core (P2/FOLD A4 + AP-PLAYUX-10). Given how many plies have been played
 *  and which side the human is, decide whether an in-play takeback is structurally possible — i.e.
 *  the PLAYER has actually made a move that can be undone, so undoing the bot's reply + that player
 *  move lands back on the player's turn.
 *
 *  The degenerate case this closes: a Black player at ply 1 (the bot has just opened, the player has
 *  not moved) must NOT be able to "take back" the bot's opening move (that would empty the board with
 *  the bot still to move). White needs ≥ 2 plies (player move + bot reply); Black needs ≥ 3 (bot
 *  opener + player move + bot reply). Derived from whose turn it is + how many plies exist, NOT a
 *  magic constant. The component still ANDs this with the live/turn/analysis gates — this is the
 *  "has the player moved?" half only. Pure, fully unit-tested. */
export function canTakeBackInPlay(historyLength: number, playerColor: 'white' | 'black'): boolean {
  // The player's first move is at ply index 0 (White) or 1 (Black); a takeback also undoes the
  // bot's reply that follows it, so the minimum history is one ply more than the player's first ply.
  const minPlies = playerColor === 'white' ? 2 : 3;
  return historyLength >= minPlies;
}
