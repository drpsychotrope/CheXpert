# Spec — `openings`: ECO naming + repertoire-gap + explorer

**Scope:** feature (bundles #3 repertoire-gap, opening explorer) · **Status:** V1 (3 cycles) · **Date:** 2026-06-01
Batch 2, spec B of 6.

## §0 Context
The opening side of the loop is thin: a small steering book ([openingBook.ts](../src/opening/openingBook.ts))
and an FSRS-drilled [repertoire](../src/repertoire). Nothing names your openings, tells you where you
leave theory, or lets you browse lines. This spec ships **ECO data** (CC0) and uses it to (1) **name**
each analysed game's opening, (2) flag the **first out-of-book move** ("you left the Sicilian at move 8"),
(3) one-click **add that line to your repertoire**, and (4) a minimal local **explorer** (name + your
deviation). No backend; data is bundled static.

## §1 Empirical baseline
- Lichess `chess-openings` (a–e TSVs, CC0): ~3500 named lines (ECO code, name, opening moves). Same CC0 provenance as the puzzle DB / Syzygy already used.
- No ECO logic exists today; `openingBook.ts` is steering-only. Repertoire builder validates lines via chess.js.
- 162 tests, svelte-check clean. AP-CHESS 51-53. ADR-0028.

## §2 Scope
**In:**
- `public/openings/eco.json` — compact bundled ECO table (`{eco, name, uci: string[]}`), produced by a small ETL script `scripts/build-eco.mjs` from the CC0 TSVs (committed output, like seed-puzzles).
- `src/opening/eco.ts` — `nameOpening(uciMoves)` → `{eco, name, plyInBook}` via longest-prefix match; `firstOutOfBook(uciMoves)` → ply index where the game leaves all book lines.
- Analysis annotation: compute opening name + first-out-of-book ply for a game (from its UCI move list) and surface in `AnalysisResult.svelte` ("Opening: Najdorf Sicilian — you left book at move 8 (…d6→…a6 was the line)").
- Repertoire link: an "Add this line to repertoire" action seeding the played prefix up to the deviation into the repertoire builder.
- Explorer (minimal): a view to type/paste moves and see the named line + continuations from the bundled table (no game-frequency stats — that's follow-up).
**Deferred:** game-frequency / win-rate stats explorer (needs a stats DB); transposition-aware naming beyond prefix match.

## §3 Pre-flight gates
1. CC0 ECO source available to the ETL; output JSON committed under `public/openings/`.
2. `repertoire.ts` exposes a way to seed a line (or add one); chess.js validates.
3. `AnalysisResult.svelte` present (eval-graph spec). 162 tests green.

## §4 Phase A — code
### §4.1 ETL + data
`scripts/build-eco.mjs`: parse a–e TSVs → `[{eco,name,uci}]` (SAN→UCI via chess.js), write `public/openings/eco.json`. Commit the JSON (offline-ready, like `seed-puzzles.json`). `npm run etl:eco` wired.
### §4.2 `eco.ts` (pure)
- Build a prefix index of book lines (UCI). `nameOpening(uci)` returns the longest book line that is a prefix of (or equals) the game → its eco/name + `plyInBook` (length of that prefix). `firstOutOfBook(uci)` = `plyInBook` (first ply not covered by any book line). Pure, unit-tested.
### §4.3 Analysis surface
Compute the game's UCI list (already parsed in analysis) → `nameOpening` + `firstOutOfBook`. Show in `AnalysisResult`: opening name, and "left book at move N" with the side. (Read-only; no engine.)
### §4.4 Repertoire link + explorer
- "Add to repertoire" button → seed the in-book prefix (+ optionally the engine's better continuation) into the repertoire builder, validated by chess.js.
- `src/ui/Explorer.svelte` (new, minimal): input moves → named line + immediate book continuations from `eco.json`. Add `'explorer'` to the View union + nav/Dashboard link.

## §5 Phase B — tests
- `eco.test.ts`: `nameOpening` longest-prefix (e.g. 1.e4 c5 2.Nf3 d6 → Sicilian, then Najdorf deeper), `firstOutOfBook` index on a line that deviates, exact-line match, unknown/empty.
- ETL determinism (script produces stable JSON given fixed input) — spot test on a small fixture.

## §6 Phase C — verification
`npm test` green incl. `eco.test.ts`; svelte-check clean; manual: analyse a game → opening named + deviation shown → "Add to repertoire" creates the line; Explorer names a typed line.

## §7 Phase Z — docs
ADR-0028 (ship CC0 ECO data; prefix-match naming + repertoire-gap; stats-explorer deferred). README: add opening naming, "where you leave book", and the explorer to features; ATTRIBUTION for chess-openings (CC0).

## §8 Acceptance
Games are named with ECO + first-out-of-book ply; "Add to repertoire" seeds the line; Explorer names typed lines; data bundled (offline); `eco.ts` unit-tested; no schema; ADR/README/ATTRIBUTION updated.

## §9 Anti-patterns
- **AP-CHESS-51** — Naming by exact full-game match (brittle); must use longest-prefix and report the deepest matching named line.
- **AP-CHESS-52** — Shipping the raw multi-MB TSVs or fetching them at runtime; commit a compact bundled JSON (offline, local-only).
- **AP-CHESS-53** — SAN/UCI conversion drift in the ETL (validate every line through chess.js; drop lines that don't parse, log count).

## §10 Rollback
New data file + ETL + `eco.ts` + 1 view + additive AnalysisResult lines + a repertoire seed action. No schema. Revert files + View-union/nav additions; repertoire unaffected.

## §11 Follow-up
Frequency/win-rate stats explorer (bundled stats subset); transposition-aware naming; "repertoire coverage vs your games" report (which of your openings you have/haven't prepared).
