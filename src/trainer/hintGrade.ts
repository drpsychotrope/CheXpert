// Hint-integrity clamp policy (T3, TR5 / Q-B). PURE — no Date, no Math.random.
//
// A hinted solve means the player did NOT independently retrieve the move, so the reward
// must be withheld: the FSRS grade is capped to ≤ Hard (the card resurfaces soon in Review)
// AND the player's Glicko GAIN is skipped (the rating stays flat — neither raised nor
// dropped). A hinted solve must never grade as a clean win (AP-TINTEG-1); it must also never
// be punished into a rating drop or an Again (AP-TINTEG-2 — that would over-correct to Q-B(c)).
//
// The grade clamp composes with the FSRS first-exposure clamp (fsrs.ts:105, Easy→Good on a
// State.New card) as a net min(): a hint can only ever LOWER the effective grade, never raise
// it (AP-TINTEG-3). Both downgrade-only, so applying them in either order yields ≤ both caps.

import { Grade } from '../srs/fsrs';

/**
 * Cap a solve's FSRS grade when a hint was used (≤ Hard, Q-B). Returns the grade unchanged
 * when no hint was used, or when it is already ≤ the Hard cap (a miss → Again, or a slow
 * pass → Hard). Only Easy/Good outrank Hard and get clamped down. Never upgrades.
 */
export function clampGradeForHint(grade: Grade, usedHint: boolean): Grade {
  if (!usedHint) return grade;
  // Grade ordinals: Again(1) < Hard(2) < Good(3) < Easy(4). Cap at Hard.
  return grade > Grade.Hard ? Grade.Hard : grade;
}

/**
 * Should the player's Glicko GAIN be applied for this attempt? False on a hinted SOLVE
 * (the rating stays flat — neither raised nor dropped; the puzzle's own rating is left
 * unmoved too at the call site). A hinted MISS is unaffected here: a miss already lowers
 * the rating via the normal loss path, which is honest (the hint didn't save the solve).
 * (Q-B; AP-TINTEG-1/2.)
 */
export function applyGlickoGain(solved: boolean, usedHint: boolean): boolean {
  return !(solved && usedHint);
}
