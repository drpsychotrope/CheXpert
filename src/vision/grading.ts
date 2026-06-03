// Vision-drill FSRS grade tuning (ADR-0043).

import { Grade, type GradeThresholds } from '../srs/fsrs';

/** Coordinate↔square is a sub-second recall task → speed-graded, vs the puzzle default (8000/25000). */
export const VISION_GRADE_THRESHOLDS: GradeThresholds = { fastMs: 1500, slowMs: 5000 };

/** Blindfold is a MEMORY task, not a speed task: grade on correctness only — a correct-but-slow
 *  recall after a ~3 s flash must not be penalised. Speed is ignored. */
export function blindfoldGrade(solved: boolean): Grade {
  return solved ? Grade.Good : Grade.Again;
}
