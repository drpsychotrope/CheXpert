# play-loop-closure — refiner cycles + arbitrages

**PR**: P1 · **Drafted**: 2026-06-30 · 4 self-adversarial refiner cycles, then recommended defaults APPLIED → V1.
Pre-V0 reports: `play-loop-closure_{target_exists,baseline,collision}.json`. Baseline verified live: 504 tests/69 files, svelte-check 0/0/383, DB_VERSION 4.

---

## Refiner cycle 1 — structural defects (the load-bearing pass)

**D1 (CRITICAL, found via empirical re-check) — `playerColor` cannot be derived from a stored played-game PGN.**
The V0 batch-runner (§4.2) assumed `runAnalysis` could get `playerColor` by `parsePgn(rec.pgn)` + `inferPlayerColor`. **Empirically false for played games:** `finishGame()` writes `pgn: game.pgn()` = bare `this.chess.pgn()` with **no `[White]`/`[Black]` headers** (Play.svelte:432-449; ChessGame.pgn() at :119-120). `inferPlayerColor` needs both a `playerName` and `headers.White/Black` (pgn.ts:94-109) and returns `null` otherwise. Import only works because the **user pastes** a headed PGN + supplies a name (Import.svelte:32,62). The Play tail only works because `playerColor` is in **component scope** (Play.svelte:478) — the very thing P1 loses.
→ **Resolution (folds into V1 §2/§4 + Q-D):** store the played side durably. Two additive options, both no-DB-bump: **(D-a)** add `playerColor?: 'w'|'b'` to `GameRecord`, set in `finishGame()` (`playerColor: playerColor[0]`), read by the runner; **(D-b)** inject `[White]/[Black]` headers into the played PGN at write (so `parsePgn`+`inferPlayerColor` recover it). **Recommend D-a** (smaller, explicit, no PGN re-serialisation, no name-matching heuristic; mirrors the additive-optional pattern). This converts the V0's hand-waved "verify at build" into a decided element and is the single most important correction.

**D2 (significant) — F5 dependency must be a hard pre-flight gate, not a footnote.** P1 imports `getAllGames`/`getAnalyzedGameIds`; they are absent today. If P1 is built before F5 merges it won't compile. → V0 §3 already gates this; **promote to an explicit Acceptance line + AP-PLAYLOOP-5** (done). No change beyond emphasis.

**D3 (significant) — auto-run scope ambiguity could re-create the heavy-engine risk.** "Auto-run on finish" must analyse **only the finished game**, never the backlog; otherwise a user with a 20-game backlog who toggles it on triggers a 20-game engine storm on the next finish. → V0 already says this (Q-C, §2.5, AP-PLAYLOOP-3); **tighten the setting's wording** so it's unambiguous in copy + spec (done in V1 §2.5).

**Verdict cycle 1:** 1 critical (D1) + 2 significant (D2/D3), all resolvable without changing scope/concern. No STOP. The feature premise (broken loop) stands; D1 changes the *mechanism* of one sub-part (color provenance), not the goal.

## Refiner cycle 2 — correctness & boundaries

**D4 — idempotency double-fold.** `runAnalysis` folds motif tags into `weaknessCounters` every call and is NOT internally idempotent (runAnalysis.ts:70-80; guard is caller-side). The batch MUST `getAnalysis(id)`-guard each item or a re-run double-counts weaknesses + duplicates puzzles. → Already AP-PLAYLOOP-7 + §4.2; confirmed sufficient.
**D5 — cache invalidation timing for steering.** Steering reads `loadAllAnalyses()` which is module-cached and invalidated by `runAnalysis` (`invalidateAnalysesCache()`, runAnalysis.ts:64). So after a batch the next `newGame()` re-reads fresh analyses automatically. → No extra work; note it in §6 so the smoke test expects steering to flip on the *next* new game (done).
**D6 — 960 exclusion symmetry.** Selector excludes 960; auto-run must too; the per-game guard is a backstop. → AP-PLAYLOOP-4; confirmed in selector + §2.5.
**D7 — `now`/purity.** Selector is pure (orders by `playedAt`); only the runner reads `Date.now()` for the `now` arg. → AP-PLAYLOOP-8; confirmed.
**Verdict cycle 2:** 0 new criticals; all four are already covered by V0 anti-patterns. Diminishing returns appearing — cycle 2 surfaced no *new* required change, only confirmations. (Honest note: the substance converged at cycle 1; D1 was the only design-mover.)

## Refiner cycle 3 — scope discipline & single-concern

**D8 — is P1 still single-concern after D1 adds a `GameRecord` field?** The field is in service of the *one* concern (close the loop without a manual click): the runner needs the side to analyse from. It is not a second feature. → Single-concern holds. (If a reviewer prefers zero `GameRecord` change, D-b header-injection keeps `GameRecord` untouched at the cost of PGN re-serialisation — documented alternative.)
**D9 — Dashboard badge: does it pull P1 into Dashboard's concern?** The badge is a count + a link; it reuses the `dueReview` placement and F5's history. No Dashboard logic change beyond a read + render. → In-scope (it's the durable re-entry the loop needs). Acceptable.
**D10 — does P1 touch steering?** No. P1 only ensures analyses *exist*. Steering symmetry is P4. → AP-PLAYLOOP-9; boundary held.
**Verdict cycle 3:** 0 criticals. Scope intact. Per the stop rule (cycle 2 had 0 criticals and the polish count is low), cycle 4 is essentially confirmation.

## Refiner cycle 4 — final adversarial sweep (diminishing returns, honest)

**D11 — empty-backlog UX.** When N=0 the Play button and Dashboard badge must hide (not show "Analyse your 0"). → §2.3/§2.4 gate on `n>0`; add to Acceptance (done implicitly via "when N>0").
**D12 — cancel leaves a partial backlog.** Expected and fine: analysed games persist; remaining stay in the backlog for next time (the whole point of making it durable). → §4.2 returns `remaining`; smoke step covers it.
**D13 — a huge backlog.** The per-run cap (`maxPerRun`) bounds engine time; the rest shows as "M remaining — resume". → §2.2 + §11; sufficient.
**Verdict cycle 4:** 0 new required changes. **Explicit diminishing-returns call:** the spec converged at **cycle 1** (D1 was the sole design-mover; cycles 2–4 confirmed coverage and added only UX guards already implied). Cycles 3–4 yielded no criticals — consistent with the skill's "usually converges by cycle 2" honesty note.

---

## Arbitrages — recommended defaults (APPLIED to V1)

| Q | Decision | Default | Rationale (short) |
|---|---|---|---|
| **Q-A** | How the loop closes without a click | **(c)** derive the unanalysed **set** from F5 reads + user-initiated "Analyse all"; **(b) auto-run = opt-in setting** | F5's `getAnalyzedGameIds()` makes a persisted single "last gameId" **redundant + strictly weaker** (covers only the last game, goes stale). Derived read = whole backlog, **zero schema**. Persisted-gameId = rejected alternative. |
| **Q-B** | Where the affordance lives | **(c)** Play game-over entry **+** Dashboard (and/or Home) badge | Play = the moment; Dashboard badge = durable re-entry surviving navigation (precedent `dueReview`). No new `View`. |
| **Q-C** | Guard heavy engine | **(b)** sequential, user-initiated batch, progress + cancel + per-run cap | Single engine worker; parallel contends. Auto-run (Q-A opt-in) only ever analyses the **one** finished game, never the backlog. |
| **Q-D** (new, from D1) | `playerColor` provenance for the runner | **(D-a)** add additive-optional `playerColor?` to `GameRecord`, set in `finishGame()` | Stored PGN has no headers → `inferPlayerColor` returns null. D-a is smallest + explicit, no re-serialisation, no DB bump. D-b (header injection) is the documented alternative. |

**Net pre-V0 corrections (vs the task's stated recommendations):**
1. **"Persist last-unanalysed gameId" → superseded by a derived read** (Q-A): F5's set-read covers the whole backlog with no schema; persisting one id is weaker. The task's auto-run-OPTIONAL recommendation is kept (opt-in setting).
2. **New arbitrage Q-D surfaced empirically:** the batch runner needs `playerColor`, which is **not recoverable** from a stored played-game PGN (no headers) — resolved by an additive `GameRecord.playerColor?`. This was not anticipated in the task's "likely arbitrages" and is the most consequential correction.

All defaults applied → the spec body **is** the V1.
