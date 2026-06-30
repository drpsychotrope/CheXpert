# Spec — Coach designed-position probes (Feature C3)

**Type**: feature (additive-optional) · **PR**: `coach-designed-probes` · **ADR**: none expected (additive; if forced, ≥0059)
**Spec version**: V1 · **Drafted**: 2026-06-30 · **Method**: `/draft-general` (4 cycles) → `/enrich` (3 cycles, 8-axis)
**Parent**: `specs/enhancements-architecture-spec.md` §3 (Coach) · **Folds**: CO12
**Hard dep**: F6 `game-session-controller` (`createGameSession({startFen})`) — with a documented Play-direct fallback (§0.5 Q-E).

> **Doctrine**: additive-optional, **no `DB_VERSION` bump** (the probe outcome rides the existing `coachProfile.dimensions`).
> **Honesty** — directional, no grade; a designed probe is n≈1 and is labelled as such (AP-CHESS-13/24). **No diagnostic→pool
> leak** — a probe never folds into the bot's adaptive Elo / `puzzleRating` (AP-COACH-8). Pure cores: no `Date`/`Math.random`
> in logic modules. **Bilingual FR/EN parity** (ADR-0053). **Insights byte-identical** (the probe path never touches
> `buildStudyPlan` inputs — AP-COACH-1). **Single concern**: designed positions that probe conversion + resilience.
> **Code before docs.**

---

## §0 Context

The Coach's assessment ends with **one optional even engine game** (`Coach.svelte:130 startGame` → `new ChessGame()`
from the start position vs `AdaptiveOpponent` at the player's puzzle-rating Elo, capped at `GAME_MOVE_LIMIT = 48` plies,
Coach.svelte:43). That game feeds `runAnalysis(source:'played')` → `buildWeaknessProfile([analysis]).dimensions` →
`commit(gameDimensions)` → `buildCoachProfile({gameDimensions})` (Coach.svelte:159-195, `diagnostic.ts:45`).

**The problem (CO7 + CO12).** A single even short game structurally **cannot fairly measure two of the five radar axes**:

- `endgameConversion` is scored from `phaseAcpl(endgame)` and needs `MIN_PHASE_PLIES = 4` (`weakness.ts:185,226`).
  A short even game often never reaches a 4-ply endgame → the axis collapses to **"not measured"** (`sampleSize 0`,
  neutral 50 — `dimensionScore(..., measured:false, ...)`).
- `resilience` is scored from `resilienceScore` and needs `MIN_BEHIND_EPISODES = 3` (`weakness.ts:186,237`). An even
  game where the player is never clearly behind 3× → the axis collapses to **"not measured"** likewise.

You can't measure **conversion** without a *won* position to convert, nor **resilience** without a *worse* position to
hold. C3 hands the user **designed positions** that start *inside* those conditions: a rook-up endgame (guaranteed
endgame plies → conversion) and a clearly-worse-but-holdable position (engineered behind-episode → resilience). The
outcome of each designed probe feeds the **matching** `DimensionScore`, with an honest small sample-size.

**Reused substrate** (all verified at HEAD 9296aff — see `reports/coach-designed-probes_target_exists.json`):
- `IMBALANCE_LIBRARY` (`src/analysis/scenarios.ts`) — has `rook-up` (`8/5pk1/6p1/8/8/1R3PKP/r5P1/8 w - - 0 1`), an exact
  conversion seed. It has **no** passive/worse position (`opp-castle` is an *attack* race) → one coach seed is added.
- `buildWeaknessProfile` + `resilienceScore` + `phaseAcpl` (`src/analysis/weakness.ts`) — the scoring engine, reused
  **unchanged**; a designed game is still a `GameAnalysis`.
- `buildCoachProfile({gameDimensions})` (`src/coach/diagnostic.ts:45,77-81`) — the merge point: game `DimensionScore[]`
  override radar cells. C3 feeds the targeted cell(s) here.
- F6 `createGameSession({startFen, playerSide, engine, opponent, config})` — DOM-free controller; `applyPlayerMove` and
  `engineReply` are separate (no auto-chain); `checkTerminal()` is a pure idempotent query returning
  `{over,reason,winner,outcome}` (never a localized string). `startFen` is the explicit C3 enabler (F6 spec §2/§5.7/§11).
- `AdaptiveOpponent.{pickMove,pickHumanMove,applyStrength}` — the bot; **`finishGame`/`recordGame` are NOT called** for a
  probe (AP-COACH-8; the even game already never calls them).

**ADR**: none expected — C3 is additive and reuses existing contracts (the F6 controller, the `buildCoachProfile` merge,
the `buildWeaknessProfile` scoring). `decisions.md` ceiling is ADR-0053; 0054–0058 are reserved by unbuilt specs
(portfolio/F3/F5/F6/P2). If an ADR proves unavoidable it must be **≥0059** (flag at PR time).

---

## §0.5 Arbitrages (resolved → applied to V1)

Full reasoning: `reports/coach-designed-probes_arbitrages.md`. Enrichment FOLD set: `reports/coach-designed-probes_improvements.md`.

| Q | Question | **Default (applied)** |
|---|---|---|
| **Q-A** | Which dimensions get probes in V1? | **conversion + resilience** — the two axes the even game under-measures (others are C2/out of scope). |
| **Q-B** | Scenario source | **reuse `rook-up`** for conversion **+ add ONE coach seed** `coach:defend-worse` for resilience (library has no worse/passive position; `opp-castle` is an attack). `scenarioForFocus` (program.ts:19) is routing-only and is **not** reused for selection (its `resilien→opp-castle` mapping is semantically wrong here). |
| **Q-C** | How the result feeds the profile | **probe outcome → the matching `DimensionScore`** (via the existing `buildCoachProfile({gameDimensions})` merge) with an **honest small `sampleSize`** and a `detail` naming the designed position. **Single-dimension extraction**: a probe emits ONLY its targeted dim. |
| **Q-D** | Opt-in & placement | **optional, offered at the existing `offer-game` step** (Coach.svelte:222), after the motif ladders. The even game is **retained** (still feeds tactics/opening); designed probes are additive top-ups for the two weak axes. |
| **Q-E** | Build against F6 or Play-direct? | **spec against the F6 `createGameSession({startFen})` contract**, with an explicit **Play-direct fallback** (seed `new ChessGame(fen)` + the existing Coach `botReply` loop) so C3 is buildable whether or not F6 has landed. |

**Provenance (FOLD E2)**: `CoachProfile.source` gains an additive `probes?: boolean`; each probe cell's `detail` names the
designed position so the radar reading is not a black box.

---

## §1 Baseline (measured — `reports/coach-designed-probes_baseline.json`)

- **Tests**: 504 passed / 69 files; svelte-check 0 errors / 0 warnings across 383 files; `npm run build` green
  (HEAD 9296aff, per `trainer-feedback-core_baseline.json` same HEAD). C3 must not regress.
- **DB_VERSION = 4**; `PlayerModel.schemaRev = 1`. C3 adds **no** store and **no** version bump.
- **Coach today**: one optional even game; `endgameConversion`/`resilience` are the **weakest-measured axes** (frequently
  `sampleSize 0`, neutral 50). `opponent.finishGame`/`recordGame` **never called** by Coach (rating pool untouched).
- **Scoring engine present & reused unchanged**: `buildWeaknessProfile`, `resilienceScore`, `phaseAcpl(endgame)`,
  thresholds `MIN_PHASE_PLIES=4` / `MIN_BEHIND_EPISODES=3`.
- **i18n**: pure-core via `gt(key, locale, params)` in `src/i18n/messages/generators.ts` (`dim.endgameConversion`,
  `dim.resilience` already exist; `scenario.*`/`program.*` live here); component via `t()` in `src/i18n/messages/coach.ts`.
- **No collision** (`reports/coach-designed-probes_collision.json`): no spec target, no `designedProbe` symbol, no
  `AP-CDESIGN` namespace, no key clash.

---

## §2 Scope (single concern)

**IN**
- A small **pure probe registry** `COACH_PROBES` (dimension → seed → targetDimension): V1 = `endgameConversion`→`rook-up`,
  `resilience`→`coach:defend-worse` (FOLD E4). One **new coach seed** `coach:defend-worse` added to `scenarios.ts`
  (clearly-worse-but-holdable, player to move; FEN validated in tests).
- A **side-appropriate** seed: respect the player's color (existing ColorPicker/`coachSide`); mirror the FEN for the other
  side (pure helper, tested — FOLD E5).
- Run each chosen probe by **seeding the game with the probe FEN** and playing it out vs the bot, then analyse it through
  the **existing** pipeline (`runAnalysis(source:'played')` → `buildWeaknessProfile([analysis]).dimensions`) and extract
  the **one targeted** `DimensionScore` (Q-C, single-dimension extraction).
- **Merge** the probe `DimensionScore`(s) into the profile via the existing `buildCoachProfile({gameDimensions})` path;
  set `source.probes = true`; the cell `detail` names the designed position (FOLD E2).
- **Opt-in UI** at the existing `offer-game` step: the user can run a probe, run the even game, or skip (Q-D).
- **Graceful skip** on engine failure / non-conversion: the axis stays "not measured"; per-probe ply cap (FOLD E3).
- Bilingual FR/EN for every new string; parity tests.

**OUT**
- Probes for opening/time/tactics axes (those are measured by ladders/game today; timed probe is **C2**).
- Any **radar visual** redesign / evidence-type badge (**C6** — DEFER E6). C3 only supplies honest `detail`+`sampleSize`+
  `source.probes`.
- Any rating-pool / `AdaptiveOpponent.finishGame` fold (AP-COACH-8). The probe never adjusts the bot's Elo.
- A pass/fail "success verdict" per probe (REJECT E1 — violates the no-grade honesty doctrine). The directional
  `DimensionScore` IS the outcome.
- `DB_VERSION` / schema change; new store; new ADR (unless forced ≥0059).
- F2 (`onMoveText`/a11y), F1 (i18n routing infra), F5 (game persistence/reads) — out of this PR.
- Removing or changing the even game's existing behaviour (it stays as-is; probes are additive).

---

## §3 Pre-flight

1. `npm test` green at HEAD (capture exact count; baseline anchor 504).
2. `svelte-check` → 0 errors at HEAD.
3. `npm run build` green at HEAD.
4. Confirm reuse hooks (done in scan): `IMBALANCE_LIBRARY.rook-up`, `buildWeaknessProfile`/`resilienceScore`/
   `phaseAcpl`, `buildCoachProfile({gameDimensions})`, `runAnalysis(source:'played')`,
   `AdaptiveOpponent.{pickMove,pickHumanMove,applyStrength}`, and the F6 `createGameSession({startFen})` contract.
5. Decide F6-vs-fallback at build time (Q-E): if F6 is built, consume `createGameSession({startFen})`; else use the
   Play-direct fallback loop (§4 A2). Either path produces the same `game.pgn()` for analysis.
6. Re-confirm no new ADR needed (additive); if one is unavoidable, reserve **≥0059** and flag.
7. Branch off `main`.

---

## §4 Phase A — CODE FIRST

**A1 — Probe registry + seeds (pure)** (`src/analysis/scenarios.ts` or a sibling `src/coach/probes.ts`, pure):
- Add ONE coach seed to `scenarios.ts`: `id:'coach:defend-worse'`, `category:'imbalance'` (coach-designed), a
  clearly-worse-but-holdable position with the **player to move** (e.g. down a pawn with a passive but defensible
  setup — exact FEN chosen and **validated in tests**, mirroring the existing `scenarios.test.ts` FEN-legality checks).
  Bilingual `name`/`nameFr` + `goal`/`goalFr` (e.g. "Hold the worse side: trade into a fortress, don't panic.").
- Define a **pure** registry:
  ```
  COACH_PROBES: Array<{
    dimension: 'endgameConversion' | 'resilience';
    seed: Scenario;                 // rook-up (from IMBALANCE_LIBRARY) | coach:defend-worse
    targetDimension: Dimension;     // === dimension (the ONE cell this probe is allowed to emit)
  }>
  ```
  V1 holds exactly the two Q-A entries; a third probe later is **data**, not code (FOLD E4).
- **Side symmetry (FOLD E5)**: a pure `mirrorFen(fen)` helper (rank-flip + color/castling/ep swap) so a probe can be
  played from the player's side; `seedForSide(probe, side)` returns the seed FEN with `sideToTrain === side`. No
  `Date`/`Math.random`. Tested for round-trip + legality.

**A2 — Run a probe** (component-side orchestration in `Coach.svelte`, reusing the even-game machinery):
- **Preferred (F6 built)**: `createGameSession({ startFen: seedForSide(probe, coachSide), playerSide: coachSide,
  engine, opponent, config })`. The component orchestrates `applyPlayerMove` → `engineReply` per the F6 contract (no
  auto-chain), capped at a **per-probe ply limit** (reuse a `GAME_MOVE_LIMIT`-style bound so a non-converting rook-up
  can't run forever — FOLD E3). `opponent.finishGame` is **not** called (AP-COACH-8).
- **Fallback (F6 not yet built — Q-E)**: replicate the existing Coach even-game loop with a seeded start:
  `game = new ChessGame(seedForSide(probe, coachSide))`, then the current `onGameMove`/`botReply` pair (Coach.svelte:117-157)
  unchanged except the start FEN and the ply cap. This is literally today's loop with a designed start — no new engine code.
- On engine failure (mirror Coach.svelte:173 `catch` / `finishWithoutGame`): abort the probe, leave its axis untouched
  ("not measured"); surface a non-false status. **Never** emit a fabricated cell (FOLD E3, AP-CDESIGN-3).

**A3 — Score + single-dimension extraction** (reuse the existing analysis path):
- After the probe game ends (terminal or ply cap), `runAnalysis(app.engine, app.puzzles, { gameId:`probe-${...}`,
  pgn: game.pgn(), playerColor: coachSide, source:'played', baseRating: baseline(), now })` →
  `buildWeaknessProfile([analysis], baseline(), getLocale()).dimensions`.
- **Extract ONLY `probe.targetDimension`** from those dimensions (Q-C). Build the probe `DimensionScore`:
  `{ dimension: targetDimension, score: <from buildWeaknessProfile>, detail: gt('probe.<dim>Detail', locale, {...}),
  sampleSize: <honest small n — the measured n from buildWeaknessProfile for that dim, NOT inflated> }`. If that dim came
  back `sampleSize 0` (the designed position still didn't generate enough evidence — e.g. instant resignation), keep it
  "not measured" rather than fabricating a score (AP-CDESIGN-3).
- The `detail` **names the designed position** (FOLD E2): e.g. `gt('probe.conversionDetail', locale)` → "from a designed
  rook-up endgame" / "depuis une finale de tours conçue".

**A4 — Merge into the profile** (reuse the existing merge; additive provenance):
- Accumulate probe `DimensionScore[]` and pass them into the existing `commit`/`buildCoachProfile` path so they
  **override** the matching radar cells (the same `gameDimensions.map` mechanism, `diagnostic.ts:77-81`). When the even
  game also ran, the probe cell for `endgameConversion`/`resilience` takes precedence over the (likely "not measured")
  game cell; all non-probed cells are untouched (single-dimension extraction guarantees no cross-dim pollution).
- Set `source.probes = true` (additive field on `CoachProfile.source`; `diagnostic.ts` + `types.ts`). `buildCoachProfile`
  reads probe cells through the **same** `sampleSize > 0` gate (diagnostic.ts:91) so strengths/weaknesses stay honest.

**A5 — Opt-in UI** (`Coach.svelte`, the `offer-game` step, Q-D):
- At `step === 'offer-game'` (Coach.svelte:222), add probe choices alongside the existing "Play the game"/"Skip": e.g.
  "Test endgame conversion (rook-up)" and "Test resilience (defend a worse position)". Selecting one runs A2→A4 then
  returns to the offer (so the user can run the other, run the even game, or finish → `commit`). The even game and Skip
  remain. Bilingual labels via `t('coach.probe*')`.

**No `DB_VERSION`/schema change. No rating-pool fold. No change to `weakness.ts` scoring or `buildStudyPlan`.**

---

## §5 Tests

Pure-core unit tests (no component-test harness exists — verify via pure cores + static wiring + manual; portfolio §8):

New `src/analysis/scenarios.test.ts` additions (or `src/coach/probes.test.ts`):
1. **Seed legality**: `coach:defend-worse` FEN parses, is legal, has the **player to move**, and is a *clearly-worse-but-
   holdable* eval band (assert side-to-move is the worse side; sanity-bound material/eval per the test's engine-free check
   mirroring existing scenario FEN tests).
2. **`rook-up` reuse**: registry's conversion seed === `IMBALANCE_LIBRARY` `rook-up` (no duplicate/divergent FEN).
3. **`mirrorFen` round-trip** (FOLD E5): `mirrorFen(mirrorFen(fen)) === fen`; mirrored FEN is legal; side-to-move flips;
   castling/ep mirror correctly.
4. **`seedForSide`**: returns a seed with `sideToTrain === side` for both colors; FEN legal both ways.
5. **Registry shape** (FOLD E4): every entry's `targetDimension === dimension` and ∈ {endgameConversion, resilience};
   exactly the two V1 entries.

New `src/coach/probes.test.ts` (single-dimension extraction — PURE, fed a fixture `GameAnalysis`):
6. **Single-dimension extraction** (Q-C): given a `buildWeaknessProfile` output, the conversion probe yields a
   `DimensionScore` for **only** `endgameConversion` (asserts the other four are not emitted by the probe); resilience
   probe yields only `resilience`.
7. **Honest sampleSize**: the probe cell's `sampleSize` equals the measured n from `buildWeaknessProfile` for that dim
   (not inflated, not hard-coded to a large number).
8. **Graceful "not measured"** (FOLD E3): if the targeted dim came back `sampleSize 0`, the probe yields a "not measured"
   cell (score 50, sampleSize 0) — **never** a fabricated score.
9. **Provenance** (FOLD E2): merging a probe cell sets `source.probes = true` and the cell `detail` is the designed-
   position string (locale-correct FR and EN).
10. **AP-COACH-8 (no pool leak)**: the probe scoring path does **not** call `AdaptiveOpponent.finishGame`/`recordGame`
    and does **not** mutate `puzzleRating` (assert via the pure path: probe outcome is a `DimensionScore` only).

Bilingual parity: every new `gt`/`t` key has FR + EN (extend the existing i18n parity test).

Regression: `program.test.ts`, `scenarios.test.ts`, `weakness.test.ts` (resilience/endgame thresholds), `studyPlan.test.ts`
(AP-COACH-1) stay green. `weakness.ts` scoring is unchanged.

---

## §6 Verification

- `npm test` — all green; new probe tests passing; **no drop** vs §1 baseline (504).
- `svelte-check` — 0 errors (Coach rewired, types intact; `source.probes?` additive).
- `npm run build` — green.
- **AP-COACH-1 (Insights byte-identity)**: confirm the Insights study-plan snapshot is unchanged — the probe path feeds
  `coachProfile.dimensions` only; `buildStudyPlan` reads fingerprint leaks + weakest dim, not the probe path. Run the
  existing snapshot/determinism test.
- **AP-COACH-8 (no pool leak)**: confirm `puzzleRating` and the bot's `OpponentState.targetElo` are unchanged after a probe
  (the probe never calls `finishGame`/`recordGame`).
- **Manual smoke** (Coach): start assessment → ladders → at offer-game, run the rook-up conversion probe → radar's
  `endgameConversion` shows a real score with "from a designed rook-up endgame" detail and a small sampleSize; run the
  resilience probe → `resilience` populated similarly; skip a probe → that axis stays "not measured"; force an engine
  error mid-probe → graceful skip, no crash, no false cell; run as Black → seed is color-appropriate (mirrored).
- **Honesty check**: the populated cells read as directional with a visible small sample size — not as a confident grade.

---

## §7 Docs (LAST)

- **No new ADR expected** (additive; reuses F6 + `buildCoachProfile` + `buildWeaknessProfile`). If one proves unavoidable,
  append **≥0059** to `decisions.md` (0054–0058 reserved) and cross-link CO12, F6 (`startFen` enabler), AP-COACH-8, the
  `buildCoachProfile` merge, ADR-0045 (coach mode), AP-CHESS-13/24 (honesty).
- Update the architecture-spec C3 row (§3 Coach): status → drafted/landed (conversion+resilience designed probes;
  reused `rook-up` + one coach seed; outcome → matching DimensionScore with honest sampleSize + provenance).
- No README/user-facing docs (internal coach enhancement); i18n strings are the only user-facing surface and are bilingual.

---

## §8 Acceptance

1. A pure `COACH_PROBES` registry exists with exactly the two V1 entries (conversion→`rook-up`, resilience→
   `coach:defend-worse`); every entry's `targetDimension === dimension`. One new coach seed `coach:defend-worse` is in
   `scenarios.ts` with a legal, player-to-move, clearly-worse FEN (tested).
2. A probe seeds the game with its FEN (via F6 `createGameSession({startFen})` or the Play-direct fallback) and plays it
   out vs the bot, capped at a per-probe ply limit; `AdaptiveOpponent.finishGame`/`recordGame` is **not** called.
3. The probe outcome is the targeted `DimensionScore` only (single-dimension extraction), with an **honest** `sampleSize`
   and a `detail` naming the designed position; a still-thin probe stays "not measured" (no fabricated score).
4. The outcome merges via the existing `buildCoachProfile({gameDimensions})` path, overriding the matching radar cell;
   `source.probes = true`; non-probed cells untouched.
5. Probes are **opt-in** at the offer-game step; the even game and Skip remain; the user can run either/both/neither.
6. Side symmetry: the seed is color-appropriate (mirrored for the player's side); `mirrorFen` round-trips (tested).
7. Bilingual FR/EN for every new string; parity test green.
8. `npm test` green (≥504, no regression); `svelte-check` 0 errors; `npm run build` green. Insights byte-identical
   (AP-COACH-1); rating pool untouched (AP-COACH-8). No `DB_VERSION`/schema change; no new store; no new ADR (or ≥0059 if
   forced).

---

## §9 Anti-patterns (AP-CDESIGN-*)

- **AP-CDESIGN-1** — **Diagnostic→pool leak.** A probe folds into the bot's adaptive Elo (`recordGame`/`finishGame`) or
  `puzzleRating`. Forbidden (AP-COACH-8): a probe is learning evidence for one radar cell, not a rated result. The even
  game already never folds; the probe must not either.
- **AP-CDESIGN-2** — **Cross-dimension pollution.** A probe emits more than its `targetDimension` (e.g. a rook-up game
  also writes a `resilience` reading from a position never designed to test it). Always **single-dimension extraction**:
  take only the targeted cell from `buildWeaknessProfile`.
- **AP-CDESIGN-3** — **Fabricated cell.** Emitting a confident score from a probe that produced thin/no evidence (instant
  resignation, engine failure, sub-threshold n). A still-thin probe stays "not measured" (score 50, sampleSize 0); a
  failed probe leaves the axis untouched. Honesty over coverage.
- **AP-CDESIGN-4** — **Inflated sample size.** Hard-coding a large `sampleSize` to make the radar look authoritative. The
  probe cell carries the **measured** n from `buildWeaknessProfile` (small — one designed position) and is labelled as such.
- **AP-CDESIGN-5** — **Pass/fail verdict.** Adding a binary "converted/held" grade per probe (REJECT E1). Violates the
  directional, no-grade doctrine (AP-CHESS-13/24). The `DimensionScore` is the outcome.
- **AP-CDESIGN-6** — **Reusing `scenarioForFocus` for probe selection.** `program.ts:19` is routing-only and maps
  `resilien→opp-castle` (an *attack* race) — semantically wrong for a resilience probe. Use the dedicated `COACH_PROBES`
  registry instead.
- **AP-CDESIGN-7** — **Scope creep.** Adding opening/time/tactics probes (C2), a radar evidence-badge / visual redesign
  (C6), persistence reads (F5), or a11y/i18n infra (F2/F1). C3 = conversion+resilience designed probes only.
- **AP-CDESIGN-8** — **Impurity in the cores.** `Date`/`Math.random` in the registry / `mirrorFen` / extraction helpers.
  Keep them pure (mirrors `program.ts`/`diagnostic.ts`/`scenarios.ts`); the component owns the engine/`Date` side.
- **AP-CDESIGN-9** — **Removing or mutating the even game.** The even game stays; probes are additive. Do not silently
  replace it (Q-D).
- **AP-CDESIGN-10** — **Touching `weakness.ts` scoring or `buildStudyPlan`.** C3 reuses `buildWeaknessProfile` unchanged
  and never feeds the study-plan path (AP-COACH-1). Changing thresholds/scoring here is out of scope.

---

## §10 Rollback

Additive and isolated. To revert: drop `COACH_PROBES` + the `coach:defend-worse` seed + `mirrorFen`/`seedForSide` + their
tests, the probe extraction helper + tests, the `source.probes?` field, and the offer-game probe buttons + their i18n keys.
No schema/migration was introduced (the outcome rode the existing `coachProfile.dimensions`; `source.probes?` is an
additive optional field old records simply lack). The even game, the ladders, `weakness.ts`, `buildCoachProfile`'s
existing behaviour, Insights, and the rating pool are untouched either way. If an ADR was appended, annotate it reverted
(append-only).

---

## §11 Follow-up

- **C6 (Output & teaching)** — render the radar so each axis shows its **evidence type** (designed-probe vs game vs ladder
  vs not-measured), consuming the `source.probes` flag + `detail` C3 supplies (DEFER E6).
- **C2 (Probe engine v2)** — a **timed** designed probe (time-management axis) and à-la-carte probe scope; C3's registry is
  the natural extension point (add an entry).
- More designed seeds (opening-structure conversion, specific endgame types) — pure data added to `COACH_PROBES`.
- If/when a second caller needs it, fold the probe orchestration into the F6 controller as a reusable "scenario session"
  helper (YAGNI until then — kept in Coach now).
- Persist per-probe history (trend across re-assessments) — depends on C1 (profile persistence/trend) + F5.
