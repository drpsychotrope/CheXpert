# Spec — coach real-data assessment (feature PR C4)

**PR**: `coach-real-data-assessment` · **Scope**: feature · **Portfolio**: C4 of `enhancements-architecture-spec.md` (Coach stack)
**Drafted**: 2026-06-30 · **Spec version**: V1 (`/draft-general` 4 cycles + `/enrich` 3 cycles; FOLD set applied — `reports/coach-real-data-assessment_improvements.md`) · **Pre-V0 scan**: PASS (with material premise-shift, §0.5)
**Folds**: CO11 (assess from real imported PGN games) + CO6 (blend played-game history into the profile)
**Dependency**: F5 (`games-store-pgn-io-spec.md`) — named-consumer link for the history-list/import affordance. **Builds first.** (NB: F5's `getAllGames` is **not** on C4's blend data path — see §0.5.)
**New ADR**: **NONE.** C4 consumes existing pure cores additively (no schema change, no new architectural pattern); mirrors F1/F2/F4. If ratification disagrees, the next free reserved number is **0058** (band 0054–0058; flag ≥0059 only for a genuinely architectural change).

---

## §0 Context

The coach **re-probes from zero every run and ignores all played-game history.** Each assessment runs ~14 themed-ladder puzzles plus **one short bot game** (`AdaptiveOpponent`), analyses *that single toy game* with `runAnalysis(source:'played')` (`Coach.svelte:164`), and derives the radar from `buildWeaknessProfile([thatOneGame], baseline, locale).dimensions` (`Coach.svelte:172`). Meanwhile Insights/Dashboard already hold a rich, history-derived profile over `loadAllAnalyses()` (every analyzed game). The coach simply never looks at it.

C4 closes that gap: **assess from the user's real games, not one toy game.** Folds CO11 (real imported PGN feed) and CO6 (blend played history). The mechanism is deliberately small — feed a **windowed array of real analyses** into the **same** `buildWeaknessProfile` the coach already consumes, instead of a one-element toy array. No new generator, no fork, no schema change.

**Doctrine carried in**: additive-optional, **no `DB_VERSION` bump**; honesty (directional, sample-size-labelled, no grade); pure cores (no `Date`/`Math.random` in logic); bilingual FR/EN parity; **Insights byte-identical** (AP-COACH-1 — consume, never fork `buildWeaknessProfile`/`buildStudyPlan`); **no diagnostic→pool leak** (AP-COACH-8); single concern; **code before docs**; local-first (import client-side only). Baseline **504 tests / DB_VERSION 4**.

## §0.5 Pre-V0 scan — premise-shift (verified before drafting)

The scan **confirmed the directional premise** (coach ignores history; one toy game) but corrected the *mechanism* the portfolio assumed. Evidence in `reports/coach-real-data-assessment_{target_exists,baseline,collision}.json`.

1. **`buildWeaknessProfile` is already N-game.** Signature is `buildWeaknessProfile(analyses: GameAnalysis[], playerRating: number, locale?: Locale)` (`weakness.ts:204`) and it aggregates over the whole array. The coach passes `[oneGame]` today. **C4 = pass the real windowed array.** No new core, no fork (AP-COACH-1 satisfied by construction).
2. **Analyses are already unified.** `runAnalysis` writes **every** source (`'imported'` and `'played'`) into the single `gameAnalyses` store (`runAnalysis.ts:63`), and `loadAllAnalyses()` reads it (`runAnalysis.ts:91`). So `loadAllAnalyses()` **already returns imported + played** analyses. `GameAnalysis` carries `source:'imported'|'played'` (`types.ts:69`) and `analyzedAt` (`types.ts:71`) → C4 can window/label **purely**, no DB change.
3. **Real-PGN import already exists.** `Import.svelte` already parses Lichess/Chess.com PGN (`parsePgn`/`inferPlayerColor`), guards multi-game/headers-only/colour-not-detected, runs `runAnalysis(source:'imported')`, and persists via `putImportedGame` (`Import.svelte:4,47,52,62,85,96`). **CO11's import+analyze layer is already built.** C4's job is the **coach consuming** those analyses + a reachable "import more" affordance — *not* re-building import.
4. **`getAllGames` (F5) is off C4's critical path.** The blend needs **analyses** (`gameAnalyses` via `loadAllAnalyses`), not game **records**. F5 remains the named dependency for the **history-list/import UX**, but the assessment data path stands on hooks that **exist today**. F5 builds first per the portfolio; C4 does not block on `getAllGames` for correctness.

**No STOP.** The goal is valid and the surface shrinks: window + consume + an honest provenance line + a source-choice step.

## §0.6 Arbitrages — RESOLVED 2026-06-30 (recommended defaults applied; flip any to re-fold)

**Q-A=both · Q-B=a · Q-C=a · Q-D=consume.** Rationale + alternatives in `reports/coach-real-data-assessment_arbitrages.md`.

- **Q-A — blend source.** **Both** (history-first, import optional). `loadAllAnalyses()` already unifies imported+played; excluding either is artificial. If history exists, offer to build dimensions from it; the existing Import flow adds more.
- **Q-B — how many games.** **A small recent window, sample-size labelled.** Window = most-recent **N=10** by `analyzedAt` (pure). Honesty (`gamesAnalyzed`, per-dim `sampleSize`, "not measured" collapse) is **inherited** from `buildWeaknessProfile`. User-tunable N → §11.
- **Q-C — persist imported games.** **Persist via the existing import path (F5 substrate); no pool leak.** Import already persists; ephemeral would fork a worse path. The `weaknessCounters`/personal-puzzle fold on real games is the intended Phase-2 loop, **not** an AP-COACH-8 violation (that rule is about *probe* puzzles seeding pools).
- **Q-D — consume, never fork.** **Consume** (confirmed: `Coach.svelte:172` already consumes). C4 changes only the input array.

## §1 Empirical baseline

From `reports/coach-real-data-assessment_{baseline,target_exists,collision}.json` (2026-06-30):

| Fact | Value |
|---|---|
| Tests baseline | **504 passed / 69 files** |
| `svelte-check` baseline | **0 / 0** (portfolio §8 anchor; 383 files) |
| `DB_VERSION` | 4 — **no bump in C4** |
| Latest ADR in `decisions.md` | **0053** (0054–0057 reserved by portfolio §8; **C4 takes none**) |
| `buildWeaknessProfile` sig | `(analyses: GameAnalysis[], playerRating: number, locale?: Locale)` — **already N-game** (`weakness.ts:204`) |
| `buildCoachProfile` sig | `({puzzleRating, probes, gameDimensions: DimensionScore[]\|null, assessedAt, locale})` (`diagnostic.ts:45`) |
| `loadAllAnalyses()` | reads `gameAnalyses` (imported **+** played), cached (`runAnalysis.ts:91`) |
| `GameAnalysis` blend fields | `source:'imported'\|'played'`, `analyzedAt:number` (`types.ts:69,71`) |
| Coach reads history today | **NO** — `loadAllAnalyses` not imported in `Coach.svelte` |
| Coach game today | ONE bot game, `gameId coach-<ts>`, `buildWeaknessProfile([analysis]).dimensions` (`Coach.svelte:164,172`) |
| Real-PGN import | **already built** (`Import.svelte` → `runAnalysis(source:'imported')` + `putImportedGame`) |
| Symbol/key/step collisions | **none** (`recentAnalyses`, `coach.useHistory*`, `offer-source` all absent) |
| Insights generator | `buildStudyPlan`/`buildWeaknessProfile` **untouched** by C4 → byte-identical |

## §2 Scope (single concern: coach assesses from real, windowed analyses)

**In:**

### §2.1 Window + consume (the core change)
Replace the one-toy-game dimension source with a **windowed array of real analyses**. At the coach's commit path, when real history is available, compute `gameDimensions = buildWeaknessProfile(recentAnalyses(loadAllAnalyses(), N), baseline, locale).dimensions` and pass it to the **unchanged** `buildCoachProfile({gameDimensions})`. N defaults to **10** (constant).

### §2.2 Pure window helper (FOLD-C3)
Add `recentAnalyses(analyses: GameAnalysis[], n: number): GameAnalysis[]` — sort by `analyzedAt` desc, take first `n`. **Pure** (no `Date.now()`), unit-tested. Optionally a sibling `analysesBySource(analyses)` returning `{played, imported}` counts for the provenance line (also pure).

### §2.3 Source-choice step (FOLD-C5, Q-A)
Generalise the existing **`offer-game`** step into an offer of *data source* (no new top-level view; stay inside Coach):
- **(a) Use my recent games** — when `loadAllAnalyses()` is non-empty: build dimensions from the recent window (§2.1).
- **(b) Play a quick game** — the existing toy-game path (unchanged), kept as one option.
- **(c) Import more games** — route to the existing **Import** flow (F5's history/import surface); imported analyses then appear in the window on the next assessment.
Keep it one extra in-step choice; the toy game is no longer the *only* game source.

### §2.4 No-fork guarantee (Q-D)
`buildWeaknessProfile` and `buildStudyPlan` are **not modified**. C4 only changes the **input array** handed to the existing core. Insights output is byte-identical.

### §2.5 Honest provenance line (FOLD-C1, FOLD-C4)
Extend the existing provenance line (`Coach.svelte:252`, `coach.directional` + `coach.source*`) to state **what** fed the profile and the **count**: "based on **N** recent games (**M** played, **K** imported)" — derived purely from `GameAnalysis.source`. Directional only, **no grade**. `gamesAnalyzed`/`sampleSize` already come from `buildWeaknessProfile`.

### §2.6 Empty/thin-history fallback (FOLD-C2)
If the window is empty (or below a small floor), **fall back to the existing toy-game/ladders path** — the current behaviour is the floor. Never render an all-"not measured" radar as if it were an assessment. (The ladders always run regardless, as today.)

### §2.7 `source.game` truthfulness (FOLD-C6)
`CoachProfile.source.game` (boolean, already exists) is set `true` when **any** real-game dimensions fed the profile (history window *or* toy game). The **text** of the provenance line distinguishes *history* vs *single game*. **No schema change.**

**Out / deferred (→ §11):**
- **User-tunable window N / per-source filters** (DEF-C1) → C5 or a coach-settings follow-up.
- **Opening-specific diagnosis → repertoire** from blended history (DEF-C2) → **C7** (CO17).
- **Game-review (EvalGraph) surfacing** for the games that fed the profile (DEF-C3) → **C6** (CO13).
- **Bulk multi-game `.pgn` upload** (DEF-C4) → F5 §11. C4 consumes whatever import produces.
- A dedicated **coach rating pool** (REJ-C2 / coach §11) — out; C4 reads analyses, never writes pools.

## §3 Pre-flight

- Confirm baseline green: `npm test` (expect 504/504) + `npm run check` (expect 0/0).
- Re-grep collision guard: `recentAnalyses`, `analysesBySource`, `coach.useHistory*`/`coach.source*` new variants, an `offer-source` step name — confirm still absent.
- Confirm **F5 is merged** (history/import surface present) so §2.3(c) routes to a live affordance; if F5 is not yet merged, §2.3(c) degrades to "use the existing Import view" link (Import already exists) — C4's data path (§2.1) is unaffected either way.
- **Assert no `DB_VERSION` change** and **no edit to `buildWeaknessProfile`/`buildStudyPlan`** in the diff (doctrine + AP-COACH-1 gates).

## §4 Phase A — CODE FIRST

Order: pure helper (+ test) → Coach data path → source-choice step → provenance line → i18n. Compiles green before any doc edit.

1. **Pure window helper** — `src/coach/assessmentWindow.ts` (new, pure; no engine/Svelte/`Date` import):
   ```ts
   import type { GameAnalysis } from '../analysis/types';
   export function recentAnalyses(analyses: GameAnalysis[], n: number): GameAnalysis[] {
     return [...analyses].sort((a, b) => b.analyzedAt - a.analyzedAt).slice(0, Math.max(0, n));
   }
   export function analysesBySource(analyses: GameAnalysis[]): { played: number; imported: number } {
     let played = 0, imported = 0;
     for (const a of analyses) (a.source === 'imported' ? imported++ : played++);
     return { played, imported };
   }
   export const COACH_ASSESS_WINDOW = 10;       // N (Q-B); constant, not a setting in V1
   export const COACH_ASSESS_MIN_GAMES = 1;     // floor for the history path (FOLD-C2)
   ```
2. **`Coach.svelte` data path** — add `import { loadAllAnalyses } from '../analysis/runAnalysis'` and `import { recentAnalyses, analysesBySource, COACH_ASSESS_WINDOW, COACH_ASSESS_MIN_GAMES } from '../coach/assessmentWindow'`. Add a path that, when the user picks **"use my recent games"** (§2.3a):
   ```ts
   async function finishWithHistory() {
     step = 'analysing';
     const all = await loadAllAnalyses();
     const window = recentAnalyses(all, COACH_ASSESS_WINDOW);
     if (window.length < COACH_ASSESS_MIN_GAMES) return finishWithoutGame(); // fallback (FOLD-C2)
     const gameDimensions = buildWeaknessProfile(window, baseline(), getLocale()).dimensions;
     historyCounts = analysesBySource(window);  // {played, imported} for provenance (FOLD-C4)
     await commit(gameDimensions);
   }
   ```
   Keep `finishGame()` (toy game) and `finishWithoutGame()` (ladders-only) **unchanged**. The toy-game path may also set `historyCounts = { played: 1, imported: 0 }` so the line reads "1 played game".
3. **Source-choice step** (§2.3) — in the `offer-game` step block, add the three buttons (a/b/c). Button (a) is shown only when history exists (gate on a cheap `app`-level flag or an on-mount `loadAllAnalyses().length`); (b) is the existing "Play game"; (c) routes via `app.go('import'|'analyse')` (F5 surface). No new `Step` value required if folded into `offer-game`; if a distinct `offer-source` step reads cleaner, that name is collision-free.
4. **Provenance line** (§2.5/§2.7) — extend the `coach.directional` line at `Coach.svelte:252` to include the windowed count + per-source breakdown when `gameAnalyzed`. Set `source.game` truthfully (FOLD-C6) — note `buildCoachProfile` already sets `source.game = !!gameDimensions`, so passing history dims sets it `true` for free; only the **display text** needs the history-vs-single distinction.
5. **i18n** — add `coach.*` keys (FR+EN) in `src/i18n/messages/coach.ts`:
   `coach.useMyGames`, `coach.useMyGamesHint`, `coach.importMore`, `coach.basedOnGames` (`"based on {n} recent games ({played} played, {imported} imported)"` / `"d'après {n} parties récentes ({played} jouées, {imported} importées)"`), `coach.fromHistory`, `coach.fromSingleGame`. Parity passes by construction.

**Diff must NOT touch** `weakness.ts`, `studyPlan.ts`, `db.ts`, `diagnostic.ts` core logic (the `buildCoachProfile` signature already fits; no change needed there).

## §5 Tests

- **`assessmentWindow` (new `assessmentWindow.test.ts`, pure)**: `recentAnalyses` returns the N newest by `analyzedAt` (deterministic; no `Date.now`), handles `n>len`, `n=0`, empty input; ties stable. `analysesBySource` counts played/imported correctly incl. all-played and mixed.
- **Coach data-path (logic-level, no component harness)**: assert via a small unit that `buildWeaknessProfile(recentAnalyses(fixtures, 10), …)` yields the same `dimensions` as calling `buildWeaknessProfile` on the windowed array directly (proves consume-not-fork) — i.e. the helper composes with the existing core. (No Svelte component test exists in the repo — verify wiring statically + manual, per portfolio §8.)
- **Fallback**: window below floor → the path defers to `finishWithoutGame` (assert the helper returns `<MIN` so the branch is taken).
- **Insights byte-identity**: assert `buildWeaknessProfile`/`buildStudyPlan` files are **untouched**; run the existing Insights snapshot test — unchanged.
- **i18n parity**: existing structural test covers new `coach.*` keys (FR+EN) by construction.
- **No regression**: full `npm test` stays **≥504** (new tests add to it).

## §6 Verification

1. `npm test` — green, count = 504 + new tests, **0 failures**.
2. `npm run check` — **0 / 0**.
3. `npm run build` — green.
4. **Manual smoke**: with ≥1 analyzed game in history (played or imported), open Coach → run ladders → at the source step pick **"use my recent games"** → radar reflects the **history** dimensions; provenance line reads "based on N recent games (M played, K imported)"; FR/EN flip works. With **no** history, the "use my recent games" option is hidden and the toy-game/ladders path behaves exactly as today. Pick **"import more"** → lands in the Import view (F5 surface); after importing, the game appears in the next assessment's window. Pick **"play a quick game"** → unchanged toy-game flow.
5. **Doctrine gates**: diff has **no `DB_VERSION` change**, **no edit to `buildWeaknessProfile`/`buildStudyPlan`** (AP-COACH-1), no write into any rating pool (AP-COACH-8), every new string FR+EN, no server/network call.

## §7 Docs (LAST)

- **`decisions.md`** — **no new ADR** (C4 is additive consumption; mirrors F1/F2/F4). Append a short **note** under the coach/portfolio area recording: coach now assesses from a recent-history window via the existing `buildWeaknessProfile` (consume, not fork); Q-A=both / Q-B=N=10 / Q-C=persist-via-F5-no-pool-leak / Q-D=consume; no `DB_VERSION` bump; cross-link ADR-0045 (coach), F5 (`games-store-pgn-io`), and `enhancements-architecture-spec.md` C4. *(If ratification insists on a formal ADR, use **0058**.)* Append-only; do not edit D001–D051 or prior ADRs.
- **`specs/enhancements-architecture-spec.md`** — mark C4 status (drafted→shipped) in §3 when merged (light touch).
- No README change (history-blend is self-describing via the provenance line; the Import view is unchanged).

## §8 Acceptance

- [ ] Coach can build its profile from a **recent-history window** of real analyses (`recentAnalyses(loadAllAnalyses(), N)`), not only one toy game — CO6 + CO11 closed at the *consumption* layer.
- [ ] `recentAnalyses`/`analysesBySource` exist, **pure**, unit-tested; `COACH_ASSESS_WINDOW`=10.
- [ ] Coach **consumes** `buildWeaknessProfile([...windowed])` — `buildWeaknessProfile`/`buildStudyPlan`/`diagnostic.ts` core unchanged ⇒ **Insights byte-identical** (AP-COACH-1).
- [ ] Source-choice step offers: use my recent games / play a quick game / import more — toy game is one option, not the only one.
- [ ] Provenance line states **N recent games (M played, K imported)**, directional, **no grade**; `source.game` truthful (history vs single).
- [ ] **Empty/thin history** falls back to the existing toy-game/ladders path (no all-"not measured" radar).
- [ ] **No `DB_VERSION` bump**, no new store/index; no rating-pool write (AP-COACH-8); no network.
- [ ] New `coach.*` labels FR+EN; parity test green.
- [ ] `npm test` ≥504 green · `npm run check` 0/0 · `npm run build` green.
- [ ] **No new ADR** (note appended; 0058 reserved only if ratification overrides).

## §9 Anti-patterns (AP-CREAL-)

- **AP-CREAL-1** — **Forking `buildWeaknessProfile`/`buildStudyPlan`** (or copying its aggregation into a coach-local helper). Window the array, call the shared core. Insights must stay byte-identical (AP-COACH-1).
- **AP-CREAL-2** — **Leaking the blended weakness signal into `puzzleRating`/any rating pool** so assessment "counts". C4 **reads** analyses; it never writes pools (AP-COACH-8). Probe ladders stay pool-inert.
- **AP-CREAL-3** — **Bumping `DB_VERSION`** for the blend. It reads existing `gameAnalyses` and windows by existing `analyzedAt`/`source`; no new field/store.
- **AP-CREAL-4** — **`Date.now()` in the window core.** `recentAnalyses` sorts by the records' own `analyzedAt`; the UI owns any clock. Keep the helper pure/testable.
- **AP-CREAL-5** — **Showing an all-"not measured" radar as an assessment** when history is empty/thin. Fall back to the existing toy-game/ladders path (FOLD-C2).
- **AP-CREAL-6** — **Dropping sample-size honesty.** Surface `gamesAnalyzed` + the per-source count; stay directional, no single grade (AP-CHESS-13/24).
- **AP-CREAL-7** — **Re-implementing PGN import.** Import already parses/guards/persists real PGN (`Import.svelte`); C4 routes to it, it does not rebuild it.
- **AP-CREAL-8** — **A second analyses read path / re-deriving from game records.** Use the cached `loadAllAnalyses()` (it already unifies imported+played); do not add a parallel `getAllGames`-based blend.
- **AP-CREAL-9** — **Mislabelling provenance.** `source.game` true with the line still implying a single game (or vice-versa). The text must match what actually fed the profile (FOLD-C6).
- **AP-CREAL-10** — **Untranslated new labels** (FR-only or EN-only). Every new `coach.*` string is a fr+en `Message`.
- **AP-CREAL-11** — **A new top-level view** for source choice. Stay inside Coach's existing step machine (Q-A/§2.3); no `View`-union/NAV churn.

## §10 Rollback

Additive and isolated. To revert: delete `src/coach/assessmentWindow.ts` + its test; remove the `finishWithHistory` path and the source-choice buttons in `Coach.svelte` (restoring the two original options); revert the provenance-line text and the new `coach.*` keys. `buildWeaknessProfile`, `buildCoachProfile`, `loadAllAnalyses`, the Import flow, and the DB are **untouched** (nothing to migrate). No `DB_VERSION` change was introduced. The decisions.md note (append-only) stays, annotated reverted if needed.

## §11 Follow-up

- **DEF-C1** — user-tunable window N (5/10/20) + per-source filter toggles (C5 / coach-settings).
- **DEF-C2 / C7** — opening-specific diagnosis from blended history → repertoire line (CO17).
- **DEF-C3 / C6** — surface game review (EvalGraph) for the games that fed the profile (CO13).
- **DEF-C4 / F5 §11** — bulk multi-game `.pgn` upload to seed history fast; C4 consumes the result.
- A dedicated **coach rating pool** + cross-run trend on the blended assessment (coach §11) — still deferred.
- Tighter loop: auto-prefer **"use my recent games"** once history passes a confidence floor, with the toy game as a top-up rather than a peer option.
