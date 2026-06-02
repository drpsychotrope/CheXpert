// Pure selector + scorer for the "when to think" critical-moment drill (ADR-0038).
// From the player's STORED game analyses, label each player-to-move ply CRITICAL
// (a moment where a wrong move proved expensive) or ROUTINE (play fast) using the
// realised win-probability swing `PlyAnalysis.winProbLoss` — NOT a second-best
// "only-move" margin, which stored analysis does not carry (one eval/position,
// ADR-0006; spec §0.5). Reuses the side-tagging idea from criticalMoments.ts.
//
// NO engine work and NO chess.js here — everything derives from the stored
// GameAnalysis (comeback / eval-graph precedent). The shuffle `rand` is INJECTED
// by the caller, so the core stays pure and deterministically testable (AP-CMD-4).
// The module intentionally has no global-state calls: no random() or clock reads.

import type { GameAnalysis, PlyAnalysis } from './types';

export type DrillLabel = 'critical' | 'routine';

export interface DrillItem {
  gameId: string;
  /** Index into the source analysis's `plies`. */
  plyIndex: number;
  /** The analysed ply — carries fenBefore, uci, san, winProbLoss, severity, … */
  ply: PlyAnalysis;
  /** Convenience mirror of `ply.fenBefore` (the board prop). */
  fenBefore: string;
  /** The GROUND TRUTH for this position. */
  label: DrillLabel;
  /** The realised swing that hung on the move — the reveal value (NOT a grade). */
  winProbLoss: number;
}

export interface CallResult {
  correct: boolean;
  truth: DrillLabel;
  call: DrillLabel;
}

export interface DrillOptions {
  /** Win% loss at/above which a player ply is CRITICAL (default 15, Q-A). */
  criticalLoss?: number;
  /** Win% loss at/below which a player ply is ROUTINE (default 3). The open band
   *  (routineLoss, criticalLoss) is "ambiguous" and is NOT used as a drill item. */
  routineLoss?: number;
  /** Max items in the built set (default 12). */
  max?: number;
  /** Drop trivial recaptures from ROUTINE candidates (default true, Q-C). */
  excludeRecaptures?: boolean;
}

const DEFAULTS = {
  criticalLoss: 15,
  routineLoss: 3,
  max: 12,
  excludeRecaptures: true,
} as const;

/**
 * Label one ply from its realised win-prob swing. CRITICAL if `winProbLoss >=
 * criticalLoss`, ROUTINE if `<= routineLoss`, else `null` (ambiguous band —
 * excluded from the drill). Player-to-move filtering is the caller's job
 * (`buildDrillSet`). Honesty: this is the *realised* swing, not a proven
 * "only-move" signal (AP-CMD-2, spec §0.5).
 */
export function labelPly(ply: PlyAnalysis, opts: DrillOptions = {}): DrillLabel | null {
  const criticalLoss = opts.criticalLoss ?? DEFAULTS.criticalLoss;
  const routineLoss = opts.routineLoss ?? DEFAULTS.routineLoss;
  if (ply.winProbLoss >= criticalLoss) return 'critical';
  if (ply.winProbLoss <= routineLoss) return 'routine';
  return null;
}

/** A plain recapture: this ply captures on the square the previous ply moved TO.
 *  `uci = from+to+promo` (pgn.ts), so `slice(2,4)` is the destination. No chess.js. */
function isTrivialRecapture(ply: PlyAnalysis, prev: PlyAnalysis | undefined): boolean {
  if (!prev) return false;
  if (ply.captured == null) return false;
  if (ply.uci.length < 4 || prev.uci.length < 4) return false;
  return prev.uci.slice(2, 4) === ply.uci.slice(2, 4);
}

/**
 * Build a balanced, deterministically-shuffled drill set from stored analyses.
 * - Collect every PLAYER-to-move ply (`ply.color === analysis.playerColor`).
 * - Label via `labelPly`; skip the ambiguous band (`null`).
 * - When `excludeRecaptures`, drop ROUTINE plies that are trivial recaptures
 *   (never CRITICAL ones — a recapture can itself be a blunder).
 * - Dedup by `fenBefore`.
 * - Balance: take up to `ceil(max/2)` from each label, then top up from the
 *   larger side if one is short (best-effort — never empty-on-imbalance, AP-CMD-7).
 * - Shuffle the result with a Fisher–Yates pass driven by the INJECTED `rand`.
 * - Cap at `max`.
 */
export function buildDrillSet(
  analyses: GameAnalysis[],
  rand: () => number,
  opts: DrillOptions = {},
): DrillItem[] {
  const max = opts.max ?? DEFAULTS.max;
  const excludeRecaptures = opts.excludeRecaptures ?? DEFAULTS.excludeRecaptures;

  const critical: DrillItem[] = [];
  const routine: DrillItem[] = [];
  const seenFens = new Set<string>();

  for (const analysis of analyses) {
    const plies = analysis.plies;
    for (let i = 0; i < plies.length; i++) {
      const ply = plies[i];
      if (ply.color !== analysis.playerColor) continue; // player-to-move only (AP-CMD-8)
      const label = labelPly(ply, opts);
      if (label == null) continue; // ambiguous band excluded
      if (label === 'routine' && excludeRecaptures && isTrivialRecapture(ply, plies[i - 1])) {
        continue; // trivial recapture: correct-but-uninstructive ROUTINE (Q-C)
      }
      if (seenFens.has(ply.fenBefore)) continue; // dedup by fenBefore
      seenFens.add(ply.fenBefore);
      const item: DrillItem = {
        gameId: analysis.gameId,
        plyIndex: i,
        ply,
        fenBefore: ply.fenBefore,
        label,
        winProbLoss: ply.winProbLoss,
      };
      (label === 'critical' ? critical : routine).push(item);
    }
  }

  // Balance: half from each side, then top up from whichever side has surplus.
  const half = Math.ceil(max / 2);
  const picked: DrillItem[] = [...critical.slice(0, half), ...routine.slice(0, half)];
  if (picked.length < max) {
    const leftoverCrit = critical.slice(half);
    const leftoverRoutine = routine.slice(half);
    for (const it of [...leftoverCrit, ...leftoverRoutine]) {
      if (picked.length >= max) break;
      picked.push(it);
    }
  }

  shuffleInPlace(picked, rand);
  return picked.slice(0, max);
}

/** Fisher–Yates using the injected rand (deterministic in tests). Exported so
 *  callers (e.g. the fallback path in the view) can shuffle pre-built items with
 *  the SAME injected-rand discipline — a single call-site injection. */
export function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/** Pure: a shuffled COPY (does not mutate the input). */
export function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const copy = arr.slice();
  shuffleInPlace(copy, rand);
  return copy;
}

/** Grade one CRITICAL/ROUTINE call. Binary (Q-D): correct iff it matches the
 *  ground-truth label. No accuracy %, no graded partial credit (AP-CMD-1). */
export function scoreCall(item: DrillItem, call: DrillLabel): CallResult {
  return { correct: call === item.label, truth: item.label, call };
}
