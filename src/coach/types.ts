// Coach mode (ADR-0045): the persisted strength/weakness profile shape and the
// raw per-theme probe result the wizard collects. Plain data only (IndexedDB
// structured-clone safe); no engine/Svelte imports so db.ts can import it freely.

import type { DimensionScore } from '../analysis/weakness';

/** One tactical-motif (or 'endgame') probe scored relative to the puzzle-rating baseline. */
export interface MotifScore {
  theme: string;     // motif key ('fork'…'mate') or 'endgame'
  rating: number;    // Glicko rating from the themed ladder
  baseline: number;  // puzzleRating at probe time
  delta: number;     // rating - baseline (>0 strength, <0 weakness)
  n: number;         // puzzles attempted (sample size — honesty)
}

/** Raw output of one themed ladder, handed to buildCoachProfile. */
export interface ThemeProbeResult {
  theme: string;
  rating: number;
  n: number;
}

/** Persisted coaching assessment (PlayerModel.coachProfile). Directional, not a grade. */
export interface CoachProfile {
  assessedAt: number;            // UI-stamped (Date.now boundary)
  puzzleRating: number;          // baseline for motif deltas
  motifs: MotifScore[];
  dimensions: DimensionScore[];  // 5-dim radar (game-derived when present)
  strengths: string[];           // display labels
  weaknesses: string[];          // display labels
  source: { ladders: boolean; game: boolean };
  gameAnalyzed: boolean;
}
