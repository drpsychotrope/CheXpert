# Spec — trainer-feedback-core (feature **T1**)

**PR name**: `trainer-feedback-core` · **Type**: feature (Trainer feedback loop) · **Spec version**: **V1** (4 refiner cycles applied; FOLD set from `/enrich` ×3 folded)
**Drafted**: 2026-06-30 · **Method**: `/draft-general` (4 cycles) → `/enrich` (3 cycles), defaults applied
**Parent**: `specs/enhancements-architecture-spec.md` §3 Trainer (T1) · **Depends on**: **F4** (`teach-explain-surfacing`), **F3** (`attempt-recording-weakness`)
**Folds**: TR1, TR3, TR6 + accept-alternate-winning-moves · **ADR**: none new (reuse ADR-0037/0040/0010/0033/0052/0053; flag **0058** only if alt-move/clamp ratified architectural — see §0.5 Q-F)
**Empirical artifacts**: `reports/trainer-feedback-core_{target_exists,baseline,collision}.json`

---

## §0 Context

A trainer **miss is a dead end today.** On a wrong move the board is **reset to the start FEN** and the user is told only *"Not the move"* (`tactics.wrong`) / *"missed"* (`review.missed`). The wrong move vanishes, the solution is never shown, and the player learns nothing from the failure. Meanwhile the **metacognition loop is open**: the player can self-tag *why* they missed (`unfamiliar-pattern`, `rushed`, …) and rate their confidence, but **nothing reacts** — the tag is stored and forgotten.

T1 makes a miss a **learning moment** and **closes the metacognition loop**, building on two foundations:

- **F4** ships the reusable **`SolutionReveal.svelte`** (animated playback + a source-agnostic `why?` prop) and the pure **`missWhy(themes, locale)`** helper (theme-derived "why", honest `null` fallback). **T1 consumes both** — it does not re-implement the reveal (F4 AP-TEACH-1).
- **F3** ships attempt recording (incl. the already-present `selfTag`/`confidence` capture) and `weaknessCounters` steering, and **explicitly defers TR3's self-tag→action to T1** (F3 Q-C / §11). **T1 adds the reactions** on top of F3's recording; it does not touch the recording path.

T1 folds four things into one coherent move — *make the failure productive*:

1. **TR1** — show the solution + a theme-derived "why" on a miss (Tactics **and** Review), via F4's `SolutionReveal`.
2. **TR6** — allow **one** second try on the actual board before the fail locks (and leave the wrong move visible), instead of failing instantly + wiping the board.
3. **Accept alternate winning moves** — when the played move deviates from the puzzle line but is **engine-confirmed equally/clearly winning**, treat it as correct instead of a miss.
4. **TR3** — the self-tag closes the loop (Tactics only, where the signal exists): `unfamiliar-pattern` → open the motif's concept card; `rushed` → offer timed mode; **low confidence** (`guess`/`unsure`) on a *solved* puzzle → clamp the FSRS grade to **no better than Good**.

### Pre-V0 empirical scan (verdict: **PROCEED**)
Baseline: **504 tests / 69 files green; svelte-check 383 files, 0/0** (`reports/..._baseline.json`). All fold targets + reuse hooks read and verified (`reports/..._target_exists.json`). **Five premise corrections** (`reports/..._collision.json`), carried into §0.5:
1. **PC-1** — `selfTag`/`confidence` are **already stored AND captured** (chips at `Tactics.svelte:275-281,336-343`; F3 leaves this untouched). The real TR3 gap is the **reaction**, not storage/capture. T1 = *react only*.
2. **PC-2** — `'guess'` is a **`Confidence`** value (`metacog.ts:11`), **not** a `selfTag`. The grade clamp reads `confidence ∈ {guess, unsure}`, not `selfTag`.
3. **PC-3** — **Review has no metacog/selfTag UI.** TR1 + TR6 apply to **both** Tactics and Review; **TR3 reactions are Tactics-only** (that's where the signal exists).
4. **PC-4** — **F4 and F3 are V1-drafted but NOT built.** T1 is downstream (DAG Phase 1, dep F4+F3). Drafting is unblocked (specs are the contracts); **building T1 is gated on F4+F3 merge** (§3).
5. **PC-5** — the engine is **async + serialized + possibly Elo-throttled.** Alt-move eval must pass **`fullStrength:true`** (audit C-1/P0-01) and tolerate latency — it cannot be a synchronous `sameMove` replacement.

---

## §0.5 Arbitrages (recommended defaults — ratify before build)

> Full reasoning in `reports/trainer-feedback-core_arbitrages.md`. Defaults below are what this V1 is written against.

| # | Question | Options | **Recommended default (V1)** | Rationale |
|---|---|---|---|---|
| **Q-A** | Accept-alt-winning: how to judge "equally/clearly winning"? | (a) engine eval within X cp of the puzzle's mainline best · (b) absolute "still winning" threshold · (c) both | **(a)+(b): accept if the deviation is mate, OR within `X cp` (default **50**) of the mainline best AND still ≥ a clearly-winning floor (default **+200 cp** for the solver).** Behind a flag (`acceptAltWinning`, default **ON** for clearly-winning alts). | A relative-only test would accept "less bad" losing moves; an absolute-only test would reject a +0.3 quiet-tactic puzzle. Both gates = honest. Tunable constants in the pure core. |
| **Q-B** | Second-try budget (TR6) | (a) 0 (today) · (b) 1 · (c) configurable | **(b) 1 retry on the actual board before the fail locks; the wrong move stays visible until the retry.** The attempt **still records the miss** (honesty) — the retry is practice, not a re-score. | One forgiving retry turns "instant fail + wiped board" into a real second look without gaming the rating. Honesty: `mistakes ≥ 1` ⇒ the attempt is a miss regardless of the retry outcome. |
| **Q-C** | Which self-tag→actions (TR3)? | the 3 named, or more | **Exactly 3: `unfamiliar-pattern`→open `cardForThemes` card; `rushed`→offer timed mode; confidence `guess`/`unsure` + solved→FSRS grade ≤ Good.** | These three map 1:1 to existing hooks (`cardForThemes`, `app.tacticsTimed`, `resultToGrade`). Others (`miscalculated`, `wrong-plan`, …) have no clean single action → leave for T3/defer. No taxonomy change. |
| **Q-D** | Reveal trigger on a miss | (a) auto-reveal · (b) opt-in "Show solution" toggle | **(b) opt-in toggle (inherits F4 Q-D).** Auto-show would spoil the second try (Q-B) and any Retry. Toggle is non-blocking, Retry-safe, second-try-safe. | F4's `SolutionReveal` is built for opt-in (`autoplay` gates animation). Auto-reveal here would fight TR6. |
| **Q-E** | Grade-clamp placement | (a) inside `gradeCard` · (b) wrap at the call site · (c) new param on `resultToGrade` | **(b) a tiny pure helper `clampForConfidence(grade, confidence)` wrapping the grade before `recordTacticsAttempt`'s `srs.grade`.** Composes with the existing first-exposure clamp inside `gradeCard` (ADR-0033). | Keeps `gradeCard` (state-machine) and `resultToGrade` (time→grade) single-purpose; the confidence policy is a separate, unit-testable pure function. No DB/signature churn on the hot path. |
| **Q-F** | New ADR? | yes / no | **No** by default — reuse ADR-0037 (metacog) / 0010+0033 (FSRS) / 0040 (concept cards) / 0052+0053 (i18n). Allocate **ADR-0058** at build time **only if** the engine-eval alt-move acceptance is judged architecturally decision-worthy (it changes "what counts as solving"). Do not pre-spend; 0054-0057 are reserved (portfolio/F3/F5/F6). | Feature-PR doctrine: no ADR unless architectural. The alt-move semantics are the one candidate; flag, don't assume. |
| **Q-G** | i18n keys for new strings | — | New bilingual keys in `src/i18n/messages/tactics.ts`, FR+EN each: `tactics.secondTry`, `tactics.altAccepted`, `tactics.checkingAlt`, `tactics.reactUnfamiliar`, `tactics.reactRushed`, `tactics.offerTimed`, `tactics.tryTimed`. **Reuse** F4's `reveal.*` for the solution toggle; **reuse** `tactics.learnPattern`/`tactics.openInLibrary` for the card reaction. | One catalogue, per-locale complete templates (AP-TFEED-5 / ADR-0052). No string is built by gluing fragments. |
| **Q-H** | Does accepting an alt move write a provenance flag? | (a) no new field · (b) additive `altAccepted?` on the attempt | **(a) no new field** by default — the attempt records `solved:true` like any solve. Add `altAccepted?:true` (additive, optional) **only if** a later analytics need is ratified. | Doctrine: additive-optional, no churn unless needed. The alt is genuinely a solve; no honesty debt in omitting a flag. (Re-open in T3 if telemetry wants it.) |

---

## §1 Baseline (empirical, `reports/..._baseline.json`)

- **Tests**: 504 pass / 69 files. **svelte-check**: 383 files, **0 errors / 0 warnings**. `DB_VERSION = 4`; latest ADR **0053**.
- **Behaviour today**:
  - Tactics miss (`Tactics.svelte:193-203`): board reset to `puzzle.fen`; `t('tactics.wrong')`; `finish(false)` (grades + `weaknessCounters++`); `selfTag`/`confidence` chips render **iff `metacogEnabled`** but trigger **no action**; `retry()` = full reset, pure practice.
  - Review miss (`Review.svelte:91-98`): board reset; `t('review.missed')`; `grade(false)`; **no metacog UI, no solution**.
  - `TacticalTrainer.playUserMove` (`:48-55`): first non-matching move → `status='failed'` **immediately** (no second try). `sameMove` (`:81-86`) tolerates **only** a promotion suffix.
  - Grade: `resultToGrade(solved,ms)` (`fsrs.ts:28-37`); `gradeCard` first-exposure clamp `Easy→Good` on `State.New` (ADR-0033). **No confidence-based clamp.**
- **Byte-identity anchors** (must not drift): Insights study-plan snapshot (AP-COACH-1 — never reads `selfTag`/`confidence`/`weaknessCounters`); `metacog.ts` `calibration()` output + the closed `SELF_TAGS` taxonomy; `explain.ts` EN+FR pins + EvalGraph; `fsrs.test.ts` `resultToGrade`/`gradeCard` first-exposure clamp.

---

## §2 Scope (single concern)

**One concern: turn a trainer miss into a productive learning moment and close the self-tag loop — by *consuming* F4's reveal and *reacting* to F3's already-captured signals.**

**IN**
1. **TR1** — on a miss in **Tactics** and **Review**, an opt-in "Show solution" toggle mounts F4's `<SolutionReveal>` with the puzzle line + a theme-derived `why={missWhy(puzzle.themes, getLocale())}`. (Q-D)
2. **TR6** — **one** second try on the actual board before the fail locks; the wrong move stays visible until the retry; the attempt still records the miss. (Q-B) Implemented as a small additive change to `TacticalTrainer` (a retry budget) + the two consumers.
3. **Accept alternate winning moves** — a pure decision core + an async engine check (`analyzeLines`, `fullStrength:true`) that upgrades an off-line move to "correct" when it is mate or within `X cp` of the mainline best **and** clearly winning. Behind `acceptAltWinning` (default ON). (Q-A, Q-H)
4. **TR3 reactions (Tactics only)** — react inline to the existing `selfTag`/`confidence` signals (Q-C):
   - `selfTag==='unfamiliar-pattern'` → surface/open the motif's concept card via `cardForThemes` (reuse `openLearn`/`conceptFocusMotif`).
   - `selfTag==='rushed'` → offer **timed mode** (a one-tap "Try this timed" that sets `app.tacticsTimed=true` + reloads).
   - `confidence ∈ {guess, unsure}` **and** solved → clamp the FSRS grade to **≤ Good** via `clampForConfidence` (Q-E).
5. New bilingual strings (Q-G); reuse F4's `reveal.*` and existing `tactics.learnPattern`/`openInLibrary`.
6. Enrichments folded from `/enrich` (`reports/..._improvements.md`): see §11-folded list.

**OUT (explicit non-goals)**
- Re-implementing the reveal, the `why` line, or `SolutionReveal` (→ **F4**; T1 consumes).
- The attempt-recording path, `weaknessCounters` steering, coach-probe recording (→ **F3**).
- `usedHint` + hint-based clamp, progressive hints, move-time/impulsivity signal, streak/daily goal, mode toggle/theme picker/provenance/exhaustion message (→ **T2/T3**).
- Any change to `SELF_TAGS`, `metacog.ts` `calibration()`, the study-plan, `explainPly`, `EvalGraph`, `DB_VERSION`, `schemaRev`.
- Review metacog UI (no self-tag capture in Review → no TR3 there; PC-3).
- A new persisted field (selfTag/confidence already exist; clamp is a computation; alt-accept reuses `solved`).

---

## §3 Pre-flight (gates before Phase A)

- [ ] **Build-order gate (PC-4):** **F4 and F3 are merged** to `main` (`SolutionReveal.svelte` + `missWhy` exist; F3 recording in place). If not, **STOP + escalate** — T1 cannot consume unbuilt foundations. (Drafting is fine now; *building* is gated.)
- [ ] Baseline reproduces: `npx vitest run` = 504 pass; `npx svelte-check` = 0/0.
- [ ] **No new persisted field / no `DB_VERSION` bump (Q-H, PC-1/2):** `selfTag?`/`confidence?` already on `PuzzleAttemptRecord` (`db.ts:47-48`); the clamp is a pure call-site wrap; alt-accept records `solved:true`. Confirm in review that the FOLD set adds none.
- [ ] **Pure cores extracted (no `Date`/`Math.random`/engine in logic):** the alt-move decision (`acceptAltMove`) and the confidence clamp (`clampForConfidence`) are pure; the engine call lives only in the component, behind the pure decision.
- [ ] **F4 contract confirmed:** `SolutionReveal` prop shape (`fen`, `moves`, `orientation`, `why?`, `autoplay`, `stepMs`, `onDone`) and `missWhy(themes, locale)` signature match F4 §4 (read F4 spec as the contract).
- [ ] **Honesty gate:** the alt-move "why" and the TR3 reactions are framed as **hints/offers**, never verdicts; a recorded miss stays a miss even after a successful second try (AP-TFEED-2/3).
- [ ] **AP-COACH-1 guard:** no edit to `studyPlan.ts` or its inputs; re-run `studyPlan.test.ts` determinism test.

---

## §4 Phase A — CODE FIRST

> Order: pure cores → trainer retry budget + alt-accept seam → Tactics wiring → Review wiring → i18n. **Code lands before tests (§5) and docs (§7).**

### A1 — Pure confidence-clamp core `src/srs/fsrs.ts` (additive export)
```ts
/** Clamp a solved-attempt grade to no better than Good when the solver reported low
 *  confidence (guess/unsure). A self-flagged lucky solve must not earn a long interval.
 *  Pure; composes with gradeCard's first-exposure clamp (ADR-0033). No-op on a miss
 *  (Again is already the floor) and on high confidence / undefined. (Q-E, TR3)
 *  Inline confidence union (NOT imported from metacog) to keep `srs/` dependency-free —
 *  mirrors db.ts:47's inline `'sure'|'unsure'|'guess'`. (refiner D7: avoids a new
 *  srs→metacog edge; verified no cycle either way, but srs stays a leaf.) */
export function clampForConfidence(grade: Grade, confidence?: 'sure' | 'unsure' | 'guess'): Grade;
```
- Only downgrades (`Easy`/`Good`… → `Good` when `confidence ∈ {guess, unsure}`); never upgrades; `Again` (a miss) is untouched. The caller (`Tactics.svelte`) already holds `confidence` as `Confidence`, which is assignable to the inline union.

### A2 — Pure alt-move decision core `src/trainer/altMove.ts` (new)
```ts
export interface AltMovePolicy { withinCp: number; winningFloorCp: number; } // defaults 50 / 200
export interface LineEval { uci: string | null; whiteCp: number; mate?: number; } // mirrors EngineClient.LineResult

/** PURE. Given the engine's best-first lines for the position AFTER the user's move was
 *  *considered* (caller supplies evals for the mainline-best and the played move, both
 *  White-POV), decide whether the played move is an acceptable alternate win for `solver`.
 *  Accept iff: played is mate-for-solver, OR (|bestCp - playedCp| <= withinCp AND playedCp
 *  is clearly winning for the solver beyond winningFloorCp). Sign-correct for Black.
 *  No Date/Math.random/engine here — the caller does the async eval and passes numbers. */
export function acceptAltMove(
  solver: 'white' | 'black',
  bestLine: LineEval,
  playedLine: LineEval,
  policy?: AltMovePolicy,
): boolean;
```
- All thresholds in `AltMovePolicy` (tunable, defaulted). Deterministic; fully unit-testable without the worker.

### A3 — `TacticalTrainer` second-try budget + alt-accept seam `src/trainer/TacticalTrainer.ts`
- **Additive `SolveState`**: `retriesLeft: number` (init from a constructor option, default **1** — Q-B) and keep `mistakes`.
- **`playUserMove`** change (TR6): on a non-matching move,
  - increment `mistakes` (honesty — the miss is recorded);
  - if `retriesLeft > 0`: **decrement it, do NOT set `failed`** — return a new `'retry'` result (status stays `'solving'`); the caller leaves the wrong move visible and lets the user move again.
  - else: set `status='failed'`, return `'wrong'` (today's behaviour once retries are spent).
- **Alt-accept seam:** `playUserMove` stays **pure/sync** and still rejects an off-line move; the **async** engine upgrade is done in the component (A4) which, on a would-be miss, calls `acceptAltMove` and — if accepted — drives the trainer forward via a new method `acceptUserMove(uci)` that applies the move + opponent reply exactly like the matched path (no re-grade as a miss). This keeps `TacticalTrainer` engine-free (AP-CHESS-1) and the decision pure.
- `expectedMove()` / `sameMove` unchanged (promotion tolerance stays).

### A4 — Tactics wiring `src/ui/Tactics.svelte`
- **TR6:** in `onMove`, handle the new `'retry'` result → show `t('tactics.secondTry')`, **leave the wrong move on the board** (`lastMove=[from,to]`, do **not** reset to `puzzle.fen`), keep `status='solving'`. On the next move, normal flow resumes; a second non-matching move (retries spent) → today's miss path (reset + `finish(false)` + reveal toggle).
- **Accept-alt-winning (Q-A):** when `playUserMove` returns `'wrong'` **and** `acceptAltWinning` is on, before committing the miss:
  - set a brief `t('tactics.checkingAlt')` state;
  - **best line** = `app.engine.analyzeLines(<fen BEFORE the move>, { multipv: 1, movetime: <budget>, fullStrength: true })[0]` (White-POV `whiteCp`/`mate`);
  - **played line** = eval of the position **AFTER** the played move: clone first — `const after = new ChessGame(fenBefore); if (after.moveUci(uci) == null) → miss;` then `app.engine.evaluate(after.fen, { movetime: <budget>, fullStrength: true })` → its `whiteCp`/`score.mate`. **POV note (refiner D5):** the after-position has the **opponent to move**, but `whiteCp` is always White-POV, so `acceptAltMove(solver, bestLine, playedLine)` compares like-for-like and flips sign for a Black solver internally. Do **not** negate here.
  - `acceptAltMove(solver, bestLine, playedLine)`: if accepted → `t('tactics.altAccepted')`, drive `trainer.acceptUserMove(uci)`, continue as `'correct'/'solved'` (records a **solve**, Q-H). If rejected, or `moveUci` returned null, or the engine errors/times out → fall through to the normal miss path (never hang; honest default = miss). The engine is **serialized** (one search at a time) — these two awaits run back-to-back, not concurrently.
- **TR1 (Q-D):** after a confirmed miss (retries spent, alt rejected), render F4's "Show solution" toggle → `<SolutionReveal fen={puzzle.fen} moves={puzzle.moves} {orientation} why={missWhy(puzzle.themes, getLocale())} autoplay />`. Non-blocking; Retry/second-try-safe.
- **TR3 reactions (Q-C)** — gated on `metacogEnabled`, reacting to the existing chips:
  - In `updateSelfTag(tag)`: if `tag==='unfamiliar-pattern'` and a card resolves (`cardForThemes(puzzle.themes, cards)`) → surface the existing "Learn the pattern" affordance prominently (reuse `openLearn`/`tactics.learnPattern` + `conceptFocusMotif`); if `tag==='rushed'` → show a one-tap "Try this timed" (`t('tactics.tryTimed')`) that sets `app.tacticsTimed=true` and `loadNext()`.
  - **Confidence clamp:** in `finish(true)` (a solve), compute `srs.grade = clampForConfidence(resultToGrade(solved, ms), confidence)` before `recordTacticsAttempt`. (Miss path unaffected — `Again` floor.)
- Everything additive; `clearDrill`, timed flow, leech, concept card untouched except the new reaction affordances.

### A5 — Review wiring `src/ui/Review.svelte`
- **TR6 + TR1 only** (PC-3): handle `'retry'` (leave wrong move, `t('review.secondTry')` — add key) and, after a confirmed miss, render F4's "Show solution" toggle with `missWhy`. Optionally apply accept-alt-winning symmetrically (same async path) — **default ON** for parity, behind the same flag.
- **No TR3** (Review has no `selfTag`/`confidence` capture). No metacog UI added here (that's T2/out).

### A6 — i18n strings (Q-G)
Add to `src/i18n/messages/tactics.ts`, **FR+EN each** (collision-guarded by `translate.test.ts`):
- `tactics.secondTry` — FR "Pas ça — il vous reste un essai sur l'échiquier." / EN "Not that — you have one more try on the board."
- `tactics.altAccepted` — FR "Coup différent, mais tout aussi gagnant. ✔" / EN "Different move, but equally winning. ✔"
- `tactics.checkingAlt` — FR "Vérification du coup…" / EN "Checking your move…"
- `tactics.tryTimed` — FR "Essayer en mode chrono" / EN "Try this timed"
- `tactics.offerTimed` — FR "Pressé ? Entraînez-vous contre la montre." / EN "Rushed? Train against the clock."
- `tactics.reactUnfamiliar` — FR "Motif peu familier — voici la fiche." / EN "Unfamiliar pattern — here's the card."
- `review.secondTry` — FR "Pas ça — encore un essai." / EN "Not that — one more try."
Reuse F4's `reveal.showSolution`/`reveal.hideSolution`; reuse `tactics.learnPattern`, `tactics.openInLibrary`. Register the file is already wired (`messages/index.ts`).

---

## §5 Tests (after code)

**Pure cores (new, no harness needed)**
- `src/srs/fsrs.test.ts` (extend): `clampForConfidence` downgrades `Easy`/`Good`→`Good` for `guess`/`unsure`; no-ops for `sure`/`undefined`; never upgrades; `Again` (miss) untouched. Composes with `gradeCard` first-exposure clamp (a `guess` first solve still resurfaces).
- `src/trainer/altMove.test.ts` (new): accepts a mate alt; accepts a within-`X cp` clearly-winning alt; **rejects** a "less bad" losing move (relative-only trap); **rejects** an equal-but-not-winning quiet move below the floor; sign-correct for Black; thresholds honored.
- `src/trainer/TacticalTrainer.test.ts` (extend): a first wrong move returns `'retry'` and **keeps `status='solving'`** with `mistakes===1`, `retriesLeft===0`; a **second** wrong move returns `'wrong'` + `status='failed'`; `retriesLeft:0` constructor option reproduces today's instant-fail; `acceptUserMove` advances the line + applies the opponent reply like the matched path.

**Regression / byte-identity guards**
- `metacog.test.ts`, `store/metacog-schema.test.ts` green (taxonomy + additive fields untouched).
- `studyPlan.test.ts` determinism green (AP-COACH-1).
- `fsrs.test.ts` existing `resultToGrade`/`gradeCard` first-exposure tests green.
- `explain.test.ts` / EvalGraph untouched (no trainer-path engine `PlyAnalysis`).

**Component / wiring (no harness → static + manual, per portfolio fact)**
- Static wiring-presence: Tactics & Review import/mount `SolutionReveal`; Tactics computes `clampForConfidence` on solve; alt path passes `fullStrength:true`. (grep-level assertions or a thin seam test.)
- Manual (§6) covers the UI behaviours (no `*.svelte.test.ts` harness exists — portfolio fact).

---

## §6 Verification

- [ ] `npx vitest run` → **≥ 504 pass** (new tests add; **0 prior regressions**).
- [ ] `npx svelte-check --tsconfig ./tsconfig.json` → **0 errors / 0 warnings**.
- [ ] `npm run build` green.
- [ ] **i18n parity:** every new key FR+EN; `translate.test.ts` collision guard green.
- [ ] **No `DB_VERSION`/`schemaRev` change; no new persisted field.**
- [ ] **Byte-identity:** Insights study-plan snapshot unchanged (AP-COACH-1); `metacog.calibration()` unchanged; `explainPly`/EvalGraph untouched.
- [ ] **Manual (`npm run dev`), FR and EN:**
  - Tactics miss → one second try on the board (wrong move visible) → second miss → "Show solution" animates the real line + a theme "why"; Retry still works without spoiler.
  - An off-line but clearly-winning move → "Checking…" → accepted as a solve; an off-line losing move → normal miss.
  - `metacogEnabled`: tag `unfamiliar-pattern` → concept card surfaces; tag `rushed` → "Try this timed" sets timed mode; solve a puzzle marked `guess` → next due interval is **not** longer than a Good (clamp visible via Review timing / SRS card).
  - Review miss → second try + "Show solution" (no metacog reactions).
- [ ] **AP-COACH-8 (inherited):** alt-accept and clamp do not touch `puzzleRating` pool logic beyond the existing `gradeAttempt` path (a solve is a solve).

---

## §7 Docs (LAST)

- `decisions.md`: append-only. Default = a **decisions note** referencing ADR-0037 (metacog), ADR-0010/0033 (FSRS clamp lineage), ADR-0040 (concept cards), F4/F3; record Q-A..Q-H. **Allocate ADR-0058 only if** Q-F ratifies the alt-move acceptance as architectural ("what counts as solving"). Do not touch reserved 0054-0057.
- Update `specs/enhancements-architecture-spec.md` Trainer T1 row → shipped (TR1/TR3/TR6 + alt-accept; TR3 Tactics-only) — *doc-only, after code/merge*.
- No README/user-doc churn (additive UI; in-app strings cover it).

---

## §8 Acceptance

1. A trainer miss in **both** Tactics and Review offers an opt-in "Show solution" that animates the real line via **F4's `SolutionReveal`** + a theme-derived, honest `why` (or no why when none resolves), bilingual, Retry- and second-try-safe.
2. The first wrong move grants **one** on-board second try (wrong move left visible) before the fail locks; the attempt **still records the miss** (`mistakes ≥ 1`).
3. An off-line move that is **engine-confirmed** mate or within `X cp` of the mainline best **and** clearly winning is accepted as a **solve** (`fullStrength` eval, async, honest fall-through to miss on reject/error); behind `acceptAltWinning` (default ON).
4. In Tactics with metacog on: `unfamiliar-pattern` surfaces the concept card; `rushed` offers timed mode; a low-confidence (`guess`/`unsure`) **solve** is clamped to **≤ Good** via the pure `clampForConfidence`.
5. `clampForConfidence` and `acceptAltMove` are pure (no `Date`/`Math.random`/engine); `TacticalTrainer` stays engine-free.
6. 504+ tests green; svelte-check 0/0; build green; i18n parity green; Insights/`metacog`/`explainPly`/EvalGraph byte-identical; **no `DB_VERSION` bump**.

---

## §9 Anti-patterns (AP-TFEED-)

- **AP-TFEED-1** — *Re-implementing the reveal or the "why".* T1 **consumes** F4's `SolutionReveal` + `missWhy`; it must not write a second stepper, SAN builder, or theme→idiom table (F4 AP-TEACH-1; build-order gate §3).
- **AP-TFEED-2** — *Erasing the miss after a successful second try / alt-accept.* A retry is practice, not a re-score: `mistakes ≥ 1` ⇒ the attempt is a miss. An accepted alt is a genuine **solve** (engine-confirmed), not a forgiven miss — do not conflate the two.
- **AP-TFEED-3** — *Faking the alt-move verdict.* Acceptance requires a real **`fullStrength`** engine eval (the worker may be Elo-throttled — C-1/P0-01). Never accept on a heuristic, a throttled eval, or a timeout; on any engine error/timeout, **default to a miss** (honest). The clamp and reactions are hints/offers, never asserted verdicts.
- **AP-TFEED-4** — *Auto-spoiling the solution.* Reveal is opt-in on a miss (Q-D); the second try and Retry must remain possible without seeing the answer.
- **AP-TFEED-5** — *Concatenating bilingual fragments.* New strings are complete per-locale templates in `tactics.ts` (ADR-0052/0053); reuse `reveal.*`/`learnPattern`; never glue translated pieces.
- **AP-TFEED-6** — *Engine in the pure core / Trainer.* `acceptAltMove` and `clampForConfidence` are pure; the engine call lives only in the component behind the pure decision; `TacticalTrainer` stays UI- and engine-agnostic (AP-CHESS-1).
- **AP-TFEED-7** — *Reacting where there is no signal.* TR3 reactions attach only to Tactics' existing `selfTag`/`confidence` and only when `metacogEnabled`; do not add metacog UI to Review (that's T2) and do not invent a reaction for tags without a clean single action (Q-C).
- **AP-TFEED-8** — *Study-plan / taxonomy drift.* Never route `selfTag`/`confidence` into `buildStudyPlan`; never alter `SELF_TAGS` or `metacog.calibration()` (AP-COACH-1; closed taxonomy AP-META-2).
- **AP-TFEED-9** — *Schema churn.* No new persisted field, no `DB_VERSION`/`schemaRev` bump — `selfTag?`/`confidence?` exist; the clamp is computed; an alt-accept records `solved:true` (Q-H).

---

## §10 Rollback

- Fully additive; rollback = revert the PR commit. **Per-fold revert is safe and independent:**
  - revert A4/A5 reveal toggle → miss path returns to reset + "wrong" (F4 component stays for Calculate/Coach).
  - revert the alt-accept seam (A2 + the component call) → `sameMove`-only acceptance returns (today).
  - revert the retry budget (A3) → instant fail returns (constructor default `retriesLeft:0` reproduces it without code removal).
  - revert the clamp (A1 + the call-site use) → grades return to `resultToGrade` only.
- No data/migration to unwind (no `DB_VERSION`/field change); legacy attempts read unchanged.

---

## §11 Follow-up (downstream, not T1)

- **T2** (personalization & selection): mode toggle / theme picker / personal-puzzle provenance / exhaustion message; Review metacog surfacing if desired.
- **T3** (integrity & retention): `usedHint` + hint-based clamp (composes with `clampForConfidence`); progressive hints; move-time/impulsivity signal; streak/daily goal; **alt-accept telemetry** (was the alt actually played often? → revisit `altAccepted?` flag, Q-H); **reveal-usage telemetry** (F4 T3 defer).
- **C6** (coach): consumes the *same* `SolutionReveal` with an `explainPly`-derived `why` (F4 FOLD-4) — orthogonal to T1.
- **DEFER**: a configurable second-try budget (Q-B (c)); per-confidence clamp tuning; accepting an alt that is *winning but worse than mainline by > X cp* with a softer "good enough" tier.

---

### `/enrich` FOLD set (folded above; full log in `reports/trainer-feedback-core_improvements.md`)
1. **FOLD-1 (robustness/honesty)** — engine timeout/error on the alt-check ⇒ **default to miss**, never hang (§4 A4, AP-TFEED-3).
2. **FOLD-2 (render fidelity)** — leave the **wrong move visible** during the second try (not just "allow retry"), so the player sees what they played (§4 A4 / Q-B).
3. **FOLD-3 (symmetry)** — apply TR1 + TR6 to **Review** too, not only Tactics (§4 A5; TR3 stays Tactics-only for lack of signal).
4. **FOLD-4 (honest framing)** — "Different move, but equally winning" / hint-not-verdict wording for the alt-accept and TR3 offers (§4 A6, AP-TFEED-3).
5. **FOLD-5 (reuse)** — the `rushed`→timed reaction reuses the **existing** `app.tacticsTimed` mechanism (no new timed engine); `unfamiliar`→card reuses `cardForThemes`/`openLearn` (§4 A4, AP-TFEED-1/6).
6. **FOLD-6 (correctness)** — alt-eval must pass **`fullStrength:true`** (worker throttle, C-1/P0-01) (§4 A4, AP-TFEED-3).
