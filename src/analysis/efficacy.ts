// Descriptive per-motif before/after miss-rate (ADR-0039). Answers the README's
// honesty question — "I drilled forks; did my fork-miss rate fall?" — as a TWO-window,
// phase-scoped, DESCRIPTIVE statement. No causal claim, no verdict string, no LLM.
// Pure: NO Date, NO Math.random (the caller pins the split boundary; default = median
// analyzedAt). Shares fingerprint's cluster rule via leakKey so a leak and its efficacy
// number can never disagree (AP-ES-1).

import type { GameAnalysis, GamePhase, PlyAnalysis } from './types';
import { leakKey } from './fingerprint';

export interface EfficacyWindow {
  missRate: number;    // misses ÷ phase-scoped player moves, 0..1 (0 when no moves in scope)
  playerMoves: number; // player plies in the motif's phase(s) within this window
  misses: number;      // player mistakes/blunders of this motif within this window
}

export interface EfficacyReadout {
  motifKey: string;            // the leak key being measured (e.g. 'fork', 'endgame:blunder')
  label: string;              // display label (motif tag, or `phase severity`)
  early: EfficacyWindow;      // older window
  recent: EfficacyWindow;     // newer window
  deltaPct: number;           // recent.missRate - early.missRate (negative = improved); 0 when not enough data
  enoughData: boolean;        // both windows have ≥ minMoves player plies in scope
}

const ZERO: EfficacyWindow = { missRate: 0, playerMoves: 0, misses: 0 };

function isFlagged(p: PlyAnalysis): boolean {
  return p.severity === 'mistake' || p.severity === 'blunder';
}

/** Display label matching buildFingerprint's label form for this key. */
function labelFor(motifKey: string): string {
  return motifKey.includes(':') ? motifKey.replace(':', ' ') : motifKey;
}

/** Descriptive before/after miss-rate for ONE motif/leak across the player's analysed
 *  games. Splits the player's flagged plies by analyzedAt into older vs newer halves
 *  (or at opts.splitAt). miss = a player ply flagged mistake|blunder whose leakKey ===
 *  motifKey. denominator = player plies in the SAME phase(s) the motif occurs in, so the
 *  rate reads "when this kind of position arose, how often did I get it wrong" — NOT a
 *  microscopic fraction of all moves (AP-ES-3). Caller MUST attach the honesty caveat
 *  (§4.4). NEVER returns a verdict string. */
export function motifEfficacy(
  analyses: GameAnalysis[],
  motifKey: string,
  opts: { minMoves?: number; splitAt?: number } = {},
): EfficacyReadout {
  const minMoves = opts.minMoves ?? 20;
  const label = labelFor(motifKey);

  // 1) Determine the phase(s) where this motif's misses occur, across ALL data, so the
  //    denominator is scoped consistently in both windows (mirrors Leak.phase union).
  const phases = new Set<GamePhase>();
  for (const a of analyses) {
    for (const p of a.plies) {
      if (p.color !== a.playerColor) continue;
      if (isFlagged(p) && leakKey(p) === motifKey) phases.add(p.phase);
    }
  }

  // 2) Collect player plies in scope (those phases), each tagged with analyzedAt + whether
  //    it is a miss of this motif. Player-moves only; opponent plies ignored.
  interface Scoped { at: number; miss: boolean }
  const scoped: Scoped[] = [];
  for (const a of analyses) {
    for (const p of a.plies) {
      if (p.color !== a.playerColor) continue;
      if (!phases.has(p.phase)) continue;
      const miss = isFlagged(p) && leakKey(p) === motifKey;
      scoped.push({ at: a.analyzedAt, miss });
    }
  }

  if (scoped.length === 0) {
    return { motifKey, label, early: { ...ZERO }, recent: { ...ZERO }, deltaPct: 0, enoughData: false };
  }

  // 3) Split by analyzedAt at the median (default) or the caller-pinned boundary.
  // Split on distinct analysis timestamps so each window holds whole games and
  // both sides are non-empty whenever ≥2 distinct timestamps exist (spec §4.2 "halves, ≥1 game each").
  const distinct = [...new Set(scoped.map((s) => s.at))].sort((a, b) => a - b);
  const splitAt = opts.splitAt ?? distinct[Math.floor(distinct.length / 2)];
  // Plies strictly before the boundary are "early"; the boundary and later are "recent".
  const early = aggregate(scoped.filter((s) => s.at < splitAt));
  const recent = aggregate(scoped.filter((s) => s.at >= splitAt));

  const enoughData = early.playerMoves >= minMoves && recent.playerMoves >= minMoves;
  const deltaPct = enoughData ? recent.missRate - early.missRate : 0;

  return { motifKey, label, early, recent, deltaPct, enoughData };
}

function aggregate(plies: { miss: boolean }[]): EfficacyWindow {
  const playerMoves = plies.length;
  const misses = plies.reduce((n, p) => n + (p.miss ? 1 : 0), 0);
  return { playerMoves, misses, missRate: playerMoves > 0 ? misses / playerMoves : 0 };
}
