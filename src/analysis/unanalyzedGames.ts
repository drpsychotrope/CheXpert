// Pure selector for the play→analysis loop closure (P1, play-loop-closure-spec §4.2).
//
// The loop only closes if a played game actually gets analysed. Today's "Analyse this game"
// button is gated on component-local state (lastGame), lost on navigation/new game, so the
// backlog of unanalysed games is invisible and the loop silently degrades. This selector makes
// "which games are unanalysed" a derived fact over the persisted stores (F5's getAllGames +
// getAnalyzedGameIds), so it survives navigation — the durable replacement for a transient field
// (AP-PLAYLOOP-1).
//
// PURE: input games + analysed-id set only; no DB/engine/clock (AP-PLAYLOOP-8). Time/order come
// from the data (playedAt). The async wiring (the F5 reads) lives in the callers.

import type { GameRecord } from '../store/db';

/**
 * Standard (non-960) played games not yet analysed that carry a known player side, newest-first
 * by `playedAt`.
 *
 * - Excludes chess960 games — the analysis pipeline assumes standard rules/opening theory, so 960
 *   is never analysed (AP-960-4 / AP-PLAYLOOP-4).
 * - Excludes games with no `playerColor` (legacy pre-P1 records): the batch runner analyses each
 *   game from the stored POV, and a played PGN has no `[White]/[Black]` headers to recover the side
 *   from (AP-PLAYLOOP-12). Such games stay analysable per-game from the Play tail / history where
 *   the side was in scope.
 * - Excludes ids already present in `analyzedIds`.
 *
 * The displayed backlog count MUST be this function's `.length` so the count never overstates what
 * the batch will run (AP-PLAYLOOP-13).
 */
export function unanalyzedPlayedGames(
  games: GameRecord[],
  analyzedIds: Set<string>,
): GameRecord[] {
  return games
    .filter((g) => g.variant !== 'chess960' && g.playerColor != null && !analyzedIds.has(g.id))
    .sort((a, b) => b.playedAt - a.playedAt);
}
