# play-loop-closure — /enrich (3 cycles, 8 axes)

**PR**: P1 · **Input**: `specs/play-loop-closure-spec.md` V1 (post 4 refiner cycles) · **2026-06-30**
Axes: A1 capability · A2 observability · A3 fidelity · A4 robustness · A5 reuse · A6 extensibility · A7 symmetry · A8 honest framing.
Discipline: FOLD (integrate) / DEFER (good, wrong PR or premature) / REJECT (violates scope/causality). **Anti-fabrication:** an axis with nothing real = **CLEAN** (not padded); the FOLD set must **not grow** across cycles. Cohérent-precedents are chess-trainer's own (additive-optional fields, honesty posture AP-CHESS-13/24, bilingual parity ADR-0053, F5's `getAnalyzedGameIds` read).

---

## Cycle 1 — sweep (find the real enrichments)

| Axis | Finding | Verdict |
|---|---|---|
| **A1 capability** | The Dashboard badge in V0 "links to the batch run". But a user with a large/mixed backlog wants to **see which games are pending and analyse selectively** before committing to a heavy engine run. **F5's history list already renders per-row analysed markers + per-row Analyse.** Point the badge at F5's history (selective) rather than blind-firing the whole batch; keep the one-click "Analyse all" on the **Play** over-screen (the natural "I just finished, do them now" moment). | **FOLD F-P1-1** |
| **A2 observability** | Auto-run-on-finish is silent + best-effort. On success the user has no signal it happened; on failure the game silently stays in the backlog (correct, but invisible). Surface a **minimal** outcome on the over screen: "analysed ✓" when auto-run completes, nothing intrusive on failure (it simply remains counted in the backlog the user can see). Dev-side: the batch runner's progress already exposes `{done,total,currentGameId}`. | **FOLD F-P1-2** |
| **A3 fidelity** | The "N unanalysed games" count MUST equal what the batch will actually process. The selector excludes **960** *and* **color-less legacy** records — so a naive count (e.g. `getAllGames().length - analyzed`) would show "3" while the batch does 1, an output that **lies**. Tie the displayed count to **`unanalyzedPlayedGames(...).length`** (the same pure function) everywhere (Play button, Dashboard badge). | **FOLD F-P1-3** |
| **A4 robustness** | If one game's `runAnalysis` throws mid-batch (engine crash/timeout — the existing `engineError` path proves this happens), the V0 runner could abort the whole run. Already-analysed games persist, but the remaining loop dies. Add a **per-game try/catch**: a single failure is recorded (`failed++`), the game stays in the backlog, and the runner **continues** to the next (or stops cleanly with the failed game still counted). The batch never strands progress. | **FOLD F-P1-4** |
| **A5 reuse** | `analyzePlayed()` (Play-tail single game), the batch loop, and the opt-in auto-run all share the identical sequence: `resetVariant` → `getAnalysis` guard → `runAnalysis(source:'played')` → render. Extract one core **`analyzeOnePlayedGame(engine, puzzles, model, game, opts)`** (where `game` carries `playerColor`); the tail button, the batch loop, and auto-run all call it. Kills triplication; one place to fix idempotency/960/color. | **FOLD F-P1-5** |
| **A6 extensibility** | The runner could return **per-game results** (not just the last) so a future "batch summary" view lists all N. Useful later; not needed for V1 (last-result render + counts suffice). Keep the return shape minimal now; widen when a summary view is actually built. | **DEFER** (→ §11) |
| **A7 symmetry** | The single-game, batch, and auto-run paths must behave **identically per game** (same guard, same 960 skip, same color source). This is *exactly* what F-P1-5's shared core enforces — symmetry is the **mechanism**, not a separate change. | **covered by F-P1-5** (no new fold) |
| **A8 honest framing** | "Analysing closes the loop / steers the next game" must not **overclaim**: a clean game yields no `weakest` dimension → steering stays neutral even after analysis (existing `buildWeaknessProfile` behaviour). The spec/copy should say the next game is steered **when a weakness is detected**, not unconditionally. No code — a framing guard in §6 + the affordance copy. | **FOLD F-P1-6** |

**Cycle-1 FOLD set (6):** F-P1-1 (A1), F-P1-2 (A2), F-P1-3 (A3), F-P1-4 (A4), F-P1-5 (A5, subsumes A7), F-P1-6 (A8). DEFER: A6. CLEAN: none beyond A7-into-A5.

## Cycle 2 — prune & consolidate (set must NOT grow)

Re-examined each cycle-1 fold for genuineness and overlap; sought (and found) **no new** folds — consistent with the skill's expectation that enrich converges fast once the refiner has done the structural work.

- **F-P1-1** — confirmed: it's a real capability + reuse-of-F5 win, and it *reduces* P1's surface (badge delegates to existing F5 history rather than P1 owning a second batch entry). Keep.
- **F-P1-2** — trimmed scope: success-only marker ("analysed ✓"); **no** error toast (failure visibility is the backlog count itself, which already shows). Avoids notification clutter. Keep (tightened).
- **F-P1-3** — confirmed essential (fidelity/anti-lying). This is the strongest fold: without it the count is wrong by construction. Keep.
- **F-P1-4** — confirmed: matches the existing engine-error reality (`Play.svelte:362-369`, `retryEngineMove`). Keep.
- **F-P1-5** — confirmed: the extraction is the backbone the other folds lean on (F-P1-2's marker, F-P1-3's color filter, F-P1-4's try/catch all live in the one core). Keep.
- **F-P1-6** — confirmed: honest framing is doctrine (AP-CHESS-13/24); the loop must not promise steering it can't guarantee. Keep.

**No additions.** A6 stays DEFER. **Cycle-2 FOLD set = cycle-1 FOLD set (6).** (Anti-fabrication satisfied: the set did not grow.)

## Cycle 3 — conditional / final confirmation (diminishing returns)

Adversarial last pass for anything the first two missed:
- **Did I miss a capability gap?** Bulk/idle auto-drain, per-row re-analyse, a batch summary — all already DEFERRED (§11) or owned by F5. No new FOLD.
- **Observability for the dev?** The runner's `onProgress`/return counts suffice; no logging/telemetry needed in a local-first app (and `allowNetwork` posture forbids remote telemetry). CLEAN.
- **Fidelity edge?** The count updates after each game (F-P1-3 + F-P1-5's core) — no stale-count window beyond the in-flight game. CLEAN.
- **Robustness edge?** Cancel + per-game catch + per-run cap together bound every failure mode (stall, crash, huge backlog). CLEAN.
- **Symmetry/honesty?** Covered (F-P1-5 / F-P1-6). CLEAN.

**Cycle-3 result: 0 new folds, 0 retractions.** Final FOLD set = **6** (stable across cycles 2→3). Honest note: enrich added genuine value on top of the refiner (fidelity guard F-P1-3 and the shared-core F-P1-5 are the two that most change the build), but it **converged by cycle 2** — cycle 3 was pure confirmation, as expected.

---

## FOLD set (final — folded into the V1 spec)

| ID | Axis | One-line | Where folded |
|---|---|---|---|
| **F-P1-1** | A1 capability | Dashboard badge → **F5 history** (selective analyse); keep one-click "Analyse all" on the Play over-screen | §2.5, §4.5 |
| **F-P1-2** | A2 observability | Auto-run surfaces a quiet "analysed ✓" on success; failure visibility = the backlog count itself | §2.6, §6 |
| **F-P1-3** | A3 fidelity | Displayed count == `unanalyzedPlayedGames(...).length` (same selector) so N never lies | §2.4, §4.4/§4.5, AP-PLAYLOOP-13 |
| **F-P1-4** | A4 robustness | Per-game try/catch in the batch — one failure doesn't kill the run; the game stays in the backlog | §2.3, §4.3, §5, AP-PLAYLOOP-14 |
| **F-P1-5** | A5 reuse (+A7 symmetry) | Extract `analyzeOnePlayedGame(...)` shared by the tail button, the batch loop, and auto-run | §2.2/§2.3, §4 |
| **F-P1-6** | A8 honesty | Copy/spec: the next game is steered **when a weakness is detected**, not unconditionally | §6, §2 (out: overclaim), AP-PLAYLOOP-15 |

**Deferred:** A6 — runner returns per-game results for a future batch-summary view (§11). **Rejected:** none (no finding violated scope/causality).
