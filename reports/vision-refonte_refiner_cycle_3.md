# Refiner cycle 3 — vision-refonte (deep / integration)

**Patches applied (from cycle 2):** F5 (between→count), F6 (`MASTERY_STABILITY_DAYS`), F7 (wording).

**New findings:**
- **F8 (load-bearing, integration):** `onSelect` wired to chessground `events.select` will **not fire
  on an empty square** unless `selectable: { enabled: true }`. The coordinate drill uses an empty
  board, so without this the *name→click* mode silently does nothing. Patched A9: when `onSelect` is
  set, also set `selectable.enabled = true` and `viewOnly = false` (keep `movable.free = false`).
  Added an explicit empty-square-click check to §6 verification.
- **F9 (note):** `genBlindfold` must mix occupied and empty squares so the *empty* answer is
  exercised; documented in A4.
- **F10 (note):** §10 rollback — orphan `vision-square` rows are benign; if reverted code restores the
  unscoped session gate, vision rows again inflate it, i.e. exactly the original (pre-feature)
  behavior. No data loss. Acceptable.

**Verification gates re-checked:** §6 step 4 (vision-due alone must not trigger the Review step) maps
directly to the A12 gate fix and the extended `SrsStore.test.ts`. Reproducible by a fresh reader.

**Counts:** critical = 0, polish = 1 (F8) + 2 notes. Proceed to cycle 4 (user override).
