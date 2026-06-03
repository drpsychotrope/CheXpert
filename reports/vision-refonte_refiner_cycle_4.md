# Refiner cycle 4 — vision-refonte (final sweep)

**Patches applied (from cycle 3):** F8 (`selectable.enabled` + empty-square verification), F9/F10 notes.

**Final sweep:**
- Cross-link correctness: ADR-0018 is indeed the original vision-drills decision (`vision.ts` header
  cites it) → supersede link in §7 is correct. FSRS reuse cites ADR-0010/0011 correctly.
- `import('../vision/visionStats').VisionStats` inline type in `db.ts` introduces no runtime cycle
  (`visionStats.ts` imports nothing from `db.ts`); type-only, standard TS.
- §9 anti-patterns (7) all map to a concrete edit or gate; AP-VISION-4 (no vision leak into Review)
  is double-covered by §4 A12 + the extended `SrsStore.test.ts`.

**New findings:**
- **F11 (trivial):** none material — one wording nit (`npm test` vs `vitest run`) already handled in
  cycle 2. No code/scope impact.

**Decreasing-returns check (§4.4):** cycle 4 material defects ≈ 0 vs cycle 3's 1 → < 10%. Converged.

**Counts:** critical = 0, polish = 0 material. Spec is V1, ready to execute pending the Q-A decision.
