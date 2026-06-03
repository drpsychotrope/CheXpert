# Refiner cycle 1 — vision-refonte (critical-defect detection)

**Critical defects (STOP triggers):** none.
- Premise valid: square-colour is removable — the only consumers of the *function* `squareColor` are
  `vision.ts`/`Vision.svelte`; the studyPlan vision warm-up uses find-all, not square-colour. The
  function is retained; only the isolated drill is cut.
- Paths exist; `SrsItemKind` has no exhaustive switch → safe to extend.
- Empirical baseline present (§1, `reports/vision-refonte_baseline.json`). No inferred numbers.

**Non-critical findings (propagated to cycle 2):**
- **F1 (semantics, high):** blindfold graded with `VISION_GRADE_THRESHOLDS` (1500/5000 ms, tuned for
  instant coordinate recall) would mark every correct-but-slow blindfold answer as "Hard". Blindfold
  is a memory task, not a speed task → grade on correctness.
- **F2 (ambiguity):** blindfold answer's colour-sensitivity unspecified (`pieceAt` returns `'P'` vs
  `'p'`). Decide whether colour is part of the answer.
- **F3 (coverage):** `weakSquares` ranks only squares that already have a card; never-drilled squares
  are invisible. Clarify how untrained squares get covered.

**Verdict:** proceed to cycle 2.
