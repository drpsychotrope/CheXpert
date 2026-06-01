# Spec — `scenario-sparring`: play out targeted positions vs the adaptive bot

**Scope:** feature (#7) · **Status:** V1 (3 cycles) · **Date:** 2026-06-01
Batch 2, spec D of 6. Builds on `weakness-intelligence` (A) and the comeback pattern (ADR-0025).

## §0 Context
`comeback` (ADR-0025) proved the value of playing out a specific position vs the adaptive bot. Generalise
it: spar from **targeted scenarios** — either *your own recurring weakness positions* (from the
fingerprint, spec A) or a curated **imbalance library** (IQP, opposite-side castling, bishop pair,
good-vs-bad bishop, minority attack, rook endings). Train the position type you choose, vs a beatable
bot at your level. Reuses the Play/Comeback vs-engine loop entirely; no new engine.

## §1 Empirical baseline
- `Play.svelte` + `Comeback.svelte` implement Board + `onMove` + `AdaptiveOpponent.pickMove(fen)` at `model.opponentTargetElo`.
- Spec A's `fingerprint` yields leak example FENs (optional source). 
- 162 tests, svelte-check clean. AP-CHESS 59-61. ADR-0030.

## §2 Scope
**In:**
- `src/analysis/scenarios.ts` — a static **imbalance library** (`{id, name, themeTag, fens: string[], sideToTrain}`) of legal start positions per imbalance, PLUS `scenariosFromWeakness(analyses)` reusing the fingerprint's leak FENs (when A is present). Pure.
- `src/ui/Sparring.svelte` — pick a scenario (imbalance or "from my games"); play it out vs the adaptive bot (reuse the Comeback loop); **outcome-graded** (win/hold = pass), consistent with ADR-0025. "Next scenario" / "Try again".
- View-union `'sparring'` + entry from Insights (A) and a nav/Dashboard link.
**Deferred:** engine-authored scenario generation; multi-position "ladders"; theory hints per imbalance.

## §3 Pre-flight gates
1. `AdaptiveOpponent.pickMove` + `model.opponentTargetElo` available; Comeback loop pattern present.
2. Imbalance FENs legal (validate with `scripts/validate-endgames.mjs`-style check or chess.js at build/test).
3. If A unshipped: `scenariosFromWeakness` returns [] gracefully (library still works). 162 tests green.

## §4 Phase A — code
### §4.1 `scenarios.ts` (pure)
- `IMBALANCE_LIBRARY: Scenario[]` — each a named imbalance with 1–3 legal FENs and the side the player trains. Validated (legal, side-to-move correct).
- `scenariosFromWeakness(analyses)` → Scenarios built from fingerprint leak FENs (label = the leak's motif/phase), most-impactful first; `[]` if no analyses.
### §4.2 `Sparring.svelte`
- Scenario picker (library categories + "From my games"). On select: `new ChessGame(fen)` → play vs `AdaptiveOpponent` at ZPD Elo, reusing the Comeback `onMove`/`engineMove`/`checkEnd` loop. Grade on outcome (win/draw vs the side-to-train's goal). Show the imbalance name + a one-line "what to aim for". Reachable from Insights + nav.

## §5 Phase B — tests
- `scenarios.test.ts`: every `IMBALANCE_LIBRARY` FEN is legal + side-to-move matches `sideToTrain` (chess.js); `scenariosFromWeakness` maps leak FENs → scenarios, empty when no analyses, ordered by impact.
- (Engine loop reused from Comeback — manual verification.)

## §6 Phase C — verification
`npm test` green incl. `scenarios.test.ts`; svelte-check clean; manual: pick an IQP scenario → play vs adaptive bot → outcome graded; "From my games" loads a leak position when analyses exist.

## §7 Phase Z — docs
ADR-0030 (scenario sparring: imbalance library + weakness-sourced, outcome-graded vs adaptive bot, reuses Comeback loop). README "Train & retain": add scenario sparring.

## §8 Acceptance
Imbalance library (legal, tested) + "from my games" scenarios; play out vs adaptive bot; outcome-graded; reachable from Insights; reuses Comeback loop (no new engine); ADR/README updated.

## §9 Anti-patterns
- **AP-CHESS-59** — Illegal/wrong-side scenario FENs (validate all, like endgame drills).
- **AP-CHESS-60** — Sparring at full engine strength instead of ZPD Elo (demoralising; mirror ADR-0025/AP-CHESS-41).
- **AP-CHESS-61** — Hard dependency on spec A: the library must work standalone; weakness-source degrades to empty if no fingerprint.

## §10 Rollback
New `scenarios.ts` + `Sparring.svelte` + View-union arm. No schema (scenarios derive from analyses + static library). Revert files + the arm.

## §11 Follow-up
Per-imbalance theory hints; scenario ladders; engine-curated scenarios from master games; track per-imbalance win-rate over time (feeds the trend in A).
