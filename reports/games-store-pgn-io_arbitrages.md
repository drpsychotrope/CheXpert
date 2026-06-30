# Arbitrages — games-store-pgn-io (F5)

**PR**: `games-store-pgn-io` · **Drafted**: 2026-06-30 · **Method**: `/draft-general` 4 refiner cycles
**Status**: recommended defaults APPLIED → V1 spec (`specs/games-store-pgn-io-spec.md`). Flip any to re-fold.

---

## Decisions bundle (RESOLVED — recommended defaults)

| Q | Decision | Default applied | Why (one line) |
|---|---|---|---|
| **Q-A** placement | section **inside Import view** | **a** | Import already owns PGN paste + `AnalysisResult`, reachable from Home + nav; a new view = 3 coupled edits for no gain. |
| **Q-B** import scope | **single-game paste now**, bulk DEFER | **a** | Existing paste flow is already hardened; bulk file is a separate concern (loop/progress/dedupe). |
| **Q-C** coach wiring | **primitive only**; coach-assessment → C4 | **a** | Single concern; folding CO11 couples F5 to the `CoachProfile` schema (C4's job). Hard boundary. |
| **Q-D** profile export | **DEFER to C8** | **defer** | CF10 exports a `CoachProfile` (different artifact/consumer); F5 is games/PGN. |

---

## Refiner cycles (4) — diminishing returns noted

### Cycle 1 — structural / premise (CRITICAL gate)
- **Premise verified empirically before drafting** (mandated). `games` store write-only in `src/` CONFIRMED (grep: readers = 0; `putGame` caller = 1 at `Play.svelte:450`). No STOP.
- **Biggest correction:** the architecture spec lists "PGN export" as a fold but **no export affordance exists anywhere** (no `Blob`/`createObjectURL`/`download=`). Reframed from "wire export" to "build a tiny greenfield client-side download helper over the already-stored `GameRecord.pgn`". Trivial, but it's *new surface* needing its own test.
- **DB gate:** `games.playedAt` index already exists (v1 upgrade) ⇒ a new read needs **no `DB_VERSION` bump**. Locked as AP-GAMES-1.
- Verdict: single, coherent concern. No split needed. Proceed.

### Cycle 2 — scope boundaries / arbitrage surfacing
- Surfaced Q-A..Q-D. Recommended defaults chosen to keep F5 single-concern.
- **Q-C boundary made explicit** in §0/§2/§9: F5 lands the *primitive* + a reachable "import & analyse a game" entry; coach assessment (CO11) is C4. Prevents the most likely scope creep.
- **id-namespace risk** found: played ids `g:<epoch>` (games store) vs imported `import:…` (importedGames store). `getAllGames` reads only `games` ⇒ no leakage. Locked AP-GAMES-8 + a §2 "imported-games history" defer.
- Diminishing returns starting: cycle added boundaries, not new concerns.

### Cycle 3 — reuse / DRY / honesty
- **Reuse maximised:** history "open analysis" reuses `AnalysisResult.svelte` (already shared by Import + Play); re-analyse reuses the `runAnalysis(source:'played')` + `getAnalysis`-idempotency pattern already in `Play.svelte:456-492` (extract-or-call, don't reinvent).
- **N+1 caught:** marking analysed/not per-row via `getAnalysis` is N reads → fold a single `getAnalyzedGameIds()` (`getAllKeys('gameAnalyses')` → Set). Locked AP-GAMES-3 / FOLD-G1.
- **Purity:** export filename must derive its date from `GameRecord.playedAt`, not `Date.now()`, so the helper core is testable. Locked AP-GAMES-6.
- **960 honesty:** 960 games appear in history but the Analyse action stays disabled (existing AP-960-4). Locked AP-GAMES-7.

### Cycle 4 — polish / acceptance / rollback (delta < 10% — STOP after)
- Tightened acceptance to explicit doctrine gates (no `DB_VERSION`, no network, fr+en parity, Insights byte-identity).
- Added rollback note: purely additive, no migration to undo.
- Confirmed bilingual placement: new keys under the existing `play` domain file (`history.*` sub-namespace) — no new domain file, no `messages/index.ts` churn, collision-test sum stays trivial.
- Delta vs cycle 3 is editorial only ⇒ **stop at 4** (returns exhausted).

---

## Rejected / not taken
- **New top-level `history` view** — rejected (Q-A); `View`-union + loaders + NAV churn for no benefit (AP-GAMES-4).
- **Bulk file import in F5** — deferred (Q-B); separate concern.
- **Imported-games in the same history list** — deferred; distinct store/read, scope creep.
- **Delete/manage/paginate history** — deferred; unnecessary at current volume.
