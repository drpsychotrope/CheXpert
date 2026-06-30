// Coach real-data assessment window (C4). PURE: no Date, no Math.random, no engine, no Svelte.
//
// The coach assesses from the user's REAL games, not one toy game. The mechanism is deliberately
// small: take a recent WINDOW of the already-unified analyses (loadAllAnalyses() returns imported +
// played) and feed that array into the SAME buildWeaknessProfile the coach already consumes — never
// a fork (AP-CREAL-1 / AP-COACH-1). This module only WINDOWS + COUNTS; the UI (Coach.svelte) owns
// the loadAllAnalyses() read and the Date boundary. Windowing by the records' own `analyzedAt`
// keeps it clock-free and unit-testable (AP-CREAL-4).

import type { GameAnalysis } from '../analysis/types';

/** Most-recent `n` analyses by `analyzedAt` (desc). Pure: sorts the records' own timestamps, never
 *  Date.now (AP-CREAL-4). n>len → all; n<=0 → []. Copy-then-sort so the caller's array is untouched.
 *  Array.prototype.sort is stable (ES2019+), so equal `analyzedAt` ties keep input order. */
export function recentAnalyses(analyses: GameAnalysis[], n: number): GameAnalysis[] {
  return [...analyses].sort((a, b) => b.analyzedAt - a.analyzedAt).slice(0, Math.max(0, n));
}

/** Per-source counts for the honest provenance line (FOLD-C4): "M played, K imported". Pure. */
export function analysesBySource(analyses: GameAnalysis[]): { played: number; imported: number } {
  let played = 0;
  let imported = 0;
  for (const a of analyses) (a.source === 'imported' ? imported++ : played++);
  return { played, imported };
}

/** Window size N (Q-B). A small recent window; sample-size honesty is inherited from
 *  buildWeaknessProfile. A constant in V1 — user-tunable N is DEF-C1 (§11). */
export const COACH_ASSESS_WINDOW = 10;

/** Floor for the history path (FOLD-C2 / AP-CREAL-5): below this the window is too thin to be an
 *  assessment, so the coach falls back to the existing toy-game/ladders path. */
export const COACH_ASSESS_MIN_GAMES = 1;
