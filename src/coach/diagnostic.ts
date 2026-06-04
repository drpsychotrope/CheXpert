// Coach diagnostic core (ADR-0045). PURE: no Date, no Math.random, no engine.
// Reuses the calibration PuzzleLadder method across themes; this module only
// AGGREGATES the collected results into a CoachProfile. The UI (Coach.svelte)
// owns the engine/ladder/Date side and injects gameDimensions (already computed
// by buildWeaknessProfile) so this core needs no GameAnalysis fixture to test.

import type { Dimension, DimensionScore } from '../analysis/weakness';
import type { CoachProfile, MotifScore, ThemeProbeResult } from './types';

export const COACH_MOTIF_PROBES = ['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'mate'] as const;
export const COACH_LADDER_MIN = 3;
export const COACH_LADDER_MAX = 5;

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

function placeholderDim(dimension: Dimension): DimensionScore {
  return { dimension, score: 50, detail: 'Play the calibration game to assess this', sampleSize: 0 };
}

const MOTIF_LABELS: Record<string, string> = {
  fork: 'Forks', pin: 'Pins', skewer: 'Skewers', hangingPiece: 'Hanging pieces',
  discoveredAttack: 'Discovered attacks', mate: 'Mating patterns', endgame: 'Endgames',
};
function motifLabel(theme: string): string {
  return MOTIF_LABELS[theme] ?? theme;
}
const DIM_LABELS: Record<Dimension, string> = {
  tactics: 'Tactics', openingAccuracy: 'Opening accuracy', endgameConversion: 'Endgame conversion',
  timeManagement: 'Time management', resilience: 'Resilience',
};

export function buildCoachProfile(args: {
  puzzleRating: number;
  probes: ThemeProbeResult[];
  gameDimensions: DimensionScore[] | null;
  assessedAt: number;
}): CoachProfile {
  const { puzzleRating, probes, gameDimensions, assessedAt } = args;

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
      ? { dimension: 'tactics', score: aggregate, detail: `${motifs.length} motifs probed (${totalPuzzles} puzzles)`, sampleSize: totalPuzzles }
      : placeholderDim('tactics');

  let dimensions: DimensionScore[];
  if (gameDimensions) {
    dimensions = gameDimensions.map((d) => (d.dimension === 'tactics' && motifs.length > 0 ? tacticsDim : d));
  } else {
    dimensions = ALL_DIMS.map((dim) => (dim === 'tactics' ? tacticsDim : placeholderDim(dim)));
  }

  // Strengths / weaknesses. Per-motif covers the tactics granularity, so the dim
  // loop skips 'tactics' to avoid double-counting.
  const sortedMotifs = [...motifs].sort((a, b) => a.delta - b.delta); // weakest first
  const weaknesses: string[] = [];
  const strengths: string[] = [];
  for (const m of sortedMotifs) if (m.delta <= WEAKNESS_DELTA) weaknesses.push(motifLabel(m.theme));
  for (const m of [...sortedMotifs].reverse()) if (m.delta >= STRENGTH_DELTA) strengths.push(motifLabel(m.theme));

  const sortedDims = dimensions.filter((d) => d.sampleSize > 0 && d.dimension !== 'tactics').sort((a, b) => a.score - b.score);
  for (const d of sortedDims) if (d.score <= WEAKNESS_DIM) weaknesses.push(DIM_LABELS[d.dimension]);
  for (const d of [...sortedDims].reverse()) if (d.score >= STRENGTH_DIM) strengths.push(DIM_LABELS[d.dimension]);

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
