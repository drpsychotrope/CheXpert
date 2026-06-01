// Deep calculation trainer grader (spec C / 3a). The user commits a FULL forcing
// line; we grade it against the puzzle's stored solution (which is already the
// engine's verified best line — no live engine needed). Pure. Opponent replies are
// taken from the solution; we check the user's moves at their turns.

import { sameMove } from '../trainer/TacticalTrainer';

/**
 * @param solutionMoves alternating UCI line: user, opponent, user, opponent, …
 * @param userMoves the user's intended moves (their turns only), in order
 */
export function gradeCalcLine(solutionMoves: string[], userMoves: string[]): { correct: boolean; solvedPlies: number } {
  let i = 0; // index into solutionMoves
  let u = 0; // index into userMoves (user-side only)
  while (i < solutionMoves.length) {
    const got = userMoves[u];
    if (got == null || !sameMove(got, solutionMoves[i])) return { correct: false, solvedPlies: i };
    i += 1;
    u += 1;
    if (i < solutionMoves.length) i += 1; // skip the opponent's (auto) reply
  }
  return { correct: true, solvedPlies: solutionMoves.length };
}
