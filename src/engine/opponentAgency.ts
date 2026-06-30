// Opponent agency & realism decisions (Feature P3, spec §4.A0). PURE + DOM-free: no Date,
// no Math.random, no engine import. The resign/draw/difficulty/threshold decisions are pure
// numeric functions; the eval fetch (EngineClient.evaluate(fen,{fullStrength:true}).whiteCp) and
// any randomness stay at the call site, exactly like sampleHumanMove/coachEvalBad. This is what
// makes the §5 tests global-free (AP-OPPAGENCY-11).

import { clampElo, ELO_MAX } from './AdaptiveOpponent';

/** Player-chosen difficulty relative to the adaptive pool Elo. `adaptive` = today's behaviour. */
export type DifficultyMode = 'adaptive' | 'easier' | 'harder' | 'fixed';

/** Easier/Harder offset from the adaptive Elo (Q-A). */
export const DIFFICULTY_OFFSET = 200;

/** Resolve the bot's effective target Elo for the chosen mode (Q-A). Pure; always clamped. */
export function difficultyTargetElo(mode: DifficultyMode, adaptiveElo: number, fixedElo: number): number {
  switch (mode) {
    case 'easier':
      return clampElo(adaptiveElo - DIFFICULTY_OFFSET);
    case 'harder':
      return clampElo(adaptiveElo + DIFFICULTY_OFFSET);
    case 'fixed':
      return clampElo(fixedElo);
    case 'adaptive':
    default:
      return clampElo(adaptiveElo);
  }
}

// ── Bot resign (Q-B) ──────────────────────────────────────────────────────────
export const RESIGN_BASE_CP = 900; // cp deficit a TOP bot resigns at
export const RESIGN_PLIES = 4; // consecutive bot-decision plies the deficit must persist
/** Below this Elo a bot never resigns (a beginner grinds lost positions like a human). */
export const RESIGN_FLOOR_ELO = 1600;
const RESIGN_FLOOR_CP = 1800; // cp deficit required at RESIGN_FLOOR_ELO (more lenient than a top bot)

/**
 * The cp deficit (positive magnitude) a bot of the given Elo requires before it will resign.
 * Stronger bots resign on a smaller deficit (RESIGN_BASE_CP at ELO_MAX); weaker bots require a
 * larger one (up to RESIGN_FLOOR_CP at RESIGN_FLOOR_ELO); below the floor a bot never resigns
 * (Infinity). Monotonic: higher Elo → smaller (stricter) threshold → resigns sooner.
 */
export function resignThreshold(botElo: number): number {
  if (botElo < RESIGN_FLOOR_ELO) return Infinity;
  const span = ELO_MAX - RESIGN_FLOOR_ELO;
  const t = Math.min(1, Math.max(0, (botElo - RESIGN_FLOOR_ELO) / span)); // 0 at floor, 1 at max
  return Math.round(RESIGN_FLOOR_CP + t * (RESIGN_BASE_CP - RESIGN_FLOOR_CP));
}

/** Decide whether the bot resigns. Pure fn of (botPovCp, consecutiveLostPlies, botElo).
 *  True iff the bot is down by ≥ its Elo-scaled threshold for ≥ RESIGN_PLIES consecutive
 *  bot-decision plies. `botPovCp` is the full-strength eval from the BOT's POV (negative = losing). */
export function decideResign(args: { botPovCp: number; consecutiveLostPlies: number; botElo: number }): boolean {
  const threshold = resignThreshold(args.botElo);
  if (!Number.isFinite(threshold)) return false; // sub-floor bot never resigns
  return args.botPovCp <= -threshold && args.consecutiveLostPlies >= RESIGN_PLIES;
}

// ── Player draw-offer the bot accepts/declines (Q-C) ──────────────────────────
export const DRAW_CP = 30; // |whiteCp| within this is "dead equal"
export const DRAW_PLIES = 4; // consecutive equal plies before the bot will agree
const DRAW_WIN_MARGIN = 50; // bot declines if it's better than this from its POV

/** Decide whether the bot accepts a player's draw offer. Pure. Accept iff the position is dead
 *  equal (|whiteCp| ≤ DRAW_CP) for ≥ DRAW_PLIES AND the bot is not winning from its POV. */
export function decideAcceptDraw(args: { whiteCp: number; botSide: 'w' | 'b'; consecutiveEqualPlies: number }): boolean {
  const botPovCp = args.botSide === 'w' ? args.whiteCp : -args.whiteCp;
  if (botPovCp > DRAW_WIN_MARGIN) return false; // never agree while better (AP-OPPAGENCY-4)
  return Math.abs(args.whiteCp) <= DRAW_CP && args.consecutiveEqualPlies >= DRAW_PLIES;
}

// ── Difficulty-scaled coached-blunder threshold (Q-G) ─────────────────────────
const COACHED_MID_ELO = 2000;
const COACHED_MID_CP = 250; // legacy flat gate, reproduced at the mid pool (regression anchor)
const COACHED_SLOPE = 0.05; // cp per Elo away from mid
const COACHED_MIN_CP = 150;
const COACHED_MAX_CP = 400;

/** The cp gate replacing the flat 250 in coachEvalBad (Q-G), scaled by the active bot Elo:
 *  a stronger chosen opponent → a tighter (smaller) "that's a blunder" gate; weaker → looser.
 *  ≈ 250 at the mid pool so coached behaviour at a typical Elo is unchanged. Monotonic ↓ in Elo. */
export function coachedBlunderThreshold(botElo: number): number {
  const raw = COACHED_MID_CP + (COACHED_MID_ELO - botElo) * COACHED_SLOPE;
  return Math.round(Math.min(COACHED_MAX_CP, Math.max(COACHED_MIN_CP, raw)));
}

/** Adaptation-line selection (Q-D): how the bot's Elo moved for the NEXT game. Pure.
 *  Returns null for override games (no adaptation happened). */
export function adaptationDirection(
  mode: DifficultyMode,
  prevElo: number,
  nextElo: number,
): 'tougher' | 'easier' | 'unchanged' | null {
  if (mode !== 'adaptive') return null;
  if (nextElo > prevElo) return 'tougher';
  if (nextElo < prevElo) return 'easier';
  return 'unchanged';
}

/** Honesty predicate (Q-E / AP-OPPAGENCY-5): does this game fold into the adaptive pool + rating?
 *  Only `adaptive` games adapt; an override game persists a flagged GameRecord but skips the fold. */
export function gameAdaptsPool(mode: DifficultyMode): boolean {
  return mode === 'adaptive';
}
