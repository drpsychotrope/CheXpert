# Enrichments — trainer-personalization (T2)

**Method** `/enrich` 3 cycles · 8-axis sweep · verdicts FOLD / DEFER / REJECT · head `9296aff`.
**Anti-fabrication discipline**: each finding cites a real file/line or an existing spec contract; no
capability invented to pad the count. **The IN scope set must not grow speculatively** — only findings
that strengthen the *stated* single concern (self-targeting trainer + "from your games" voice) FOLD;
everything adjacent DEFERs to its owning PR. Net scope additions this pass: **2 FOLD** (both small,
in-concern). Empty would have been CLEAN; it is not empty, but it is tightly bounded.

## Axes swept
capability-gap · observability · render-fidelity · robustness · reuse · extensibility · symmetry · honest-framing

---

## Cycle 1 — sweep (raw findings)

| # | Axis | Finding | Evidence |
|---|---|---|---|
| E1 | render-fidelity | The after-solve "missed win" must render SAN from a UCI; the spec said "verify a helper" — it EXISTS: `ChessGame.moveUci(uci) -> SAN` (`ChessGame.ts:222`). Pin it so the builder doesn't reinvent. | `ChessGame.ts:222,185` |
| E2 | robustness | A personal puzzle could carry `meta` but a malformed/missing field (e.g. legacy generator output before all 6 fields existed). `provenanceOf` must tolerate partial `meta` and return `null`/degrade, not throw. | `puzzle.ts:18` `meta?: Record<string,string>`; generator at `:100` is current but old rows may differ |
| E3 | honest-framing | `kind:'mistake'` vs `'missed-win'` should change the after-solve wording ("the win you left" only fits missed-win; a mistake's solution is "the move you missed"). Already two post-variants in §4/§8 — keep, it's correct framing. | `generatePuzzles.ts:55` kind union |
| E4 | symmetry | The pre-solve provenance is trainer-only; the SAME personal puzzle reappears in **Review** (SRS) with no provenance — asymmetric voice. | `Review.svelte` consumes puzzle cards; no `meta` read |
| E5 | capability-gap | A "deep-link to the source game" from the provenance line would close the loop (game → mistake → puzzle → back to game). | needs `getAllGames` (F5) |
| E6 | observability | No counter of how often personal vs curated vs mixed is chosen — would inform whether the toggle is used. | telemetry is local-only; app has no event log |
| E7 | extensibility | Difficulty band is session-only; a user may want it sticky per source. | §0.5 Q-C decided coarse+ephemeral |
| E8 | reuse | The theme picker re-lists motifs; the dashboard already has a theme→drill control. Risk of two divergent theme lists. | `tacticsFilterThemes` is the shared routing field |
| E9 | render-fidelity | The toggle + picker + difficulty add 3 controls to a screen that is mid-puzzle; clutter / focus risk during solving. | `Tactics.svelte` markup density |
| E10 | robustness | "Widen range" could loop forever if a theme has zero puzzles at any width; need a terminal escalation. | §4 A5 already has `themeExhaustedWidened` |
| E11 | honest-framing | Persisting `trainerSource` means a returning user could be "stuck" in Curated and never see their personal puzzles — silently hiding the standout feature (the inverse of TR4). | new `trainerSource?` default `mixed` |

## Cycle 2 — prune / classify

| # | Verdict | Reasoning |
|---|---|---|
| **E1** | **FOLD** | Concrete, zero-risk precision: name `ChessGame.moveUci` as the SAN source in §3 + §4 A2. Prevents a reinvented parser. In-concern (the provenance render). |
| **E2** | **FOLD** | Real robustness for the *stated* feature: `provenanceOf` must degrade on partial/legacy `meta` (return what's present or `null`), never throw mid-solve. Add an explicit test case + an AP. In-concern. |
| E3 | KEEP (already in V1) | The two post-variants are already specced (§8 `provenancePostWin`/`provenancePostMove`). No change. |
| **E4** | **DEFER → T1/Review follow-up** | Surfacing provenance in Review is a *different surface*; T2's single concern is the **trainer**. Already listed in §11. Folding it would widen scope (AP — single concern). |
| **E5** | **DEFER → after F5** | Deep-link needs `getAllGames` (F5, unbuilt). Already in §11. REJECT-for-now as in-PR (no dependency on disk), DEFER as a real future idea. |
| **E6** | **REJECT** | The app is a local-first PWA with no event-telemetry surface; adding usage counters is a new subsystem, out of concern and against the "no new subsystem" cap. |
| **E7** | **DEFER** | Q-C deliberately chose coarse+ephemeral (AP-TPERS-7). Sticky difficulty is a future nicety; already in §11. |
| **E8** | **FOLD (into existing A4, no new scope)** | Not a new capability — a *consistency constraint*: the in-trainer theme picker MUST write the same `tacticsFilterThemes` the dashboard uses and source its label set from the same `motif.*`/`motifLabelOrRaw`, so the two controls can't diverge. Tighten A4 wording + add an AP. No scope growth. |
| E9 | MITIGATE (wording, not scope) | Address by collapsing the controls into a compact row and only showing the difficulty/theme picker in the no-drill state (not during a dashboard drill). Note in §4; not a new feature. |
| E10 | KEEP (already in V1) | `themeExhaustedWidened` already escalates; ensure widen is bounded (one widen → if still null, offer switch only). Tighten A5 wording. |
| **E11** | **FOLD (honest-framing guard, no new scope)** | This is the *inverse TR4 risk* and directly serves the single concern (don't bury "from your games"). Resolution is a constraint, not a feature: default `trainerSource` is **mixed** (never persist a default that hides personal puzzles for a fresh profile), and the toggle always offers a one-click return to Mixed/From-my-games. Add as an AP + verification step. |

## Cycle 3 — conditional / final fold decision

| # | Final | Action in spec |
|---|---|---|
| **E1** | **FOLD** | §3 pre-flight + §4 A2 name `ChessGame.moveUci(puzzle.moves[0])` as the SAN source; §5 add a test that the after-solve SAN matches `new ChessGame(fen).moveUci(moves[0])`. |
| **E2** | **FOLD** | §4 A1 `provenanceOf` contract: tolerate partial/legacy `meta`, return `null` if the essential fields (`moveNumber`,`playedMove`,`severity`) are absent; never throw. §5 add the partial-`meta` test. New **AP-TPERS-10**. |
| **E8** | **FOLD** | §4 A4 tighten: the in-trainer theme picker writes the **same** `tacticsFilterThemes` and uses the **same** `motifLabelOrRaw` label set as the dashboard (single source of truth). New **AP-TPERS-11**. |
| **E11** | **FOLD** | §3 + §6 + §9: default `trainerSource ?? 'mixed'`; never auto-persist a source that hides personal puzzles for a fresh/legacy profile; toggle always one click from Mixed. New **AP-TPERS-12**. |
| E9 | FOLD-as-wording | §4 note: compact control row; theme/difficulty picker only in the no-drill state. (No new key, no new behaviour.) |
| E4,E5,E6,E7,E10 | DEFER/REJECT/KEEP | E4/E5/E7 already in §11; E6 rejected; E10 already covered (tighten A5 wording). |

**Diminishing returns**: cycle 3 produced no NEW findings beyond folding cycle-2 verdicts → stop.

---

## FOLD set (applied to V1) — 4 findings

| FOLD | One-line | Axis |
|---|---|---|
| **E1** | Pin `ChessGame.moveUci` as the UCI→SAN source for the after-solve "missed win" (no reinvented parser). | render-fidelity |
| **E2** | `provenanceOf` tolerates partial/legacy `meta` (returns `null`, never throws mid-solve) — new AP-TPERS-10. | robustness |
| **E8** | In-trainer theme picker shares the dashboard's `tacticsFilterThemes` + `motifLabelOrRaw` labels (no divergent list) — new AP-TPERS-11. | reuse |
| **E11** | Default `trainerSource ?? 'mixed'`; never persist a default that buries personal puzzles; one-click back to Mixed — new AP-TPERS-12. | honest-framing |

## DEFER (real ideas, wrong PR / not yet buildable)
- **E4** Provenance in Review (different surface) → §11.
- **E5** Deep-link provenance → source game (needs F5 `getAllGames`, unbuilt) → §11.
- **E7** Sticky per-source difficulty (Q-C chose coarse+ephemeral) → §11.

## REJECT (out of concern / new subsystem)
- **E6** Usage telemetry for toggle choices — no event-log subsystem in a local-first PWA; out of scope.

## Anti-fabrication statement
The sweep did **not** invent puzzle metadata, a new store, a new routing key, or a recording change.
All four FOLDs are constraints/precision on the *already-stated* scope (provenance render, theme reuse,
honest default) — the IN set did not grow into new capability territory. Adjacent capabilities (Review
parity, game deep-link, telemetry, sticky difficulty) were held OUT.
