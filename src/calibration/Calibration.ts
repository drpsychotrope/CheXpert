// Launch-time skill evaluation (user requirement, spec §2.7/§4.8, ADR-0005).
//
// Two stages:
//   Stage 1 — adaptive puzzle ladder (ALWAYS): ~6-10 puzzles, start mid, step by
//             result, Glicko-2 → seeds the PUZZLE rating.
//   Stage 2 — calibration game (OPTIONAL): a real game vs Stockfish; after each
//             player move we do a quick single-position eval (NOT batch analysis,
//             which is Phase 2) and accumulate ACPL → seeds the GAME rating.
//   Skip    — derive a provisional game rating from puzzle rating + self-rating
//             with a WIDE RD; Glicko refines it over real games.
//
// AP-CHESS-23: keep onboarding short / skippable. AP-CHESS-24: the seed is rough
// (wide RD) — never present it as a precise rating.

import { defaultRating, updateRating, type Rating } from '../rating/glicko2';
import type { PuzzleRepo } from '../trainer/PuzzleRepo';
import { TacticalTrainer, gradeAttempt } from '../trainer/TacticalTrainer';
import type { Puzzle } from '../trainer/puzzle';

export const LADDER_MIN = 6;
export const LADDER_MAX = 10;

export interface DeclarativeAnswers {
  /** Self-rated level bucket. */
  selfLevel: 'new' | 'beginner' | 'intermediate' | 'advanced';
  /** Optional known rating from another platform. */
  priorRating?: number;
}

/** Seed rating + RD from declarative answers (priors before any evidence). */
export function priorFromDeclarative(a: DeclarativeAnswers): Rating {
  if (a.priorRating && a.priorRating > 400) {
    // Trust a stated rating somewhat, but keep RD moderate.
    return defaultRating(a.priorRating, 200, 0.06);
  }
  const map: Record<DeclarativeAnswers['selfLevel'], number> = {
    new: 800,
    beginner: 1100,
    intermediate: 1500,
    advanced: 1900,
  };
  return defaultRating(map[a.selfLevel], 300, 0.06);
}

export interface LadderOpts {
  min?: number;
  max?: number;
  themes?: string[];
  phase?: 'opening' | 'middlegame' | 'endgame';
  window?: number;
}

/**
 * Stateful driver for the Stage-1 puzzle ladder. The UI asks for the next puzzle,
 * runs it through a TacticalTrainer, then reports solved/failed back here.
 */
export class PuzzleLadder {
  rating: Rating;
  attempted = new Set<string>();
  count = 0;
  private current: { trainer: TacticalTrainer; puzzle: Puzzle } | null = null;
  private min: number;
  private max: number;
  private themes: string[] | undefined;
  private phase: 'opening' | 'middlegame' | 'endgame' | undefined;
  private window: number;

  constructor(
    private repo: PuzzleRepo,
    prior: Rating,
    opts: LadderOpts = {},
  ) {
    // Start from the prior but with a wide RD so the ladder moves fast.
    this.rating = { ...prior, rd: Math.max(prior.rd, 250) };
    this.min = opts.min ?? LADDER_MIN;
    this.max = opts.max ?? LADDER_MAX;
    this.themes = opts.themes;
    this.phase = opts.phase;
    this.window = opts.window ?? 250;
  }

  /** Get the next ladder puzzle near the current rating, or null when done. */
  async next(now: number): Promise<TacticalTrainer | null> {
    if (this.isDone()) return null;
    const puzzle = await this.repo.next({ rating: this.rating.rating, window: this.window, exclude: this.attempted, themes: this.themes, phase: this.phase });
    if (!puzzle) return null;
    this.attempted.add(puzzle.id);
    this.current = { trainer: new TacticalTrainer(puzzle, now), puzzle };
    return this.current.trainer;
  }

  /** Report the outcome of the current puzzle; updates the ladder rating. */
  report(solved: boolean): void {
    if (!this.current) return;
    const { player } = gradeAttempt(this.rating, this.current.puzzle, solved);
    this.rating = player;
    this.count += 1;
    this.current = null;
  }

  /** Done once we have enough signal: min puzzles AND RD tightened, capped at max. */
  isDone(): boolean {
    if (this.count >= this.max) return true;
    return this.count >= this.min && this.rating.rd <= 90;
  }
}

/**
 * Map average centipawn loss (ACPL) over a calibration game to an estimated Elo.
 * Monotonic decreasing: low ACPL = strong play. Coarse, anchored to community
 * rules of thumb; treated as a SEED with wide RD (re-measure empirically — §3.3).
 */
export function acplToElo(acpl: number): number {
  // Piecewise-linear anchors (ACPL -> Elo).
  const anchors: Array<[number, number]> = [
    [10, 2400],
    [20, 2000],
    [40, 1700],
    [60, 1450],
    [90, 1200],
    [130, 950],
    [200, 700],
  ];
  if (acpl <= anchors[0][0]) return anchors[0][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [a1, e1] = anchors[i];
    const [a2, e2] = anchors[i + 1];
    if (acpl <= a2) {
      const t = (acpl - a1) / (a2 - a1);
      return Math.round(e1 + t * (e2 - e1));
    }
  }
  return anchors[anchors.length - 1][1];
}

/**
 * Combine the calibration game result + ACPL into a seeded GAME rating.
 * If Stage 2 was skipped, pass acpl=null to derive from the puzzle rating.
 */
export function seedGameRating(
  puzzleRating: Rating,
  prior: Rating,
  acpl: number | null,
  gameResult?: 'win' | 'loss' | 'draw',
  botElo?: number,
): Rating {
  if (acpl == null) {
    // Skip path: blend puzzle rating with declared prior, WIDE RD.
    const blended = Math.round(0.5 * puzzleRating.rating + 0.5 * prior.rating);
    return defaultRating(blended, 300, 0.06);
  }
  const acplElo = acplToElo(acpl);
  // Start near the ACPL estimate (wide RD), then fold in the actual game result
  // vs the bot as one Glicko match for a touch more signal.
  let r = defaultRating(acplElo, 250, 0.06);
  if (gameResult && botElo) {
    const score = gameResult === 'win' ? 1 : gameResult === 'draw' ? 0.5 : 0;
    r = updateRating(r, [{ opponentRating: botElo, opponentRd: 60, score }]);
  }
  return r;
}
