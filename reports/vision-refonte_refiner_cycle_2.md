# Refiner cycle 2 — vision-refonte (polish + cross-axis)

**Patches applied (from cycle 1):**
- F1 → added `blindfoldGrade(solved) = solved ? Good : Again` to `grading.ts` (A2); blindfold flow
  (A10) now grades on correctness only.
- F2 → `pieceAt` returns the case-sensitive FEN char; blindfold picker is 12 pieces (both colours) +
  empty; colour is part of the answer (A4, A10).
- F3 → documented: untrained squares are covered by the un-seeded uniform random selection; they
  count as not-mastered against the fixed denominator 64 (A6).

**New findings:**
- **F5 (usability):** `genRelation` `between` returning `string[]` forces a "name the squares" input
  that is awkward to score. Changed `between` answer to the numeric **count** `squaresBetween().length`
  (boolean kinds stay yes/no). Easier input, still forces seeing the line. (A3, A10, §5.)
- **F6 (clarity):** `visionMastery` threshold named `MASTERY_STABILITY_DAYS` (default 21, FSRS
  stability is in days), tunable. (A6.)
- **F7 (wording):** standardise verification command on `npm test` (script = `vitest run`). (minor.)

**Cross-axis checks:** §4↔§8 consistent (coordinate+blindfold write cards; per-drill stats persist);
AP-VISION-5 (no Date.now in core) holds — `reviewItem`/`Date.now` live in the UI, not in `src/vision/*`;
gates in §8 are measurable.

**Counts:** critical = 0, polish = 3. Skip-evaluator would skip cycle 3 (0 critical, polish ≤ 8) —
**overridden by user request for 4 cycles.** Proceed to cycle 3.
