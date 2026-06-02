# Refiner — `concept-cards` cycle 1

**Spec:** `specs/concept-cards-spec.md` · **Date:** 2026-06-02 · **Reviewer pass:** adversarial vs doctrine + scan contract + anchors.

## Verdict
No **critical structural defect** → no escalation. Architecture is sound and precedent-matched
(pure loader mirroring `eco.ts`; additive field per scan contract; non-blocking link preserving
active recall). 1 logic defect + 1 substantive clarification + 3 polish. Fixes applied this cycle.

## Findings

### F1 (defect — logic) — Leech offers wrongly suppressed by `conceptSeen` [FIXED]
V0 §2.3/§4.5 said "append the motif to `conceptSeen` on offer" for **both** triggers. That makes a
leech offer fire at most once per motif: after the first-exposure offer adds `fork`, a puzzle you
keep failing whose motif is `fork` would never re-offer its card — defeating trigger (b), the whole
point of the leech path. **Fix:** the two triggers are now **independent**. `conceptSeen` gates and
is updated by **only** the first-exposure branch; the leech branch reads neither (`isLeech` on the
puzzle's own fail count), so a re-failed leech keeps offering. Propagated to §2.3, §4.5, §7, AP-CC-5.

### F2 (clarification — correctness) — First-exposure keys off *resolved* motif, not raw themes [FIXED]
A curated puzzle can carry Lichess themes the detector never emits (the DB has 64 themes; the curated
subset may tag e.g. `advancedPawn`). If `conceptSeen` stored raw themes, an un-carded theme would
"burn" a non-existent offer and `knightFork` vs `fork` puzzles wouldn't share exposure. **Fix:**
store the **resolved card motif** (`cardForThemes` family key); a `null` resolution stores nothing and
shows no link. Stated in §2.3.

### F3 (polish) — Async fail-count read not specified
"Tactics computes the current puzzle's fail count" omitted that this is an async IndexedDB read at
puzzle **load** over the `puzzleId` index, counting failures *before* the current session's attempt.
Added to §4.5 (`db.getAllFromIndex('puzzleAttempts','puzzleId', id)`).

### F4 (polish) — §7 anti-pattern count off-by-one [FIXED]
§7 said "AP-CC-1..6" but §9 defines 7 (AP-CC-7 = the shared-tally/DRY guard). Corrected to AP-CC-1..7.

### F5 (polish) — ETL determinism not tested (vs openings spec)
The openings spec spot-tests ETL determinism. Here the asset is **curated, not generated**, so the
legality test (`concepts.seed.test.ts`) is the load-bearing guard, and `build-concepts.mjs` is a
validator/normalizer rather than a generator. Determinism test deemed **not required**; noted, not
added (keeps §5 lean). No change.

## Doctrine / contract checks (pass)
- **No LLM / curated content** — AP-CC-1; cards are static hand-authored data. ✓
- **Intellectual honesty** — cards only for `detectMotif` high-confidence keys; §5 seed test asserts
  coverage == detector set; AP-CC-2. Mirrors ADR-0007/0020. ✓
- **No `Date.now`/`Math.random` in cores** — `concepts.ts`, `isLeech`, `failCountByPuzzle`, lookups all
  pure; loader is the only I/O (injectable `fetchFn`, like `PuzzleRepo`). ✓
- **No schema bump** — `conceptSeen` additive on PlayerModel, migrate-in-load `?? []`; matches scan
  AUTHORITATIVE contract (only a new object store bumps v4→v5). AP-CC-6. ✓
- **Phase order code→tests→verify→docs** — §4→§5→§6→§7. ✓
- **ADR at implementation** — §7 specifies provisional **ADR-0040** (not written now). ✓
- **AP prefix** — spec-local `AP-CC-N` (avoids colliding with the batch's global AP-CHESS-67+ run). ✓

## Delta vs V0
Substantive: 1 (F1). Plus F2 clarification, F3/F4 polish. ~ moderate change (>10%) → proceed to cycle 2.
