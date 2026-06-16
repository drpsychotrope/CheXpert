// Weakness aggregation → radar dimensions, benchmarked against the player's level
// band (spec §4 item 8 + the "resilience" definition agreed in arbitrages:
// recovery rate after falling behind).
//
// Honesty (AP-CHESS-13): these benchmarks are DIRECTIONAL, derived from rough
// community rules of thumb, not a validated study. The UI must present them as
// "where to focus", not as a precise grade.

import type { GameAnalysis, GamePhase, PlyAnalysis } from './types';
import { gt } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

export type Dimension =
  | 'tactics'
  | 'endgameConversion'
  | 'openingAccuracy'
  | 'timeManagement'
  | 'resilience';

/** Where a weak dimension's one-click "Drill" should route (loop-closers 3b). */
export interface DrillTarget {
  view: 'tactics' | 'repertoire' | 'endgames' | 'comeback';
  /** Puzzle theme filter (Tactics only). */
  themes?: string[];
  /** Run Tactics under a per-puzzle clock. */
  timed?: boolean;
}

const TACTICS_THEMES = ['fork', 'knightFork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'doubleCheck', 'mate'];

/**
 * Map each radar dimension to a drill destination. Every dimension is drillable in
 * one click: tactics→Tactics(themes), opening→Repertoire, endgame→Endgames,
 * time→timed Tactics, resilience→Comeback drills. (Fixes the old all-to-Tactics route.)
 */
export function drillTarget(dim: Dimension): DrillTarget {
  switch (dim) {
    case 'openingAccuracy':
      return { view: 'repertoire' };
    case 'endgameConversion':
      return { view: 'endgames' };
    case 'timeManagement':
      return { view: 'tactics', timed: true };
    case 'resilience':
      return { view: 'comeback' };
    case 'tactics':
    default:
      return { view: 'tactics', themes: TACTICS_THEMES };
  }
}

export interface DimensionScore {
  dimension: Dimension;
  /** 0..100, higher = stronger. 50 ≈ at the level-band expectation. */
  score: number;
  /** Plain-language detail. */
  detail: string;
  /** How much data backs this (low n → take with salt). */
  sampleSize: number;
}

export interface WeaknessProfile {
  dimensions: DimensionScore[];
  /** The weakest dimension with enough data, for one-click drilling. */
  weakest: Dimension | null;
  gamesAnalyzed: number;
  playerMoves: number;
  overallAcpl: number;
}

/** Rough expected ACPL for a rating (lower rating → higher loss). Directional. */
export function expectedAcpl(rating: number): number {
  // ~120 at 800, ~80 at 1200, ~55 at 1600, ~35 at 2000, ~20 at 2400.
  const anchors: Array<[number, number]> = [
    [800, 120],
    [1200, 80],
    [1600, 55],
    [2000, 35],
    [2400, 20],
  ];
  if (rating <= anchors[0][0]) return anchors[0][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [r1, a1] = anchors[i];
    const [r2, a2] = anchors[i + 1];
    if (rating <= r2) return a1 + ((rating - r1) / (r2 - r1)) * (a2 - a1);
  }
  return anchors[anchors.length - 1][1];
}

/** Map an actual-vs-expected ACPL ratio to a 0..100 score (100 = much better). */
function acplToScore(actual: number, expected: number): number {
  if (actual <= 0) return 100;
  // ratio 1 → 50; ratio 0.5 → ~75; ratio 2 → ~25.
  const ratio = actual / expected;
  return clamp(Math.round(75 - 25 * Math.log2(ratio)), 0, 100);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Resilience = how often the player recovers after falling into a losing position.
 * For each player ply where they were clearly worse (mover-POV cp <= -200) earlier,
 * did the game's eval later return toward equality? We approximate per game:
 * fraction of "behind" segments that recovered to within -100.
 */
export function resilienceScore(analyses: GameAnalysis[]): { score: number; n: number } {
  let behindEpisodes = 0;
  let recovered = 0;
  for (const a of analyses) {
    const pc = a.playerColor;
    let inBehind = false;
    for (const ply of a.plies) {
      const moverWhite = pc === 'w';
      const playerCp = moverWhite ? ply.playedWhiteCp : -ply.playedWhiteCp;
      if (!inBehind && playerCp <= -200) {
        inBehind = true;
        behindEpisodes += 1;
      } else if (inBehind && playerCp >= -100) {
        inBehind = false;
        recovered += 1;
      }
    }
  }
  if (behindEpisodes === 0) return { score: 50, n: 0 };
  return { score: clamp(Math.round((recovered / behindEpisodes) * 100), 0, 100), n: behindEpisodes };
}

function phaseAcpl(analyses: GameAnalysis[], phase: GamePhase): { acpl: number; n: number } {
  let sum = 0;
  let n = 0;
  for (const a of analyses) {
    const ps = a.byPhase[phase];
    sum += ps.acpl * ps.plies;
    n += ps.plies;
  }
  return { acpl: n > 0 ? sum / n : 0, n };
}

/** Tactics = blunder/mistake density on the player's middlegame moves (inverted). */
function tacticsScore(analyses: GameAnalysis[]): { score: number; n: number } {
  let plies = 0;
  let bad = 0;
  for (const a of analyses) {
    for (const ply of a.plies as PlyAnalysis[]) {
      if (ply.color !== a.playerColor || ply.phase !== 'middlegame') continue;
      plies += 1;
      if (ply.severity === 'blunder' || ply.severity === 'mistake') bad += 1;
    }
  }
  if (plies === 0) return { score: 50, n: 0 };
  const rate = bad / plies; // 0..1
  // 0% bad → 100; 10% → ~55; 25%+ → low.
  return { score: clamp(Math.round(100 - rate * 400), 0, 100), n: plies };
}

/** Time management = fraction of player blunders preceded by an unusually fast move. */
function timeScore(analyses: GameAnalysis[]): { score: number; n: number } {
  let blunders = 0;
  let rushed = 0;
  let haveClocks = false;
  for (const a of analyses) {
    for (const ply of a.plies) {
      if (ply.color !== a.playerColor) continue;
      if (ply.secondsSpent != null) haveClocks = true;
      if (ply.severity === 'blunder') {
        blunders += 1;
        if (ply.secondsSpent != null && ply.secondsSpent <= 5) rushed += 1;
      }
    }
  }
  if (!haveClocks || blunders === 0) return { score: 50, n: 0 };
  const rate = rushed / blunders;
  return { score: clamp(Math.round(100 - rate * 100), 0, 100), n: blunders };
}

// Minimum evidence before a dimension is TRUSTED. Below this it is reported as
// "not measured" (sampleSize 0, neutral 50) instead of scored. Rationale (balance
// fix): a single short calibration game can't fairly grade endgame conversion,
// time, or resilience, and an empty phase must NOT read as a perfect 100 on the
// radar — the old `acplToScore(0)` → 100 trap inflated Endgame whenever no endgame
// was reached, while a single losing dip pinned Resilience to 0. One policy point
// here keeps every consumer (radar/program/strengths/dashboard) honest.
const MIN_PHASE_PLIES = 4;
const MIN_BEHIND_EPISODES = 3;
const MIN_TIME_BLUNDERS = 2;
const MIN_TACTICS_PLIES = 4;

/** Emit a measured cell, or collapse to a neutral "not measured" one when evidence is too thin. */
function dimensionScore(
  dimension: Dimension,
  measured: boolean,
  score: number,
  detail: string,
  n: number,
  unmeasuredDetail: string,
): DimensionScore {
  return measured
    ? { dimension, score, detail, sampleSize: n }
    : { dimension, score: 50, detail: unmeasuredDetail, sampleSize: 0 };
}

export function buildWeaknessProfile(analyses: GameAnalysis[], playerRating: number, locale: Locale = 'fr'): WeaknessProfile {
  const expected = expectedAcpl(playerRating);

  const opening = phaseAcpl(analyses, 'opening');
  const endgame = phaseAcpl(analyses, 'endgame');
  const tactics = tacticsScore(analyses);
  const time = timeScore(analyses);
  const resilience = resilienceScore(analyses);

  const dimensions: DimensionScore[] = [
    dimensionScore(
      'tactics', tactics.n >= MIN_TACTICS_PLIES,
      tactics.score, gt('weakness.tacticsDetail', locale, { n: tactics.n }),
      tactics.n, gt('weakness.tacticsUnmeasured', locale),
    ),
    dimensionScore(
      'openingAccuracy', opening.n >= MIN_PHASE_PLIES,
      acplToScore(opening.acpl, expected),
      gt('weakness.openingDetail', locale, { acpl: Math.round(opening.acpl), exp: Math.round(expected) }),
      opening.n, gt('weakness.openingUnmeasured', locale),
    ),
    dimensionScore(
      'endgameConversion', endgame.n >= MIN_PHASE_PLIES,
      acplToScore(endgame.acpl, expected),
      gt('weakness.endgameDetail', locale, { acpl: Math.round(endgame.acpl), exp: Math.round(expected) }),
      endgame.n, gt('weakness.endgameUnmeasured', locale),
    ),
    dimensionScore(
      'timeManagement', time.n >= MIN_TIME_BLUNDERS,
      time.score, gt('weakness.timeDetail', locale, { n: time.n }),
      time.n, gt('weakness.timeUnmeasured', locale),
    ),
    dimensionScore(
      'resilience', resilience.n >= MIN_BEHIND_EPISODES,
      resilience.score, gt('weakness.resilienceDetail', locale, { n: resilience.n }),
      resilience.n, gt('weakness.resilienceUnmeasured', locale),
    ),
  ];

  // Weakest dimension with enough data to trust.
  const ranked = dimensions.filter((d) => d.sampleSize >= 3).sort((a, b) => a.score - b.score);
  const weakest = ranked.length > 0 ? ranked[0].dimension : null;

  let playerMoves = 0;
  let lossSum = 0;
  for (const a of analyses) {
    for (const ply of a.plies) {
      if (ply.color === a.playerColor) {
        playerMoves += 1;
        lossSum += ply.cpLoss;
      }
    }
  }

  return {
    dimensions,
    weakest,
    gamesAnalyzed: analyses.length,
    playerMoves,
    overallAcpl: playerMoves > 0 ? Math.round(lossSum / playerMoves) : 0,
  };
}
