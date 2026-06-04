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

/** 1-based index of the user's first wrong move, derived from gradeCalcLine's
 *  solvedPlies. solvedPlies is the solution index of the first wrong USER ply
 *  (always even, because user plies sit at solution indices 0,2,4,…).
 *  Only meaningful when gradeCalcLine returned correct === false. */
export function firstWrongUserMove(solvedPlies: number): number {
  return Math.floor(solvedPlies / 2) + 1;
}

/** Number a SAN ply list into a readable line:
 *  ['Nf3','e5','Bc4'] -> "1.Nf3 e5 2.Bc4". White-first numbering. */
export function formatSanLine(san: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < san.length; i += 2) {
    const n = i / 2 + 1;
    out.push(san[i + 1] ? `${n}.${san[i]} ${san[i + 1]}` : `${n}.${san[i]}`);
  }
  return out.join(' ');
}
