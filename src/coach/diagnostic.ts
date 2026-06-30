// Coach diagnostic core (ADR-0045). PURE: no Date, no Math.random, no engine.
// Reuses the calibration PuzzleLadder method across themes; this module only
// AGGREGATES the collected results into a CoachProfile. The UI (Coach.svelte)
// owns the engine/ladder/Date side and injects gameDimensions (already computed
// by buildWeaknessProfile) so this core needs no GameAnalysis fixture to test.
//
// V2-W18 (F3): bilingual — motif/dimension labels + details resolve via an INJECTED
// `locale` (gt); the keys (motif 'fork', dimension 'tactics') stay stable.

import type { Dimension, DimensionScore } from '../analysis/weakness';
import type { CoachProfile, MotifScore, ThemeProbeResult } from './types';
import { gt } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

export const COACH_MOTIF_PROBES = ['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'mate'] as const;
// Two puzzles per theme: the coach samples each motif (+ endgame) twice — ≈14 puzzles total,
// scored whether solved or not (a test, not a pass/fail gate). Two probes halve the single-puzzle
// noise on the Tactics axis (a 1/1 ladder swung ±~115 per result, so one unlucky miss skewed the
// motif delta); still far shorter than the original 3/5. Revisits ADR-0048's "shortest possible"
// tradeoff toward a more stable per-motif signal (supersedes ADR-0045 Q-D).
export const COACH_LADDER_MIN = 2;
export const COACH_LADDER_MAX = 2;

const STRENGTH_DELTA = 40;
const WEAKNESS_DELTA = -40;
const STRENGTH_DIM = 65;
const WEAKNESS_DIM = 35;
const ALL_DIMS: Dimension[] = ['tactics', 'openingAccuracy', 'endgameConversion', 'timeManagement', 'resilience'];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Mean motif delta → 0..100 (0→50, +250→100, −250→0). Directional, not a grade. */
export function motifAggregateScore(motifs: MotifScore[]): number {
  if (motifs.length === 0) return 50;
  const mean = motifs.reduce((s, m) => s + m.delta, 0) / motifs.length;
  return clamp(Math.round(50 + mean / 5), 0, 100);
}

function placeholderDim(dimension: Dimension, locale: Locale): DimensionScore {
  return { dimension, score: 50, detail: gt('diag.placeholderDim', locale), sampleSize: 0 };
}

export function buildCoachProfile(args: {
  puzzleRating: number;
  probes: ThemeProbeResult[];
  gameDimensions: DimensionScore[] | null;
  assessedAt: number;
  /** UI locale for the display labels in strengths/weaknesses/detail (V2-W18). */
  locale: Locale;
  /** Optional timed-block read (C2/CO15). Fills `timeManagement` ONLY when the game didn't measure it
   *  (sampleSize 0 from the game). The game's own time read takes precedence when present (AP-CPROBE-8:
   *  additive optional arg, no output reshape; absent → byte-identical to today). */
  timedDim?: DimensionScore;
  /** Optional designed-position probe reads (C3). Each is a SINGLE-dimension `DimensionScore`
   *  (conversion/resilience) extracted from a designed probe game via the same `buildWeaknessProfile`
   *  path. A probe cell OVERRIDES the matching radar cell — it takes precedence over the (likely "not
   *  measured") game cell AND the timed cell for that dimension (a designed position is the strongest
   *  evidence for the axis it was built to test). Honesty: a thin probe arrives with `sampleSize 0`
   *  (kept "not measured", never fabricated — AP-CDESIGN-3/4). Setting `source.probes = true` (FOLD E2)
   *  happens ONLY when at least one probe cell is present. Mirrors the additive `timedDim` seam
   *  (AP-CPROBE-8): absent / empty → output byte-identical to today. */
  probeDims?: DimensionScore[];
}): CoachProfile {
  const { puzzleRating, probes, gameDimensions, assessedAt, locale, timedDim, probeDims } = args;

  // n=0 guard: a theme with no in-band puzzle is dropped, never scored.
  const scored = probes.filter((p) => p.n > 0);
  const motifs: MotifScore[] = scored.map((p) => ({
    theme: p.theme,
    rating: p.rating,
    baseline: puzzleRating,
    delta: Math.round(p.rating - puzzleRating),
    n: p.n,
  }));
  const totalPuzzles = scored.reduce((s, p) => s + p.n, 0);
  const aggregate = motifAggregateScore(motifs);
  const tacticsDim: DimensionScore =
    motifs.length > 0
      ? {
          dimension: 'tactics',
          score: aggregate,
          detail: gt('diag.motifsProbed', locale, { n: motifs.length, puzzles: totalPuzzles }),
          sampleSize: totalPuzzles,
        }
      : placeholderDim('tactics', locale);

  let dimensions: DimensionScore[];
  if (gameDimensions) {
    dimensions = gameDimensions.map((d) => (d.dimension === 'tactics' && motifs.length > 0 ? tacticsDim : d));
  } else {
    dimensions = ALL_DIMS.map((dim) => (dim === 'tactics' ? tacticsDim : placeholderDim(dim, locale)));
  }

  // C2/CO15: fill timeManagement from the timed block ONLY where it is still unmeasured (sampleSize 0).
  // The game's own time read wins when present (it observed real blunders-under-pressure); the timed
  // block is the puzzle-side fallback so the axis is no longer n/a from puzzles alone. Additive,
  // precedence-documented (AP-CPROBE-8); absent timedDim leaves the output byte-identical to today.
  if (timedDim && timedDim.sampleSize > 0) {
    dimensions = dimensions.map((d) => (d.dimension === 'timeManagement' && d.sampleSize === 0 ? timedDim : d));
  }

  // C3: designed-position probe cells override their matching radar cell. A probe is purpose-built to
  // measure ONE axis (conversion/resilience), so it OUTRANKS the game cell (which for these axes is
  // usually "not measured" in a short even game) and the timed cell. We override regardless of the
  // existing cell's sampleSize (unlike timedDim, which only backfills an unmeasured axis): the probe IS
  // the authoritative read for the axis it tests. A probe that came back "not measured" (sampleSize 0 —
  // instant resignation / engine failure) is honest evidence that the axis still wasn't measured, so it
  // legitimately overrides too (it never fabricates a score — AP-CDESIGN-3). Computed BEFORE
  // strengths/weaknesses so they read the probe cells through the same sampleSize > 0 gate (FOLD E2).
  const probed = !!probeDims && probeDims.length > 0;
  if (probed) {
    const byDim = new Map(probeDims!.map((p) => [p.dimension, p]));
    dimensions = dimensions.map((d) => byDim.get(d.dimension) ?? d);
  }

  // Strengths / weaknesses. Per-motif covers the tactics granularity, so the dim
  // loop skips 'tactics' to avoid double-counting.
  const sortedMotifs = [...motifs].sort((a, b) => a.delta - b.delta); // weakest first
  const weaknesses: string[] = [];
  const strengths: string[] = [];
  for (const m of sortedMotifs) if (m.delta <= WEAKNESS_DELTA) weaknesses.push(gt('motif.' + m.theme, locale));
  for (const m of [...sortedMotifs].reverse()) if (m.delta >= STRENGTH_DELTA) strengths.push(gt('motif.' + m.theme, locale));

  const sortedDims = dimensions.filter((d) => d.sampleSize > 0 && d.dimension !== 'tactics').sort((a, b) => a.score - b.score);
  for (const d of sortedDims) if (d.score <= WEAKNESS_DIM) weaknesses.push(gt('dim.' + d.dimension, locale));
  for (const d of [...sortedDims].reverse()) if (d.score >= STRENGTH_DIM) strengths.push(gt('dim.' + d.dimension, locale));

  return {
    assessedAt,
    puzzleRating,
    motifs,
    dimensions,
    strengths,
    weaknesses,
    // `probes` is added ONLY when a designed probe contributed a cell, so a probe-free build stays
    // `{ ladders, game }` byte-identical (existing toEqual assertions). `game`/`gameAnalyzed` stay tied
    // to a real analysed game — a probe NEVER masquerades as a full game (AP-CDESIGN-3/9).
    source: { ladders: motifs.length > 0, game: !!gameDimensions, ...(probed ? { probes: true } : {}) },
    gameAnalyzed: !!gameDimensions,
  };
}
