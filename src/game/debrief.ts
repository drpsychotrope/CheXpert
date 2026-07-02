// Post-game debrief core (PR-03 postgame-debrief, ADR-0061). Pure assembly of the numbers the
// game-end moment already computes but used to drop: the player's rating move around the fold
// (PR-02 snapshot), the rolling win-rate behind the adaptive nudge (AdaptiveOpponent.recordGame's
// own input, never rendered before), the opening actually played (nameOpening — no full analysis
// needed), and per-side clock totals derived from the PR-02 %clk trace. Display stays in the
// component; everything here is injected and unit-testable (no Date, no engine, no DOM).

import type { PlyClockSnap } from './clockTrace';

/** Per-side clock summary derived from the per-ply snapshots. */
export interface ClockSummary {
  playerSpentMs: number;
  botSpentMs: number;
  playerMoves: number;
  botMoves: number;
}

/**
 * Derive time spent per side from consecutive %clk snapshots: for each ply,
 * spent = previous remaining (same side; the initial time for that side's first move)
 *         − current remaining + increment (a Fischer press refunds the increment, which was
 *         real thinking time — same derivation parsePgn uses for secondsSpent).
 * Returns null on an empty trace (untimed game / nothing captured — the card skips the row).
 */
export function clockSummary(
  trace: PlyClockSnap[],
  initialMs: number,
  incMs: number,
  playerSide: 'w' | 'b',
): ClockSummary | null {
  if (!trace.length) return null;
  const prev: Record<'w' | 'b', number> = { w: initialMs, b: initialMs };
  const spent: Record<'w' | 'b', number> = { w: 0, b: 0 };
  const moves: Record<'w' | 'b', number> = { w: 0, b: 0 };
  for (const snap of trace) {
    spent[snap.side] += Math.max(0, prev[snap.side] - snap.remainingMs + incMs);
    moves[snap.side] += 1;
    prev[snap.side] = snap.remainingMs;
  }
  const bot: 'w' | 'b' = playerSide === 'w' ? 'b' : 'w';
  return {
    playerSpentMs: spent[playerSide],
    botSpentMs: spent[bot],
    playerMoves: moves[playerSide],
    botMoves: moves[bot],
  };
}

/** 'M:SS' duration for the card (distinct from %clk's H:MM:SS remaining-time format). */
export function fmtDuration(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? `0${s}` : s}`;
}

/** Average seconds per move, rounded to the second (0 moves → 0). */
export function avgSecPerMove(spentMs: number, moves: number): number {
  return moves > 0 ? Math.round(spentMs / moves / 1000) : 0;
}

/** Everything the debrief card can show. Every field optional — a row without data is not
 *  rendered (an unrated game has no rating row: no fold, nothing to claim — AP-TELEM-3). */
export interface DebriefData {
  ratingBefore?: number;
  ratingAfter?: number;
  /** Rolling win-rate AFTER this game folded (this game included) + the window size. */
  winRate?: number;
  recentN?: number;
  openingName?: string;
  eco?: string;
  clock?: ClockSummary;
}

/** Signed rating delta for display ('+12' / '−8' / '0'), rounded. */
export function ratingDelta(before: number, after: number): string {
  const d = Math.round(after) - Math.round(before);
  return d > 0 ? `+${d}` : String(d);
}
