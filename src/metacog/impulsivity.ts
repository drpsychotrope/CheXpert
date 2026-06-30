// Move-time / impulsivity readout (T3, impulsivity fold). PURE — no Date, no Math.random.
// DESCRIPTIVE, never a grade (AP-META-1 / AP-TINTEG-7): a fact-sentence about the player's
// ATTEMPTS, never a trait of the player and never a letter/number score.
//
// "Fast" means what the GRADER means: the default split threshold is the grader's own
// DEFAULT_GRADE_THRESHOLDS.fastMs (fsrs.ts) — IMPORTED, not re-declared, so the impulsivity
// surface and the FSRS Easy-grade boundary stay in lockstep (/enrich#6). The readout reports:
//   - the average solve time,
//   - the fast-and-wrong (impulsive) vs slow-and-right (deliberate) split, WITH denominators
//     so the claim is inspectable (k/n, mirroring calibration; /enrich#3),
//   - a descriptive sentence kind, or null below the sample-size floor (anti-fabrication).

import { DEFAULT_GRADE_THRESHOLDS } from '../srs/fsrs';

/** Minimal attempt shape the impulsivity math needs (decoupled from the DB record). */
export interface ImpulsivityAttempt {
  solved: boolean;
  ms: number;
}

export interface ImpulsivityReadout {
  n: number;
  avgMs: number;
  /** Misses among fast attempts, and the fast denominator. */
  fastWrong: number;
  fastTotal: number;
  /** Solves among slow attempts, and the slow denominator. */
  slowRight: number;
  slowTotal: number;
  /**
   * Descriptive readout (kind + the values an i18n sentence needs), or null below the
   * sample-size floor (minN). Never a grade — the caller renders a fact sentence keyed by
   * `kind`. `fastMissPct` is 0..100 (the share of FAST attempts that were wrong); `avgSec`
   * is the mean solve time in whole seconds.
   */
  readout: { kind: 'impulsive' | 'deliberate' | 'mixed'; fastMissPct: number; avgSec: number } | null;
}

/**
 * Build the descriptive move-time / impulsivity readout over `attempts`.
 *
 * - `fastMs` (default `DEFAULT_GRADE_THRESHOLDS.fastMs`): an attempt at/under this many ms is
 *   "fast" — the same boundary the FSRS grader uses for Easy.
 * - `minN` (default 10, mirroring calibration's `minReported`): below this many attempts the
 *   `readout` is null — no claim on thin data (AP-TINTEG-7).
 *
 * Verdict kind (precedence): a high fast-miss share → 'impulsive' (you miss when you rush);
 * a high slow-solve share with a low fast-miss share → 'deliberate'; otherwise → 'mixed'.
 * Thresholds 0.50 / 0.60 are evaluated against the respective denominators only when those
 * buckets carry data, so a player with no fast attempts is never labelled 'impulsive'.
 */
export function impulsivity(
  attempts: ImpulsivityAttempt[],
  opts?: { fastMs?: number; minN?: number },
): ImpulsivityReadout {
  const fastMs = opts?.fastMs ?? DEFAULT_GRADE_THRESHOLDS.fastMs;
  const minN = opts?.minN ?? 10;

  const n = attempts.length;
  let sumMs = 0;
  let fastTotal = 0;
  let fastWrong = 0;
  let slowTotal = 0;
  let slowRight = 0;
  for (const a of attempts) {
    sumMs += a.ms;
    if (a.ms <= fastMs) {
      fastTotal += 1;
      if (!a.solved) fastWrong += 1;
    } else {
      slowTotal += 1;
      if (a.solved) slowRight += 1;
    }
  }
  const avgMs = n === 0 ? 0 : sumMs / n;

  let readout: ImpulsivityReadout['readout'] = null;
  if (n >= minN) {
    const fastMissShare = fastTotal === 0 ? 0 : fastWrong / fastTotal;
    const slowRightShare = slowTotal === 0 ? 0 : slowRight / slowTotal;
    const fastMissPct = Math.round(fastMissShare * 100);
    const avgSec = Math.round(avgMs / 1000);
    let kind: 'impulsive' | 'deliberate' | 'mixed';
    if (fastTotal > 0 && fastMissShare >= 0.5) {
      kind = 'impulsive';
    } else if (slowTotal > 0 && slowRightShare >= 0.6 && fastMissShare < 0.5) {
      kind = 'deliberate';
    } else {
      kind = 'mixed';
    }
    readout = { kind, fastMissPct, avgSec };
  }

  return { n, avgMs, fastWrong, fastTotal, slowRight, slowTotal, readout };
}
