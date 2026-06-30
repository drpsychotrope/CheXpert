// Coach designed-position PROBES (feature C3, additive — no new ADR). PURE: no Date, no Math.random,
// no engine/Svelte imports (AP-CDESIGN-8). The single source of truth for WHICH designed positions the
// coach can hand the player to measure the two radar axes a short even game structurally under-measures
// — `endgameConversion` (needs a won position to convert) and `resilience` (needs a worse position to
// hold). diagnostic.ts stays the pure AGGREGATOR; scenarios.ts owns the FENs; Coach.svelte stays the
// impure driver (owns the engine, the Date boundary, and runAnalysis).
//
// Doctrine: a probe is n≈1 LEARNING EVIDENCE for ONE radar cell — never a graded result and never a
// rating-pool input (AP-CDESIGN-1/5, AP-COACH-8). The probe outcome is a single `DimensionScore` fed
// through buildCoachProfile's gameDimensions path with an HONEST small sampleSize; there is no pass/fail
// verdict (REJECT E1). We do NOT reuse `scenarioForFocus` (program.ts) for selection — it is routing-only
// and maps resilience→opp-castle, an ATTACK race, semantically wrong for a defend probe (AP-CDESIGN-6).

import type { Dimension, DimensionScore } from '../analysis/weakness';
import { IMBALANCE_LIBRARY, type Scenario } from '../analysis/scenarios';

/** The two radar axes a designed probe can measure (Q-A). */
export type ProbeDimension = 'endgameConversion' | 'resilience';

/** One designed probe: a seed position + the SINGLE radar cell it is allowed to emit. */
export interface CoachProbe {
  /** The axis this probe measures. */
  dimension: ProbeDimension;
  /** The position to play from (side to move == the side being trained — mirrored per player color). */
  seed: Scenario;
  /** The ONE radar cell this probe may emit (=== dimension; single-dimension extraction, AP-CDESIGN-2). */
  targetDimension: Dimension;
}

/** Look a library scenario up by id (build-time invariant: the id must exist). */
function libraryScenario(id: string): Scenario {
  const s = IMBALANCE_LIBRARY.find((x) => x.id === id);
  if (!s) throw new Error(`COACH_PROBES: missing IMBALANCE_LIBRARY scenario '${id}'`);
  return s;
}

/**
 * The probe registry (FOLD E4). V1 = exactly two entries:
 *  - conversion → `rook-up`        (reuse the existing conversion seed — a rook ending a PAWN UP)
 *  - resilience → `coach:defend-worse` (the one new coach seed — a rook ending a PAWN DOWN, defend)
 * A third probe later is DATA (another entry), not new code. `targetDimension === dimension` for every
 * entry (asserted in the registry-shape test).
 */
export const COACH_PROBES: CoachProbe[] = [
  { dimension: 'endgameConversion', seed: libraryScenario('rook-up'), targetDimension: 'endgameConversion' },
  { dimension: 'resilience', seed: libraryScenario('coach:defend-worse'), targetDimension: 'resilience' },
];

// ── Side symmetry (FOLD E5): play a probe from the player's color ────────────────────────────────────

const FILES = 'abcdefgh';

/** Flip a single en-passant square across the board's horizontal axis (file kept, rank 1..8 → 9-rank). */
function mirrorSquare(sq: string): string {
  if (sq === '-' || sq.length < 2) return sq;
  const file = sq[0];
  const rank = Number(sq[1]);
  if (!FILES.includes(file) || !(rank >= 1 && rank <= 8)) return sq;
  return file + String(9 - rank);
}

/** Swap the case of every castling-rights letter (KQkq ⇄ kqKQ), preserving order; '-' stays '-'. */
function mirrorCastling(rights: string): string {
  if (rights === '-') return rights;
  return rights
    .split('')
    .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
    .join('');
}

/**
 * Mirror a FEN across the board's horizontal axis AND swap colors (FOLD E5): rank 1 ⇄ rank 8, every
 * piece's color flips (case swap), the side to move flips, castling rights swap case, and the
 * en-passant square reflects (rank 3 ⇄ rank 6). Halfmove/fullmove clocks are preserved. PURE.
 *
 * Round-trips: `mirrorFen(mirrorFen(fen)) === fen` (asserted). The result is a legal position whenever
 * the input is (a color-and-rank reflection preserves legality), verified via chess.js in tests.
 */
export function mirrorFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  const [placement, side, castling = '-', ep = '-', half = '0', full = '1'] = parts;

  // Reverse the rank order, then swap the case of every piece letter in each rank (digits unchanged).
  const ranks = placement.split('/');
  const mirroredPlacement = ranks
    .slice()
    .reverse()
    .map((rank) =>
      rank
        .split('')
        .map((ch) => (/[a-zA-Z]/.test(ch) ? (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()) : ch))
        .join(''),
    )
    .join('/');

  const mirroredSide = side === 'w' ? 'b' : 'w';
  return [mirroredPlacement, mirroredSide, mirrorCastling(castling), mirrorSquare(ep), half, full].join(' ');
}

/**
 * The seed FEN for a probe, oriented so the player (the side being trained) is to move. The library
 * seeds are authored with `sideToTrain: 'w'`; for a Black player we mirror the FEN so Black is the side
 * to move AND the worse/winning side. Returns a FEN whose side-to-move === `side`. PURE.
 */
export function seedForSide(probe: CoachProbe, side: 'w' | 'b'): string {
  return side === probe.seed.sideToTrain ? probe.seed.fen : mirrorFen(probe.seed.fen);
}

// ── Single-dimension extraction (Q-C / AP-CDESIGN-2) ─────────────────────────────────────────────────

/**
 * Extract ONLY the probe's targeted radar cell from a `buildWeaknessProfile` output, replacing its
 * `detail` with the designed-position string (FOLD E2) while keeping the MEASURED `sampleSize` and
 * `score` from the analysis (AP-CDESIGN-4 — never inflated, never hard-coded). PURE.
 *
 * Honesty (AP-CDESIGN-3): if the targeted dimension came back `sampleSize 0` (the designed position
 * still produced too little evidence — e.g. instant resignation), the cell stays "not measured"
 * (score 50, sampleSize 0) and we do NOT attach the designed-position detail — there is nothing to
 * attribute to the probe. A genuinely measured cell carries the probe's `detail`.
 *
 * @param targetDimension the ONE cell this probe may emit (probe.targetDimension)
 * @param weaknessDims    the full DimensionScore[] from buildWeaknessProfile([probeAnalysis], …)
 * @param detail          the designed-position detail string (already localized by the caller via gt)
 */
export function extractProbeDim(
  targetDimension: Dimension,
  weaknessDims: DimensionScore[],
  detail: string,
): DimensionScore {
  const cell = weaknessDims.find((d) => d.dimension === targetDimension);
  // Absent (shouldn't happen — buildWeaknessProfile always emits all five) or thin → "not measured".
  if (!cell || cell.sampleSize <= 0) {
    return { dimension: targetDimension, score: 50, detail: cell?.detail ?? detail, sampleSize: 0 };
  }
  // Measured: keep the real score + sample size; name the designed position in the detail.
  return { dimension: targetDimension, score: cell.score, detail, sampleSize: cell.sampleSize };
}
