# Spec — Trainer personalization & selection (feature **T2**)

**PR name**: `trainer-personalization` · **Type**: feature (trainer selection + provenance UI) · **Spec version**: **V1**
**Drafted**: 2026-06-30 · **Method**: `/draft-general` (4 cycles) → `/enrich` (3 cycles, **4 FOLD applied** — `reports/trainer-personalization_improvements.md`), recommended defaults applied
**Parent**: `specs/enhancements-architecture-spec.md` §3 (T2) · **Folds**: TR4, TR9, TR10
**Depends on (contract)**: `specs/attempt-recording-weakness-spec.md` (**F3**) — the pure `weaknessSelect` core + the `WeaknessSteer` seam + the live `weaknessCounters` read inserted in `loadNext`. F3 explicitly left **dashboard display + richer selection to T2**. **Build F3 first** (architecture DAG Phase 0 → Phase 2: `T2 ◄ F3`).
**Consumes (display)**: F1 label routing (`motifLabelOrRaw`, `src/i18n/gen.ts:18`) for theme display; `t`/bilingual catalogue for all new strings.
**ADR**: **none** (feature PR; no architectural change — additive-optional, no `DB_VERSION` bump). Reserved 0054-0057 untouched; if a reviewer judges the persisted source-preference architectural, flag **≥0058**.
**Empirical artifacts**: `reports/trainer-personalization_{target_exists,baseline,collision}.json`

---

## §0 Context

The trainer's single most differentiating capability — **"puzzles from your own games"** — is shipped
but **mute**. `src/analysis/generatePuzzles.ts` (the "from your games" generator, the spec's "most
differentiating feature") already stores rich provenance on every personal puzzle:

```ts
// generatePuzzles.ts:100-107
meta: {
  sourceGameId, moveNumber, playedMove /* = p.san */, severity,
  motifConfidence, kind /* 'mistake' | 'missed-win' */,
}
// solution = moves[0] = top[0].uci  (the engine's best — "the win you left")
```

Yet the trainer surfaces **none of it**. `src/ui/Tactics.svelte:400` shows one generic tag:
`{#if puzzle.source === 'personal'}{t('tactics.fromYourGameTag')}{/if}` → " · ★ from your game".
A grep over `src/ui` confirms `puzzle.meta` is consumed **nowhere** (only `PlyAnalysis.severity/san`
appear, in `AnalysisResult`/`EvalGraph` — a different object). The player is never told *which* game,
*which* move they played, *why* it was wrong, or — after solving — *what they actually missed*.

Three verified gaps (pre-V0 scan, head `9296aff`):

- **TR4 — provenance is thrown away.** All six `meta` fields + the solution move exist; the UI shows a
  generic star. There is no "Move 23 of your game — you played Qxf7?? (blunder); find what you missed,"
  and no after-solve "the win you left."
- **TR9 — the selection mode is a passive label, not a control.** `mode` is
  `$state<'mixed'|'personal'|'themed'>` set as a *side-effect* inside `loadNext`'s fallback cascade
  (lines 133-141) and shown read-only (`tactics.fromYourGames`, line 327-328). The player cannot choose
  curated / personal / mixed, nor pick a theme/difficulty in-trainer. `PuzzleQuery.source`
  (`PuzzleRepo.ts:18`) **already** supports `'curated' | 'personal' | undefined(=mixed)` — the 3-way is
  expressible today; only the UI is missing.
- **TR10 — theme exhaustion is silent.** A dashboard "Drill forks" filter runs `loadNext` with
  `themes:['fork'], window:400`; when that theme is exhausted *in the rating zone*, `loadNext` **falls
  through silently** to personal/curated and flips `mode` `'themed'→'personal'/'mixed'`. The player
  thinks they're still drilling forks. `tactics.noMore` only fires when **all** sources are empty.

**This PR makes the trainer self-targeting and gives the standout "from your games" feature a voice**:
a full provenance line (pre + post), an explicit 3-way source toggle with an in-trainer theme +
coarse-difficulty picker, and an honest exhaustion message that offers *widen* or *switch* instead of a
silent mode flip.

---

## §0.5 Arbitrages (recommended defaults — applied to this V1)

| # | Question | Options | **Default applied (V1)** | Rationale |
|---|---|---|---|---|
| **Q-A** | Provenance display depth | (a) one-line tag · (b) **full: pre = your move + severity, post-solve = the missed win** | **(b) full** | The differentiating feature deserves the full story. **Pre** (while solving): "Move 23 of your game — you played **Qxf7??** (blunder). Find what you missed." **Post** (after solving): "The win you left: **Nxe5**." Every field already exists (`meta` + `moves[0]`); the cost is markup + 4 bilingual keys, not new data. A one-liner re-buries the feature. |
| **Q-B** | Mode toggle shape | (a) 2-way · (b) **3-way: Mixed / From my games / Curated**, persisted via `source` | **(b) 3-way** | Maps 1:1 onto the existing `PuzzleQuery.source` union (`undefined`/`'personal'`/`'curated'`). Persist the choice as an **optional** `SettingsRecord.trainerSource?` (read `?? 'mixed'`) so it survives reload — no `DB_VERSION` bump. "Mixed" stays the default (today's behaviour). |
| **Q-C** | Theme/difficulty picker scope | (a) theme only · (b) **theme + a coarse difficulty band, reusing `window`** | **(b) theme + coarse band** | Theme picker writes the existing `tacticsFilterThemes` (no new routing). Difficulty = **3 coarse bands** (Easier / On level / Harder) implemented purely as a **rating offset + `window`** on the existing `next()` query — no new puzzle metadata, no schema. Keep it coarse (AP-TPERS-7): not a slider. |
| **Q-D** | Exhaustion behaviour | (a) message + auto-widen · (b) message + auto-switch · (c) **explicit message, then offer *widen* or *switch*** | **(c) explicit, user-chosen** | A silent auto-anything is the bug (TR10). Show "No more **fork** puzzles in your range." with two buttons: **Widen range** (re-query the same theme at a larger `window`) and **Switch to mixed** (clear the theme). The loop is honest and never dead-ends; the player decides. |

> **Refiner note (4 cycles, diminishing returns).**
> • **C1** surfaced the load-bearing trio Q-A/Q-B/Q-D (depth, toggle shape, exhaustion) and the
> single-concern boundary vs T1 (miss-path) / T3 (integrity).
> • **C2** surfaced Q-C (picker scope → coarse band, not slider) and pinned the F3 ordering (the steered
> "mixed" reuses F3's read — gate behind F3).
> • **C3** surfaced the smaller calls: persist the toggle (`trainerSource?`, additive) vs session-only;
> theme display via `motifLabelOrRaw` (shipped) not unbuilt F1 `labelOrRaw`; `severity.*` keys are
> T2-owned; the after-solve "missed win" must read `moves[0]` (a UCI) and render SAN.
> • **C4** produced no new arbitrage — only wording tightening on §2/§4 (provenance formatter purity,
> exhaustion fall-through) → **stop, returns < 10%**.

---

## §1 Baseline (measured 2026-06-30, head `9296aff`)

- **Tests** 504 / 69 files green · **svelte-check** 0 errors / 0 warnings / 383 files · build green.
- `DB_VERSION = 4`; `PlayerModel.schemaRev = 1`; `SettingsRecord.schemaRev = 1`; latest ADR **0053**.
- **No Svelte component-test harness** (zero `*.svelte.test.ts`) — verify via pure unit tests + static
  wiring-presence grep + manual/preview (portfolio fact, `enhancements-architecture-spec.md` §8).
- **Provenance**: `Puzzle.meta?` carries `sourceGameId/moveNumber/playedMove/severity/motifConfidence/kind`
  (`generatePuzzles.ts:100-107`); consumed by **nothing** in `src/ui`. Trainer shows only
  `tactics.fromYourGameTag` (`Tactics.svelte:400`).
- **Mode**: `mode` is a passive label; `PuzzleQuery.source` supports the 3-way already
  (`PuzzleRepo.ts:18,152-154`). No persisted source preference exists.
- **Selection cascade** (`Tactics.svelte:117-161`): drill(`window 400`) → personal(`window 600`) →
  curated(`window 250`) → `tactics.noMore`. Themed exhaustion falls through silently.
- **F3 seam NOT on disk**: `src/trainer/weaknessSelect.ts` absent (F3 drafted, unbuilt; ADR-0055 not in
  `decisions.md`). T2 treats F3 as a contract and builds after it.
- **F1 helpers**: `motifLabelOrRaw` shipped (`gen.ts:18`); `labelOrRaw`/`activity.*` not built.
- **AP-COACH-1**: `buildStudyPlan` reads neither `weaknessCounters`, `puzzle.meta`, nor `mode`. T2 is
  display + selection only → cannot perturb the study plan.

---

## §2 Scope (single concern: *make trainer selection self-targeting and give "from your games" a voice*)

**IN**
1. **TR4 — full personal-puzzle provenance** (Q-A=b): a pure formatter turns `puzzle.meta` + `moves[0]`
   into a **pre-solve** line ("Move N of your game — you played `playedMove` (`severity`). Find what you
   missed.") and an **after-solve** line ("The win you left: `<SAN of moves[0]>`."). Bilingual.
2. **TR9 — explicit 3-way source toggle + in-trainer theme/difficulty picker** (Q-B=b, Q-C=b): a
   Mixed / From my games / Curated control bound to `PuzzleQuery.source`, persisted as optional
   `SettingsRecord.trainerSource?`; a theme picker writing `tacticsFilterThemes`; a coarse 3-band
   difficulty (Easier / On level / Harder) as a rating-offset + `window` on the existing query.
3. **TR10 — honest exhaustion message** (Q-D=c): when a themed query yields `null` in-zone, show an
   explicit "No more `<theme>` puzzles in your range." with **Widen range** and **Switch to mixed**
   actions — replacing the silent fall-through.
4. **Weakness-steered "Mixed"** *(only if F3 is present)*: when source = Mixed and no explicit theme is
   active, reuse F3's `steerFromWeakness(model.weaknessCounters)` to softly bias the curated fallback
   (F3 owns the bias core; T2 only routes the toggle into it). Gracefully degrades to plain mixed when
   F3's seam is absent.
5. Bilingual FR/EN parity for every new string (provenance, toggle labels, picker, exhaustion); a new
   `severity.*` namespace (T2-owned); theme display via `motifLabelOrRaw`.

**OUT** (explicitly)
- Miss-path feedback — "show solution + why" on a **wrong** move, self-tag→action, second-try → **T1**.
  (T2 owns the *solve* path's after-solve provenance + the *pre* line + toggle/exhaustion, not the miss
  reveal.)
- `usedHint` tracking / grade clamp / progressive hints / streak / daily goal → **T3**.
- Recording changes (`finish()`, `recordTacticsAttempt`, FSRS, `weaknessCounters` *writes*) → F3/T1/T3.
  T2 does **not** touch the recording path.
- The weakness-bias **core** itself (`steerFromWeakness`) → **F3** (T2 consumes it, does not define it).
- Any dashboard/Insights surfacing of `weaknessCounters` → out (F3 steers; T2 surfaces *provenance* and
  *the toggle*, not the counters).
- `DB_VERSION` / destructive schema change → not needed (§3).
- Touching `buildStudyPlan` or its inputs (AP-COACH-1).

---

## §3 Pre-flight (gates before code)

- [ ] **F3 landed (or graceful-degrade verified).** Prefer building after F3 so the steered "Mixed"
      reuses `weaknessSelect`. If F3 is not yet merged, the Mixed branch must compile and run as **plain
      mixed** (`source: undefined`) with the steered call guarded behind the seam's presence — no hard
      import that breaks the build. (Confirms architecture DAG `T2 ◄ F3`.)
- [ ] **No new required field.** The only persisted addition is **optional** `SettingsRecord.trainerSource?:
      'mixed' | 'personal' | 'curated'` (read `?? 'mixed'`; absent on legacy). **NO `DB_VERSION` bump, NO
      `schemaRev` bump** (precedent ADR-0037/0040/0043/0053). The theme/difficulty picker writes existing
      in-memory `app.tacticsFilterThemes` + a session-only difficulty band (NOT persisted).
- [ ] **Pure provenance formatter extracted.** Provenance + difficulty-band → query mapping live in a
      pure module (`src/trainer/provenance.ts`) — **no `Date`, no `Math.random`, no Svelte** — so they
      unit-test without a component harness.
- [ ] **SAN rendering for the missed win** *(enrich E1)*. `moves[0]` is a **UCI**; the after-solve "the
      win you left" renders it as **SAN** via the existing **`ChessGame.moveUci(uci): string | null`**
      (`ChessGame.ts:222`) — `new ChessGame(puzzle.fen).moveUci(puzzle.moves[0])`. Do **not** write a new
      UCI→SAN parser. Keep the formatter pure by computing the SAN at the call site and passing the string
      in. Handle the `null` (illegal/unparseable) case by omitting the after-solve line, not crashing.
- [ ] **AP-COACH-1 path proven.** No edit to `studyPlan.ts` or callers; re-run the determinism test.
- [ ] **Bilingual check.** Every new string FR+EN via the catalogue (ADR-0053); `severity.*` is a closed
      union (mistake/blunder/inaccuracy/missed-win) — all four keys must exist (parity test).
- [ ] **Baseline locked.** `npm test` (504) + `npm run check` (0/0) green on a fresh
      `trainer-personalization` branch off `main` before edits.

---

## §4 Phase A — CODE FIRST

> Order: pure cores → provenance UI → source toggle (+ persistence) → theme/difficulty picker →
> exhaustion message → weakness-steered Mixed wiring. **Code before docs.**

### A1 — Pure cores (new) `src/trainer/provenance.ts`
Pure, harness-free, deterministic:

```ts
// PURE. No Date, no Math.random, no Svelte. Personal-puzzle provenance + difficulty mapping.

export interface PuzzleProvenance {
  /** Shown while solving: which move you played, and how bad. */
  pre: { moveNumber: string; playedMove: string; severity: string; kind: 'mistake' | 'missed-win' } | null;
}

/** Extract the displayable provenance from a puzzle's meta, or null when it isn't a
 *  personal puzzle / lacks meta (the no-op escape — caller shows nothing).
 *  ROBUST (enrich E2): tolerate partial/legacy meta — return null if any of the
 *  ESSENTIAL fields (moveNumber, playedMove, severity) is absent; never throw. */
export function provenanceOf(puzzle: { source: string; meta?: Record<string, string> }): PuzzleProvenance['pre'] | null;

/** Coarse difficulty band -> (ratingOffset, window) applied to the player's puzzleRating
 *  in the existing PuzzleRepo.next() query. No new puzzle metadata. */
export type DifficultyBand = 'easier' | 'on-level' | 'harder';
export function bandToQuery(band: DifficultyBand, baseRating: number): { rating: number; window: number };
//  on-level -> { rating: base,       window: 250 }   (today's curated window)
//  easier   -> { rating: base - 150, window: 200 }
//  harder   -> { rating: base + 150, window: 200 }
```

- `provenanceOf` returns `null` for curated puzzles or missing `meta` → the markup renders nothing
  (byte-identical to today for curated). **No-regression escape hatch.**
- The **after-solve "missed win"** is rendered from `puzzle.moves[0]` (a UCI) converted to **SAN at the
  call site** (`Tactics.svelte`, via `ChessGame`) and passed to the i18n string — the pure module never
  parses FEN/UCI (keeps it dependency-free and trivially testable).

### A2 — Provenance UI `src/ui/Tactics.svelte`
- **Pre-solve** (while `trainer?.state.status === 'solving'` and the puzzle is personal): replace/augment
  the generic `tactics.fromYourGameTag` with a provenance line driven by `provenanceOf(puzzle)`:
  `t('tactics.provenancePre', { move: prov.moveNumber, played: prov.playedMove, severity: t('severity.'+prov.severity) })`
  → FR "Coup 23 de votre partie — vous avez joué **Qxf7??** (gaffe). Trouvez ce que vous avez manqué."
- **After-solve** (when `trainer.state.status === 'solved'` and the puzzle is personal): compute the SAN
  of `puzzle.moves[0]` from `puzzle.fen` via `new ChessGame(puzzle.fen).moveUci(puzzle.moves[0])`
  (`ChessGame.ts:222`; enrich E1) — on `null`, omit the after-solve line — then show
  `t('tactics.provenancePost', { san })` → FR "Le gain que vous avez laissé : **Nxe5**."
  For a `kind:'missed-win'` puzzle the framing is "the win you left"; for a `kind:'mistake'` it is "the
  move you missed" — branch the key on `prov.kind` (two post variants, both bilingual).
- Keep the existing generic tag as the fallback when `provenanceOf` is `null` (non-personal) so curated
  output is unchanged.

### A3 — Source toggle + persistence `src/ui/Tactics.svelte` + `src/store/db.ts` + `src/state/app.svelte.ts`
- **Schema (additive)** `db.ts`: add optional `trainerSource?: 'mixed' | 'personal' | 'curated'` to
  `SettingsRecord` (comment: additive, read `?? 'mixed'`, **no `DB_VERSION` bump**, mirrors `locale?`).
- **UI**: a 3-button segmented control (Mixed / From my games / Curated) bound to the setting. On change:
  persist via the existing `app` settings save path (`saveSettings`/`app.persist…`) and call `loadNext()`
  so the new source takes effect immediately. Default render = `settings.trainerSource ?? 'mixed'`.
- **Honest default (enrich E11)**: the default is always **`'mixed'`** — never persist or seed a default
  that hides personal puzzles, so a fresh or legacy profile sees its "from your games" puzzles by default
  (the inverse of the TR4 burial). The toggle keeps Mixed / From my games one click away at all times.
- **Selection** `loadNext`: thread the chosen source into the cascade. The explicit toggle **overrides**
  the implicit mode label:
  - `curated` → `next({ ...bandQuery, exclude: seen, source: 'curated' })`
  - `personal` → `next({ ...bandQuery(wide), exclude: seen, source: 'personal' })`
  - `mixed` → today's behaviour **plus** the F3 steer when present (A6).
- Keep the dashboard `drillThemes` priority **above** the toggle (an explicit drill still wins), matching
  the shipped order; the toggle governs the **no-drill** selection.

### A4 — In-trainer theme + difficulty picker `src/ui/Tactics.svelte`
- **Theme picker**: a compact control listing the common motif themes. **Single source of truth (enrich
  E8)**: it writes the **same** `app.tacticsFilterThemes` the dashboard drill uses (the existing routing —
  no new field) and sources its **labels** from the **same** `motif.*` set via `motifLabelOrRaw(locale)` —
  so the in-trainer picker and the dashboard control can never present a divergent theme list. Selecting a
  theme sets `app.tacticsFilterThemes = [theme]` and reloads; "All themes" clears it.
- **Difficulty band**: a 3-way Easier / On level / Harder control held in a **session-only** `$state`
  (not persisted — coarse, ephemeral). Feeds `bandToQuery(band, model.puzzleRating.rating)` into the
  `next()` query for the curated/mixed paths. Default `on-level` = today's `window: 250`.
- Picker labels bilingual; theme labels via `motifLabelOrRaw(locale)`.
- **Layout (enrich E9 — wording, not scope)**: keep the source toggle + theme + difficulty in **one
  compact control row**, and only show the theme/difficulty picker in the **no-drill** state (a dashboard
  drill already fixes the theme) so the controls don't crowd the board mid-solve.

### A5 — Honest exhaustion message `src/ui/Tactics.svelte` `loadNext`
- When a **themed** query (dashboard drill *or* the in-trainer theme picker) returns `null` **in-zone**,
  do **not** silently fall through. Set an explicit state and render:
  `t('tactics.themeExhausted', { theme: motifLabelOrRaw(theme, locale) })` →
  FR "Plus aucun problème **fourchette** dans votre fourchette." with two actions:
  - **Widen range** → re-query the same theme at a larger `window` (e.g. 400 → 800); if that still
    yields `null`, escalate the message to "even widened, none left — switch?".
  - **Switch to mixed** → clear `tacticsFilterThemes` (and set source `mixed`), then `loadNext()`.
- The loop **never dead-ends**: if the user takes neither action the puzzle area shows the message, not a
  blank board; the existing `tactics.noMore` remains the terminal "all sources empty" message.

### A6 — Weakness-steered "Mixed" wiring (guarded by F3) `src/ui/Tactics.svelte`
- In the **mixed**, **no-drill** branch, if F3's `steerFromWeakness` is available, compute
  `const steer = steerFromWeakness(model.weaknessCounters)` and, when `steer.themes`, pass them into the
  curated `next({ ...bandQuery, exclude: seen, themes: steer.themes })` (soft bias — F3's contract keeps
  the window wide). On `null`, fall through to plain curated (F3's escape hatch).
- **T2 adds no bias logic** — it only routes the toggle's "mixed" into F3's existing read. If F3 is not
  merged, this branch is plain mixed (the steer call is behind a presence guard / dynamic seam) so the
  build is green either way.

### A7 — i18n keys `src/i18n/messages/tactics.ts` (+ new `severity.*`)
Add (FR+EN), see §8 table: `tactics.provenancePre`, `tactics.provenancePostWin`, `tactics.provenancePostMove`,
`tactics.sourceMixed`, `tactics.sourcePersonal`, `tactics.sourceCurated`, `tactics.sourceLabel`,
`tactics.themePickerLabel`, `tactics.themeAll`, `tactics.diffEasier`, `tactics.diffOnLevel`,
`tactics.diffHarder`, `tactics.diffLabel`, `tactics.themeExhausted`, `tactics.widenRange`,
`tactics.switchToMixed`, `tactics.themeExhaustedWidened`; and `severity.mistake|blunder|inaccuracy|missed-win`.

---

## §5 Tests

**Pure cores — `src/trainer/provenance.test.ts` (new)**
- `provenanceOf` on a personal puzzle with full `meta` → the structured pre object (fields mapped).
- `provenanceOf` on a curated puzzle / a personal puzzle with no `meta` → `null` (no-op escape).
- *(enrich E2)* `provenanceOf` on **partial/legacy `meta`** (missing one of moveNumber/playedMove/severity)
  → `null`, and **never throws**; ignores extra/unknown `meta` keys.
- *(enrich E1)* after-solve SAN equals `new ChessGame(fen).moveUci(moves[0])` for a known personal puzzle;
  a `null` from `moveUci` (illegal/unparseable) → the after-solve line is omitted (no crash).
- `bandToQuery`: each band → expected `{rating, window}`; `on-level` equals today's `{base, 250}`
  (no-regression for the default path).
- Determinism: same input → same output, no `Date`/`Math.random` (purity guard).

**Selection seam — Tactics/loadNext (unit on extracted helpers + static wiring-presence)**
- *(harness-free)* the source→query mapping (a small pure helper or the `bandToQuery` composition) yields
  `source:'curated'` / `'personal'` / `undefined` for the three toggle values.
- with no toggle set, the query is byte-identical to today's `mixed` path (regression).
- a themed query returning `null` produces the **exhaustion** state, **not** a silent personal/curated
  fall-through (assert on the decision helper).
- **wiring-presence grep** (portfolio pattern): `Tactics.svelte` references `provenanceOf`,
  `trainerSource`, `themeExhausted`, and (when F3 present) `steerFromWeakness`.

**i18n parity**
- every new `tactics.*` and all four `severity.*` keys have FR **and** EN (extend the existing parity
  test; iterate the `severity` union so a future value without a label fails — mirrors F1's exhaustiveness
  gate).
- a personal puzzle with `severity:'blunder'` renders the FR severity word (e.g. "gaffe"), not "blunder".

**F3-contract graceful degrade**
- with the `steerFromWeakness` seam **absent**, the mixed branch compiles and selects plain mixed (the
  guard path) — a static/unit check that the import is optional/guarded.

**Regression guards**
- `studyPlan` determinism test stays green (AP-COACH-1 — T2 touches neither plan nor inputs).
- existing `PuzzleRepo.test.ts` / `TacticalTrainer.test.ts` stay green (no `next()` signature change;
  T2 only passes existing fields `source/themes/window/rating/exclude`).
- full suite ≥ baseline (504) + new tests, zero prior failures.

---

## §6 Verification

- [ ] `npm test` green, **count ≥ 504 + new tests**, zero prior failures.
- [ ] `svelte-check` **0 errors / 0 warnings**.
- [ ] `npm run build` green.
- [ ] **Manual (PWA)**:
  - Solve a **personal** puzzle → pre-solve provenance line shows the move you played + severity; after
    solving, the "the win you left / move you missed" line shows the correct SAN. Curated puzzles show
    the unchanged generic line (no provenance).
  - Toggle **From my games / Curated / Mixed** → selection switches accordingly; reload the app → the
    toggle is remembered (`trainerSource` persisted); "Mixed" is the default for a fresh profile, and a
    **legacy profile (no `trainerSource`) defaults to mixed** and still sees its personal puzzles (E11).
  - Pick a **theme** + a **difficulty band** in-trainer → puzzles match; clearing returns to the toggle.
  - Drill a theme to exhaustion → explicit "no more `<theme>` in your range" with **Widen** / **Switch to
    mixed**; *neither* silently flips the mode. Both actions work; the loop never blanks.
  - *(with F3 merged)* Mixed with a dominant weakness leans toward that theme; with no signal, mixed is
    byte-identical to today.
- [ ] **FR/EN parity**: every new surface (provenance pre/post, toggle, picker, exhaustion) shows correct
      FR and EN; severity words are standard French chess vocabulary.
- [ ] **AP-COACH-1**: Insights study-plan output unchanged before/after (determinism test + spot-check).
- [ ] **No `DB_VERSION` bump**; legacy profiles (no `trainerSource`) default to mixed and behave as today.

---

## §7 Docs (LAST)

- `decisions.md`: **no new ADR** (feature; additive-optional). One append-only line under the ADR-0053 /
  enhancements follow-ups: "T2 trainer-personalization — personal-puzzle provenance surfaced (pre + after-
  solve missed win); 3-way source toggle (`trainerSource?`, additive, no `DB_VERSION` bump); in-trainer
  theme + coarse difficulty picker; honest theme-exhaustion message (widen/switch); weakness-steered Mixed
  consumes F3's read. AP-COACH-1 preserved." *(If a reviewer deems the persisted source-preference
  architectural, flag ADR-≥0058.)*
- `specs/enhancements-architecture-spec.md`: tick the **T2** row (folds TR4, TR9, TR10) as drafted/built.
- README: no change (behaviour is trainer-internal personalization; no new top-level feature surface).

---

## §8 New i18n keys (FR / EN)

| key | FR | EN |
|---|---|---|
| `tactics.provenancePre` | Coup {move} de votre partie — vous avez joué {played} ({severity}). Trouvez ce que vous avez manqué. | Move {move} of your game — you played {played} ({severity}). Find what you missed. |
| `tactics.provenancePostWin` | Le gain que vous avez laissé : {san}. | The win you left: {san}. |
| `tactics.provenancePostMove` | Le coup que vous avez manqué : {san}. | The move you missed: {san}. |
| `tactics.sourceLabel` | Source : | Source: |
| `tactics.sourceMixed` | Mixte | Mixed |
| `tactics.sourcePersonal` | Mes parties | From my games |
| `tactics.sourceCurated` | Sélection | Curated |
| `tactics.themePickerLabel` | Thème : | Theme: |
| `tactics.themeAll` | Tous | All |
| `tactics.diffLabel` | Difficulté : | Difficulty: |
| `tactics.diffEasier` | Plus facile | Easier |
| `tactics.diffOnLevel` | À mon niveau | On level |
| `tactics.diffHarder` | Plus difficile | Harder |
| `tactics.themeExhausted` | Plus aucun problème {theme} dans votre fourchette. | No more {theme} puzzles in your range. |
| `tactics.themeExhaustedWidened` | Même en élargissant, plus aucun {theme} — passer en mixte ? | Even widened, no more {theme} — switch to mixed? |
| `tactics.widenRange` | Élargir la fourchette | Widen range |
| `tactics.switchToMixed` | Passer en mixte | Switch to mixed |
| `severity.mistake` | erreur | mistake |
| `severity.blunder` | gaffe | blunder |
| `severity.inaccuracy` | imprécision | inaccuracy |
| `severity.missed-win` | gain manqué | missed win |

> **Terminology fidelity** (mirrors F1 I2): FR severity words use standard French chess register
> (`gaffe`, `imprécision`), consistent with `motif.*`. Theme labels reuse `motifLabelOrRaw` so the FR
> motif vocabulary (fourchette, clouage, enfilade…) is consistent across the picker and the theme line.

---

## §9 Anti-patterns (AP-TPERS-*)

- **AP-TPERS-1 — Re-burying provenance.** Falling back to the generic "★ from your game" when full `meta`
  is present. If `provenanceOf` returns data, show the full pre + after-solve lines; the generic tag is
  only for the `null` (non-personal) case.
- **AP-TPERS-2 — Silent mode flip on exhaustion.** A themed query returning `null` must surface the
  explicit message + widen/switch (Q-D), never silently fall through to personal/curated. This is the TR10
  bug; reintroducing it is a regression.
- **AP-TPERS-3 — Dead-ending the loop.** Neither the toggle, the picker, nor exhaustion may leave a blank
  board with no message. Always render a state (puzzle, provenance, exhaustion, or `tactics.noMore`).
- **AP-TPERS-4 — Schema churn / `DB_VERSION` bump.** Do **not** bump `DB_VERSION` or `schemaRev`; the
  source preference is an **optional** `trainerSource?` read `?? 'mixed'`. The difficulty band is
  session-only (not persisted). Do not add a new `source` literal — the union is already 3-valued.
- **AP-TPERS-5 — Owning F3's bias core.** Do not reimplement weakness ranking in T2. The Mixed steer
  **consumes** F3's `steerFromWeakness`; if F3 is absent, degrade to plain mixed, never inline a copy.
- **AP-TPERS-6 — Impurity in the cores.** No `Date`/`Math.random`/Svelte in `provenance.ts`. SAN of the
  missed win is computed at the call site and passed in as a string; the formatter stays dependency-free.
- **AP-TPERS-7 — Difficulty as a slider.** Keep difficulty to 3 coarse bands mapped to rating-offset +
  `window`. No fine-grained rating input, no new puzzle metadata, no per-puzzle difficulty schema.
- **AP-TPERS-8 — Study-plan / recording drift.** T2 must not route `puzzle.meta`/`mode`/`trainerSource`
  into `buildStudyPlan` (AP-COACH-1) and must not touch `finish()`/`recordTacticsAttempt`/FSRS/
  `weaknessCounters` writes (F3/T1/T3 territory). Display + selection only.
- **AP-TPERS-9 — i18n half-parity / raw enum leak.** Every new string FR+EN; the four `severity.*` keys
  are a closed union (parity-gated); severities and themes are rendered through labels, never raw.
- **AP-TPERS-10 — Throwing on partial provenance** *(enrich E2)*. `provenanceOf` must tolerate
  partial/legacy `meta`: return `null` when an essential field is absent, never throw mid-solve. A legacy
  personal puzzle without full `meta` degrades to the generic tag — it must not break the trainer.
- **AP-TPERS-11 — Divergent theme lists** *(enrich E8)*. The in-trainer theme picker must write the same
  `tacticsFilterThemes` and use the same `motif.*`/`motifLabelOrRaw` label set as the dashboard drill.
  Two independent theme lists that can drift apart is the anti-pattern.
- **AP-TPERS-12 — Burying "from your games" via a sticky source** *(enrich E11)*. Never default or
  auto-persist `trainerSource` to a value that hides personal puzzles for a fresh/legacy profile; the
  default is `'mixed'` and the toggle is always one click from Mixed / From my games. (Inverse-TR4 guard.)

---

## §10 Rollback

- Fully additive and independently revertible by sub-feature:
  - **A2 provenance** — revert the markup + the 3 provenance keys → trainer shows the generic tag again.
  - **A3 toggle** — revert the segmented control + drop `trainerSource?` (legacy rows ignore it; reads
    `?? 'mixed'`); selection returns to the implicit cascade.
  - **A4 picker** — revert the theme/difficulty controls; `tacticsFilterThemes` still works from the
    dashboard; difficulty was session-only (nothing to undo).
  - **A5 exhaustion** — revert to the prior silent fall-through (the original TR10 behaviour).
  - **A6 steer wiring** — remove the `steerFromWeakness` call; Mixed is plain mixed.
- **No migration to undo** (no `DB_VERSION` bump). `trainerSource` rows read harmlessly if the field is
  dropped (optional).

---

## §11 Follow-up

- **T1** — miss-path "show solution + why", self-tag→action, second-try (the *wrong*-move moment; T2 owns
  the *solve* moment's after-solve line).
- **T3** — `usedHint`+clamp, progressive hints, streak / daily goal, last-trained.
- Consider (DEFER) surfacing provenance in **Review** as well (the SRS re-encounter of a personal puzzle
  could repeat "from move 23 of your game") — out of scope here (Review is a different surface; T2 is the
  trainer).
- Consider (DEFER) a per-game "open the source game" deep-link from the provenance line (needs F5's
  `getAllGames`/game-history read — not yet built; revisit after F5).
- Consider (DEFER) persisting the difficulty band per source if users want it sticky (today it is coarse
  + ephemeral by design, AP-TPERS-7).
