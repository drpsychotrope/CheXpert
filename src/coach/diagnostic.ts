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
}): CoachProfile {
  const { puzzleRating, probes, gameDimensions, assessedAt, locale } = args;

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
    source: { ladders: motifs.length > 0, game: !!gameDimensions },
    gameAnalyzed: !!gameDimensions,
  };
}
