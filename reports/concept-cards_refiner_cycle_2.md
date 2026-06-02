# Refiner — `concept-cards` cycle 2

**Spec:** `specs/concept-cards-spec.md` · **Date:** 2026-06-02 · **Pass:** what cycle 1 didn't catch (test mechanism, loader boundary).

## Verdict
0 critical defects. 1 substantive fix (seed-test disk-read mechanism) + 1 boundary tightening. Both
applied. Cycle 3 **skipped** per stop rule (cycle 2 had 0 critical AND ≤8 polish; delta now small).

## Findings

### F1 (substantive — testability) — Seed test mechanism was underspecified [FIXED]
V0/cycle-1 §5 said "load the **real** committed `concepts.json`" without saying *how*. Verified
against the repo: **no test fetches a real `public/**` asset** — `PuzzleRepo.test.ts` injects a fake
`fetchFn` with inline fixtures, and `eco.test.ts` uses an in-memory `TABLE`. A naive
`loadConcepts()` (which calls `fetch('/concepts/...')`) would not resolve in the Vitest/node env, so
the guard could be written wrong or silently no-op. **Fix:** §5 now reads the asset **from disk** via
`JSON.parse(readFileSync(new URL('../../public/concepts/concepts.json', import.meta.url),'utf8'))` and
runs the chess.js legality asserts directly — explicitly **not** through the `fetch`-based loader.
Also tightened §4.2 to separate the **pure** lookups (table passed in, unit-tested on a fixture) from
the **browser-runtime** `loadConcepts` (exercised only via injected `fetchFn`), so the load-bearing
guard is the disk-read test, matching the `games.ts`/ADR-0017 "asserted-legal-in-tests" precedent.

### F2 (consistency) — Loader boundary stated [FIXED, with F1]
Made explicit that `loadConcepts` is the browser path and degrades to `[]`; the asset's correctness is
guaranteed by the disk-read test, not the loader. Removes ambiguity about which path tests use.

## Re-checks (pass, no change)
- **`cardForThemes` determinism** — total + deterministic via the ADR-0020 precedence list; a
  `['fork','pin']` puzzle always resolves to `fork`. ✓
- **Two-trigger independence (cycle-1 F1)** — re-read §4.5: first-exposure consults/updates
  `conceptSeen`; leech reads only the puzzle's fail count. Correct and unambiguous. ✓
- **No schema bump** — `conceptSeen` additive, `?? []`; AP-CC-6 forbids a bump/store. Matches scan
  AUTHORITATIVE contract. ✓
- **Honesty** — one card per detector family; §5 asserts coverage == detector set; alias table maps
  sub-tags to the family card. No card for an undetectable pattern. ✓
- **Nav wiring** — `'concepts'` View-union arm + nav link is the `'explorer'` precedent (openings). ✓
- **No new dependency** — chess.js (already present) is the only thing the ETL/test needs. ✓

## Delta vs cycle 1
1 substantive (F1) + 1 tightening (F2). No new arbitrages. < 10% delta and 0 critical → **stop; skip
cycle 3.**
