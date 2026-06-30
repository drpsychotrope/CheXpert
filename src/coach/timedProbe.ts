// Timed-probe core (feature C2 / CO15). PURE: no Date, no Math.random, no performance.now —
// the UI owns the Clock deltas and feeds each finished attempt here (AP-CPROBE-5). Produces an
// honest, sample-size-labelled, DIRECTIONAL `timeManagement` DimensionScore from a short timed
// BLOCK of on-level puzzles (puzzle-rush style), NOT from clocking every motif probe (which would
// confound the strength/weakness deltas — AP-CPROBE-6).
//
// Honesty (AP-CPROBE-7 / AP-COACH-2): the score is directional, never a grade; a too-small budget
// that lands 0 attempts yields sampleSize:0 → the radar collapses that axis to n/a (Radar.svelte
// already does this), never a fabricated number.

import type { DimensionScore } from '../analysis/weakness';
import { gt } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

/** Running accumulator for the timed block; the UI threads one of these across attempts. */
export interface TimedProbeState {
  solved: number;
  attempted: number;
  totalMs: number;
}

/** One finished timed attempt. */
export interface TimedResult {
  solved: boolean;
  ms: number;
}

export function initTimedProbe(): TimedProbeState {
  return { solved: 0, attempted: 0, totalMs: 0 };
}

/** Fold one finished attempt into the accumulator (immutable). */
export function recordTimed(s: TimedProbeState, r: TimedResult): TimedProbeState {
  return {
    solved: s.solved + (r.solved ? 1 : 0),
    attempted: s.attempted + 1,
    totalMs: s.totalMs + Math.max(0, r.ms),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Speed anchors (ms per puzzle in a timed block) → a 0..100 speed factor. Faster = higher.
// ~3s/puzzle → ~100, ~10s → ~50, ~25s → ~10. Directional, community rule-of-thumb (cf. acplToScore).
const FAST_MS = 3000;
const MID_MS = 10000;
const SLOW_MS = 25000;

/** Map mean ms/puzzle to a 0..100 speed factor (monotonic decreasing in time). */
export function speedFactor(meanMs: number): number {
  if (meanMs <= FAST_MS) return 100;
  if (meanMs <= MID_MS) return Math.round(100 + ((meanMs - FAST_MS) / (MID_MS - FAST_MS)) * (50 - 100));
  if (meanMs <= SLOW_MS) return Math.round(50 + ((meanMs - MID_MS) / (SLOW_MS - MID_MS)) * (10 - 50));
  return 10;
}

/**
 * Derive the timeManagement DimensionScore from the accumulated timed block.
 *
 * score = accuracy × speed, both directional:
 *  - accuracy = solved / attempted (0..1)
 *  - speed    = speedFactor(meanMs) (0..100)
 * so a fast-AND-accurate block scores high; slow OR inaccurate scores low. The score is monotonic
 * up in accuracy and (via speedFactor) down in time. sampleSize = attempted (the honesty label).
 * attempted === 0 → sampleSize 0 (radar n/a, not a fake number — AP-CPROBE-7).
 */
export function timedDimension(s: TimedProbeState, locale: Locale): DimensionScore {
  if (s.attempted === 0) {
    return { dimension: 'timeManagement', score: 50, detail: gt('diag.timedNone', locale), sampleSize: 0 };
  }
  const accuracy = s.solved / s.attempted;
  const meanMs = s.totalMs / s.attempted;
  const score = clamp(Math.round(accuracy * speedFactor(meanMs)), 0, 100);
  return {
    dimension: 'timeManagement',
    score,
    detail: gt('diag.timedRead', locale, { solved: s.solved, attempted: s.attempted, sec: Math.round(meanMs / 1000) }),
    sampleSize: s.attempted,
  };
}
