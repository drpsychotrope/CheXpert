// Pure decision core for "accept an alternate winning move" (T1, Q-A).
//
// A tactics puzzle has a single scripted solution line, but a position can have more than
// one winning move. When the player deviates from the line yet plays something the engine
// confirms is *also* clearly winning, that is a solve, not a miss. This module owns ONLY
// the decision (a pure comparison of two White-POV evals); the async engine eval and the
// honest fall-through-to-miss on error/timeout live in the component (AP-TFEED-6: no engine
// here, no Date, no Math.random). Deterministic and fully unit-testable without the worker.

/** Tunable thresholds for accepting an alternate winning move. Defaults: 50 / 200 (Q-A). */
export interface AltMovePolicy {
  /** Max centipawn gap below the mainline best the played move may be (relative gate). */
  withinCp: number;
  /** The played move must be winning for the solver by at least this much (absolute gate). */
  winningFloorCp: number;
}

export const DEFAULT_ALT_MOVE_POLICY: AltMovePolicy = { withinCp: 50, winningFloorCp: 200 };

/** One engine line/eval. Mirrors EngineClient.LineResult/EvalResult fields we read. */
export interface LineEval {
  uci: string | null;
  /** White-POV centipawns (mate clamped large) — ALWAYS from White's perspective. */
  whiteCp: number;
  /** Forced-mate distance from the mover's POV, if any (sign per the mover). */
  mate?: number;
}

/** Score from the SOLVER's point of view (positive = good for the solver). */
function solverCp(solver: 'white' | 'black', e: LineEval): number {
  return solver === 'white' ? e.whiteCp : -e.whiteCp;
}

/**
 * PURE. Decide whether the played move is an acceptable alternate win for `solver`.
 *
 * Both `bestLine` (the position's mainline-best, before the move) and `playedLine` (the eval
 * of the resulting position) are supplied as White-POV evals by the caller. This function
 * flips sign internally for a Black solver, so callers pass raw White-POV numbers and do NOT
 * negate (refiner D5).
 *
 * Accept iff EITHER:
 *  - the played move is a forced mate FOR the solver (mate-distance sign favours the solver), OR
 *  - the played move is within `withinCp` of the mainline best (|bestForSolver - playedForSolver|)
 *    AND is itself clearly winning for the solver beyond `winningFloorCp`.
 *
 * The dual gate is the honesty guard: a relative-only test would accept a "less bad" losing
 * move; an absolute-only test would reject a thin +0.3 quiet-tactic puzzle (Q-A).
 */
export function acceptAltMove(
  solver: 'white' | 'black',
  bestLine: LineEval,
  playedLine: LineEval,
  policy: AltMovePolicy = DEFAULT_ALT_MOVE_POLICY,
): boolean {
  // Mate FOR the solver. mate is from the position's mover POV; in `playedLine` the mover is
  // the OPPONENT (the played move was already applied), so the solver is mated when mate > 0
  // and delivering mate when mate < 0. Guard the rare mate === 0 (no real forced mate).
  if (playedLine.mate != null && playedLine.mate < 0) return true;
  // A mate AGAINST the solver in the resulting position is never an acceptable "win".
  if (playedLine.mate != null && playedLine.mate > 0) return false;

  const best = solverCp(solver, bestLine);
  const played = solverCp(solver, playedLine);

  const withinBest = best - played <= policy.withinCp; // played not materially worse than best
  const clearlyWinning = played >= policy.winningFloorCp; // and itself a real win for the solver
  return withinBest && clearlyWinning;
}
