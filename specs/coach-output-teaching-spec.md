# Spec — coach-output-teaching (Feature **C6**)

**Type**: feature PR (Coach stack) · **Spec version**: **V1** (4 `/draft-general` cycles applied; FOLD set from `/enrich` ×3 folded) · **Drafted**: 2026-06-30
**Architecture parent**: `specs/enhancements-architecture-spec.md` §3 Coach (C6) · **ADR**: none new (reuse under ADR-0040/0021/0045/0052/0053; if ever warranted allocate **≥0059** — 0054-0058 reserved; see §0.5 Q-G)
**Branch base**: `main` · **Hard dependency**: **F4** (`SolutionReveal.svelte`) · **Sibling reports**: `reports/coach-output-teaching_{target_exists,baseline,collision,arbitrages,improvements}.{json,md}`

---

## §0 Context

The Coach computes a rich diagnosis but the **result screen does not communicate or teach**. Today (`src/ui/Coach.svelte:248-267`) the result is a `<Radar>`, two bullet lists (strengths / weaknesses as bare labels), and a program `<ol>`. There is **no prose**, **no game review**, **no concept teaching**, and **no statement of which fix matters most**.

Worse, the Coach **throws away** its most expensive artifact. `finishGame()` runs the **full** `runAnalysis(source:'played')` (`Coach.svelte:164`) but keeps only `buildWeaknessProfile([analysis]).dimensions` (line 172) for the radar. The returned **`GameAnalysis`** — the per-ply eval data that `winCurve()` and `criticalMoments()` derive the win-probability curve and turning points from — is **discarded**. The `EvalGraph` component and the `criticalMoments`/`explainPly` selectors all already exist and are PURE; the Coach simply never calls them.

**C6 makes the coach COMMUNICATE + TEACH** by folding four findings into the result surface:
- **CO8 — narrative voice**: a generated prose summary ("solid on forks; pins & resilience need work — start here, because…"), built from `CoachProfile` via templated bilingual catalogue phrases (PURE, no runtime LLM).
- **CO1 — concept teaching**: a concept card for the top weak motif, reusing `cardForThemes` + `ConceptCard.svelte`.
- **CO13 — surface the game review**: keep the discarded `GameAnalysis`, render `<EvalGraph>` + the top 2-3 turning points (`criticalMoments`); on selecting a turning point, replay it via F4's `SolutionReveal` with an `explainPly`-derived "why".
- **CO9 — expected-impact prioritization**: a leverage rank (severity × frequency, qualitative) that names the single **"start here"** focus and frames a rough, honest payoff — **no invented Elo number**.

### Pre-V0 empirical scan (verdict: **PROCEED**)
Baseline anchor: **504 tests / 69 files green** (file count re-confirmed = 69); **svelte-check 383 files, 0/0**; **`DB_VERSION` 4** (`reports/coach-output-teaching_baseline.json`). All reuse hooks read and verified-present (`reports/..._target_exists.json`) **except** `SolutionReveal.svelte`, which is F4's forward contract (C6 hard-depends on F4). **Four premise refinements** (carried into §0.5):
1. `GameAnalysis` has **no precomputed `winCurve`/`criticalMoments` field**; both are **pure selectors** (`src/analysis/criticalMoments.ts`) over `analysis.plies`. The coach computes the full ply analysis (the raw material) then discards it; C6 calls the selectors. (Refines, not blocks, "turning points the coach computes then discards".)
2. The discarded `analysis` is **not persisted** on `CoachProfile` and need not be. C6 holds it in component `$state` for the just-played game → **no `DB_VERSION` bump, no new persisted field**.
3. `explainPly` needs a real `PlyAnalysis` (engine eval) — the Coach **has** one (`analysis.plies`), unlike a trainer miss. So the Coach "why" is the **rich engine-backed `explainPly`**, exactly as F4 §11 specifies.
4. `SolutionReveal.svelte` does not exist yet (F4 unbuilt). **C6 hard-depends on F4** (architecture DAG Phase 2: C6 ◄ F4).

---

## §0.5 Arbitrages (recommended defaults — ratify before build)

> Full reasoning in `reports/coach-output-teaching_arbitrages.md`. Defaults below are what the spec is written against.

| # | Question | Options | **Recommended default** |
|---|---|---|---|
| **Q-A** | Narrative implementation | (a) templated catalogue phrases (pure, bilingual); (b) free LLM text at runtime; (c) hybrid | **(a) templated catalogue phrases.** A new PURE core `src/coach/narrative.ts` assembles a 2-4 sentence summary from `CoachProfile` via `gt(generators, …, locale)` — exactly like `program.ts`. **No runtime LLM** (purity + FR/EN parity + offline + byte-stable tests). |
| **Q-B** | Teach surface | (a) concept card for the top weak motif behind a toggle; (b) cards for all weak motifs; (c) none | **(a) one concept card for the single top weak motif, behind a "Learn the pattern" toggle**, reusing `cardForThemes(weakMotifThemes, cards)` + `ConceptCard.svelte`. One card keeps the result focused (mirrors Dashboard's single "biggest opportunity"); more cards = scope creep / noise. |
| **Q-C** | Game review | (a) surface `EvalGraph` + top turning points, consume F4 for replay; (b) `EvalGraph` only; (c) none | **(a) `<EvalGraph analysis>` + top 2-3 `criticalMoments`; selecting one replays via F4 `SolutionReveal` with `explainPly` "why".** Only shown when a game was played (`profile.gameAnalyzed`). Consumes F4 (FOLD-4 of F4: same `why?` prop, no fork). |
| **Q-D** | Prioritization framing | (a) qualitative "start here" + honest rough framing, no Elo; (b) invented точный elo/% gain; (c) reuse `dashboard.biggestOpportunity` verbatim | **(a) a leverage-ranked "start here" line + an honest rough payoff phrase, NO invented number.** New `coachReview.startHere`; leverage = severity(`-delta` / `50-score`) × frequency(`n` / `sampleSize`), gated by sample size. Honesty (AP-CTEACH-3). |
| **Q-E** | i18n namespace | `coachReview.*` vs `narrative.*` vs reuse | **`coachReview.*`** for all new strings (cohesion with the coach surface), in `src/i18n/messages/generators.ts` (pure-core phrases) and/or `messages/coach.ts` (component labels). `dashboard.biggestOpportunity`/`motif.*`/`dim.*`/`severity.*`/`phase.*` are **reused** (already bilingual), never redefined. |
| **Q-F** | Where the narrative core lives | (a) `src/coach/narrative.ts` (new); (b) extend `program.ts`; (c) inline in Coach.svelte | **(a) new pure module `src/coach/narrative.ts`.** Keeps `program.ts` single-concern; mirrors its purity/`gt` pattern. Coach.svelte calls it once at `commit()` time. Never inline (purity + unit-testability). |
| **Q-G** | New ADR? | yes / no | **No.** Reuse under ADR-0040 (concepts) / ADR-0021 (EvalGraph + criticalMoments) / ADR-0045 (coach) / ADR-0052-0053 (i18n). If the narrative engine is later judged decision-worthy, allocate **≥0059** at build time (0054-0058 reserved); do not pre-spend. |
| **Q-H** | Where review state is held | (a) Coach component `$state<GameAnalysis|null>`; (b) persist on `CoachProfile`; (c) re-run analysis on result | **(a) component `$state` for the just-played game.** No persistence, no `DB_VERSION` bump (premise-refinement 2). Re-surfacing historical reviews is the Dashboard/Import path's job (§11). |

---

## §1 Baseline (empirical, `reports/coach-output-teaching_baseline.json`)

- **Tests**: **504 pass / 69 files** (file count re-confirmed `ls src/**/*.test.ts | wc -l` = 69). **svelte-check**: 383 files, **0 errors / 0 warnings**. **`DB_VERSION` = 4** (`grep` confirmed).
- **Behavior today**:
  - Coach result (`Coach.svelte:248-267`) → `<Radar>` + strengths/weaknesses bullet labels + program `<ol>`. **No prose / review / cards / leverage line.**
  - `finishGame()` (`Coach.svelte:159-175`) → runs full `runAnalysis(source:'played')`; keeps `.dimensions` only; **`GameAnalysis` discarded** (CO13).
  - Program is worst-first but never names the **top** priority or a payoff (CO9).
- **Reuse surfaces (all PURE / prop-driven, verified present)**:
  - `src/analysis/criticalMoments.ts` — `winCurve(analysis)`, `criticalMoments(analysis,{max=5,minLoss=10})`.
  - `src/ui/EvalGraph.svelte` — `{ analysis: GameAnalysis, selected?, onSelect? }`.
  - `src/analysis/explain.ts` — `explainPly(ply, locale) => {headline, reasons[], better}`.
  - `src/concepts/concepts.ts` — `cardForThemes(themes, cards)`, `loadConcepts(locale)`; `src/ui/ConceptCard.svelte` — `{ card, onClose? }`.
  - `src/coach/program.ts` — PURE worst-first template (the narrative core mirrors it); `src/i18n/gen.ts` `gt()` + `messages/generators.ts`.
  - **`src/ui/SolutionReveal.svelte`** — **F4 forward contract (not yet built)**; arbitrary-line replay via source-agnostic `why?`.
- **Byte-identity anchors** (must NOT drift): Insights study-plan snapshot (AP-COACH-1); `explain.test.ts` (EN+FR); `concepts.test.ts` / `concepts.seed.test.ts` / `concepts.fr-parity.test.ts`; `EvalGraph`/`winCurve`/`criticalMoments` output; the existing Coach radar + program markup.

---

## §2 Scope (single concern)

**One concern: make the Coach RESULT screen communicate + teach** — a directional narrative, a concept card for the top weakness, the surfaced game review, and an honest "start here" leverage line. These four are one cohesive output surface for the same `CoachProfile`; they ship together because they share the result-screen render and the same data source.

**IN**
1. **CO8** — new PURE `src/coach/narrative.ts`: `buildCoachNarrative(profile, locale) => string[]` (2-4 sentence directional summary) from `CoachProfile.motifs`/`dimensions`/`strengths`/`weaknesses` via `gt`.
2. **CO9** — leverage rank (PURE, in `narrative.ts`): `rankByLeverage(profile) => RankedFocus[]` (severity × frequency, sample-gated) → a "start here" line (`coachReview.startHere`) with an honest, **non-numeric** payoff framing.
3. **CO1** — concept card for the **top weak motif** behind a "Learn the pattern" toggle, reusing `loadConcepts(locale)` + `cardForThemes(weakMotifThemes, cards)` + `ConceptCard.svelte`.
4. **CO13** — hold the discarded `GameAnalysis` in Coach `$state`; render `<EvalGraph analysis>` + top 2-3 `criticalMoments`; selecting a turning point opens **F4 `SolutionReveal`** (`fen=ply.fenBefore`, `moves=[ply.bestUci]`, `why=explainPly(ply, locale)` headline+reasons). Shown only when `profile.gameAnalyzed`.
5. New bilingual strings (Q-E), all FR+EN, templated (no fragment concat).
6. Enrichments folded (`reports/..._improvements.md`): see §4 FOLD-tags and §11.

**OUT (explicit non-goals)**
- Any change to `buildStudyPlan`/Insights output (AP-COACH-1 byte-identity), `weaknessCounters`/SRS (F3), grades, the radar/program algorithms, `DB_VERSION`.
- Forking or reimplementing `SolutionReveal` / `EvalGraph` / `criticalMoments` / `explainPly` / `cardForThemes` (consume only — AP-CTEACH-1).
- Free runtime LLM narrative (AP-CTEACH-4).
- Re-surfacing **historical** game reviews on the result (only the just-played game) — Dashboard/Import own history → §11.
- Persisting the `GameAnalysis` on the profile / any new DB field.
- Trainer-side teaching (T1) and the closed-loop efficacy (C7).

---

## §3 Pre-flight (gates before Phase A)

- [ ] **F4 is shipped/merged** — `src/ui/SolutionReveal.svelte` exists with the props from F4 §A2 (`fen`, `moves`, `orientation`, `why?`, `autoplay?`, `stepMs?`, `onDone?`) and the source-agnostic `why?` contract (F4 FOLD-4). **If F4 is not merged → STOP (hard dep).**
- [ ] Baseline reproduces: `npx vitest run` = 504 pass; `npx svelte-check` = 0/0.
- [ ] Confirm `coachReview.*` keys absent, `AP-CTEACH-*` namespace empty (`reports/..._collision.json`).
- [ ] Re-confirm `src/coach/narrative.ts` does not exist; `EvalGraph`/`criticalMoments`/`explainPly`/`cardForThemes`/`ConceptCard` signatures unchanged from §1.
- [ ] Ratify §0.5 arbitrages (esp. Q-A templated/no-LLM, Q-C consume-F4, Q-D no-Elo honesty, Q-H component-state/no-DB-bump).

---

## §4 Phase A — CODE FIRST

> Order: pure cores (narrative + leverage) → i18n strings → Coach state (hold analysis) → result-screen render (narrative → start-here → review → card). Code lands before tests (§5) and docs (§7).

### A1 — Pure narrative + leverage core (`src/coach/narrative.ts`) — CO8 + CO9
New PURE module (no `Date`/`Math.random`/engine/store; locale injected), mirroring `program.ts`:

```ts
import type { CoachProfile, MotifScore } from './types';
import type { DimensionScore } from '../analysis/weakness';
import type { Locale } from '../i18n/translate';

/** A focus area ranked by leverage = severity × frequency, sample-gated. PURE. */
export interface RankedFocus {
  kind: 'motif' | 'dimension';
  key: string;            // motif theme or dimension id (stable routing key)
  label: string;          // localized display label (via motif.* / dim.*)
  severity: number;       // normalized 0..1 (motif: -delta capped; dim: (50-score) capped)
  frequency: number;      // normalized 0..1 (sample-size weight: n / sampleSize)
  leverage: number;       // severity * frequency
}

/** Rank weak motifs + weak dimensions by leverage, worst-first. Empty when nothing is weak. */
export function rankByLeverage(profile: CoachProfile): RankedFocus[];

/** A 2-4 sentence DIRECTIONAL narrative in `locale`, derived from the profile.
 *  Names 1-2 strengths, 1-2 weaknesses, and the top leverage focus ("start here").
 *  Honest: no grade, no invented numbers; degrades gracefully on thin data. */
export function buildCoachNarrative(profile: CoachProfile, locale: Locale): string[];
```

- **Leverage heuristic (CO9, honest)**: reuse `program.ts` thresholds — a motif is weak at `delta <= -40`; a dimension at `score <= 35` with `sampleSize > 0`. `severity` = `min(1, -delta / 200)` (motif) or `min(1, (50 - score) / 50)` (dim); `frequency` = sample-size confidence `min(1, n / 6)` (motif `n`) or `min(1, sampleSize / 6)` (dim). `leverage = severity * frequency`. Sort desc; tie-break by stable key for determinism. **No Elo / % gain is computed or asserted** (AP-CTEACH-3).
- **Narrative assembly (CO8)**: each sentence is a **complete per-locale template** from `generators.ts` (`gt`), never concatenated fragments (AP-CTEACH-5). Strengths/weaknesses use the existing `motif.*` / `dim.*` labels. The "start here" sentence names `rankByLeverage(profile)[0].label` and a qualitative payoff (`coachReview.payoffSoft`). **FOLD-A8 (honest framing)**: when `profile.source.game` is false or all dims are unmeasured, the narrative states the read is from puzzles only and is directional (reuse the `coach.directional` tone), never implying a full-game grade.
- **FOLD-A4 (robustness)**: `rankByLeverage` returns `[]` and `buildCoachNarrative` returns a single honest "no clear weakness — keep sharp" line (mirror `program.maintenance`) when nothing crosses threshold; never throws on empty `motifs`/`dimensions`.

### A2 — i18n strings (Q-E) — FR+EN, templated
Add to `src/i18n/messages/generators.ts` (pure-core phrases resolved by `gt`), **FR+EN each** (collision-guarded by `translate.test.ts`):
- `coachReview.narrStrength` — e.g. FR "Vous êtes solide sur {areas}." / EN "You're solid on {areas}."
- `coachReview.narrWeak` — FR "{areas} demandent du travail." / EN "{areas} need work."
- `coachReview.startHere` — FR "Commencez par {focus} — c'est là que le travail rapportera le plus." / EN "Start with {focus} — that's where the work will pay off most."
- `coachReview.payoffSoft` — an honest, non-numeric payoff cue folded into/after `startHere` (no number). **FOLD-A8**.
- `coachReview.narrNoWeak` — FR "Aucune faiblesse nette — gardez vos automatismes affûtés." / EN "No clear weakness — keep your patterns sharp."
- `coachReview.narrPuzzleOnly` — directional caveat when no game was played.
- `coachReview.listJoin` — locale-correct list join ("{a} et {b}" / "{a} and {b}") so `{areas}` never glues raw labels (AP-CTEACH-5).

Add to `src/i18n/messages/coach.ts` (component labels):
- `coachReview.heading` (e.g. "Votre bilan" / "Your read"), `coachReview.gameReviewTitle`, `coachReview.turningPoints`, `coachReview.learnPattern` (toggle), `coachReview.replayWhy` (label above the replayed "why").
Reuse `dashboard.biggestOpportunity` tone if desired; **reuse** `motif.*`, `dim.*`, `severity.*`, `phase.*`, `evalGraph.*`, `calc.solution` (F4) — never redefine.

### A3 — Hold the discarded `GameAnalysis` (Q-H) — CO13 plumbing
In `Coach.svelte`:
- Add `let gameAnalysis = $state<GameAnalysis | null>(null);` (import the type from `../analysis/types`).
- In `finishGame()` (line ~164), keep the existing `runAnalysis` call but **also retain `analysis`**: set `gameAnalysis = analysis;` alongside the existing `gameDimensions = buildWeaknessProfile([analysis], …).dimensions;`. **No other change** to `finishGame`/`commit` flow (still feeds dimensions into `buildCoachProfile`; still no persistence of the analysis). On the `catch` path, leave `gameAnalysis = null`.

### A4 — Narrative + "start here" on the result (CO8 + CO9 render)
In the `step === 'result'` block (after the radar, before/with the strengths-weaknesses row):
- Compute once: `const narrative = buildCoachNarrative(profile, getLocale());` and `const ranked = rankByLeverage(profile);`.
- Render `<h4>{t('coachReview.heading')}</h4>` + each `narrative` sentence as a `<p>`.
- When `ranked.length`, render the **"start here"** line referencing `ranked[0].label`, styled like the existing `dashboard.biggestOpportunity` feedback line. (Re-localizes on language switch via the existing `getLocale()` reactivity pattern.)

### A5 — Concept card for the top weak motif (CO1)
- Derive the top **motif** focus: `ranked.find(r => r.kind === 'motif')?.key` (or directly the worst weak motif). Map to themes for `cardForThemes` (the motif theme key is already a family/sub-tag the alias table resolves).
- Mirror Tactics' pattern: `loadConcepts(getLocale()).then(c => topCard = cardForThemes([topMotifKey], c));` (re-load on locale change).
- Behind a **"Learn the pattern"** toggle (`coachReview.learnPattern`), render `<ConceptCard card={topCard} onClose={…} />` when a card resolves. **No card → no toggle** (honest; `cardForThemes` already returns `null` for no-card themes). Reuses ADR-0040 content; no new card content.

### A6 — Game review (EvalGraph + turning points + replay) (CO13 render) — consumes F4
In the result block, **only when `profile.gameAnalyzed && gameAnalysis`**:
- `<h4>{t('coachReview.gameReviewTitle')}</h4>` + `<EvalGraph analysis={gameAnalysis} selected={selectedPly} onSelect={(i) => selectedPly = i} />`.
- Below it, `<h5>{t('coachReview.turningPoints')}</h5>` + a list of `criticalMoments(gameAnalysis, { max: 3 })`, each a button labelled from the moment (`move`, `san`, `winProbLoss`, `side`) — selecting sets `selectedPly`.
- When `selectedPly != null`, mount **F4 `SolutionReveal`** for that ply:
  - `const ply = gameAnalysis.plies[selectedPly];`
  - `<SolutionReveal fen={ply.fenBefore} moves={ply.bestUci ? [ply.bestUci] : []} orientation={coachSide === 'w' ? 'white' : 'black'} why={explainLine(ply, getLocale())} autoplay />`
  - `explainLine` = a thin local adapter turning `explainPly(ply, locale)` (`{headline, reasons[]}`) into a single string the `why?` prop accepts (FOLD-A5: same prop, **no fork** of `SolutionReveal`; FOLD-4 of F4).
- **FOLD-A3 (render fidelity)**: a player-side blunder and an opponent-side swing are visually/textually distinguished in the turning-points list (reuse EvalGraph's `side` semantics: filled = player, hollow = opponent) so the user isn't told they blundered when the opponent did.
- **FOLD-A4 (robustness)**: `criticalMoments` may return `[]` (a clean game) → show a short "no big swings" note (`coachReview.noSwings`), not an empty heading; `ply.bestUci` may be `null` → pass `moves=[]` (F4 FOLD-3 tolerates empty/short lines).

### A7 — No persistence / no DB change
- `gameAnalysis` and `selectedPly` are transient `$state`. `commit()` is unchanged (no new field on `CoachProfile`, no `DB_VERSION` touch). The review is for the just-played game only (Q-H).

---

## §5 Tests (after code)

- **Unit (pure, new)** `src/coach/narrative.test.ts`:
  - `rankByLeverage`: orders a high-`-delta`/high-`n` motif above a marginal one; a weak dim with `sampleSize 0` is excluded; returns `[]` when nothing crosses threshold; deterministic order on ties.
  - `buildCoachNarrative`: returns a non-empty FR **and** EN array for a profile with a clear weakness; FR ≠ EN for the same input (parity sanity); the "start here" sentence names the top-leverage label; **no digit-bearing payoff** is emitted (regex assert no Elo/% — AP-CTEACH-3); on an all-strong / empty profile returns the single honest "no clear weakness" line (AP-CTEACH-2); a puzzle-only profile (`source.game=false`) emits the directional caveat (FOLD-A8).
  - List join uses the localized `coachReview.listJoin`, never a raw `, ` glue (AP-CTEACH-5).
- **i18n parity**: `translate.test.ts` collision/parity guard green for every new `coachReview.*` key (FR+EN present).
- **Regression / byte-identity** (reuse-only, must stay green & unchanged):
  - `explain.test.ts`, `concepts.test.ts`, `concepts.seed.test.ts`, `concepts.fr-parity.test.ts`, the Insights study-plan snapshot (AP-COACH-1), and any `criticalMoments`/`winCurve`/EvalGraph tests.
- **Component**: per portfolio §8 there is **no Svelte component-test harness** (zero `*.svelte.test.ts`; 504 tests are pure/logic). The result-screen wiring (A3-A6) is verified by **pure-core unit tests + static wiring-presence + manual/preview** (§6), **not** component tests. Add a static-presence check only if a cheap grep-style assertion fits the existing test style; otherwise rely on manual.

---

## §6 Verification

- [ ] `npx vitest run` → **≥ 504 pass** (new pure tests add; **0 prior regressions**).
- [ ] `npx svelte-check --tsconfig ./tsconfig.json` → **0 errors / 0 warnings** (matches baseline).
- [ ] `npm run build` green.
- [ ] **i18n parity**: every new `coachReview.*` key has FR+EN; `translate.test.ts` green.
- [ ] **Byte-identity**: Insights study-plan snapshot unchanged (AP-COACH-1); `explainPly` EN+FR pins unchanged; `EvalGraph`/`winCurve`/`criticalMoments`/`concepts` outputs unchanged.
- [ ] **No `DB_VERSION` change**; no new persisted field; `commit()`/`CoachProfile` shape unchanged.
- [ ] **Manual** (`npm run dev`, with F4 merged): run the coach assessment **with** a game →
  - result shows a directional **narrative** (FR and EN) that names strengths, weaknesses, and a **"start here"** focus, with **no invented number**;
  - a **"Learn the pattern"** toggle shows the `ConceptCard` for the top weak motif (and is **absent** when no card resolves);
  - the **game review** shows `<EvalGraph>` + top turning points; selecting one **replays** the line via `SolutionReveal` with an `explainPly` "why"; player vs opponent swings are distinguished;
  - run the assessment **without** a game → no game-review section, narrative carries the **directional/puzzle-only** caveat, no crash.
- [ ] **Honesty read**: the narrative reads as directional guidance, never a grade or precise prediction (AP-CTEACH-2/3).

---

## §7 Docs (LAST)

- `decisions.md`: append-only. C6 takes **no new ADR** (reuse under ADR-0040/0021/0045/0052/0053). Add a short decisions note: C6 surfaces the previously-discarded `GameAnalysis` (EvalGraph + turning points), adds a pure templated narrative + leverage "start here" (no LLM, no invented Elo), and reuses `ConceptCard`/`cardForThemes` + F4 `SolutionReveal` (no fork). If the narrative engine is later judged decision-worthy, allocate **≥0059** (0054-0058 reserved) — *do not pre-spend*.
- Update `specs/enhancements-architecture-spec.md` C6 row status → shipped (narrative + concept card + game review + leverage prioritization) — *doc-only, after code/merge*.
- No README/user-doc churn (additive UI; covered by in-app bilingual strings).

---

## §8 Acceptance

1. `src/coach/narrative.ts` exists, PURE (no `Date`/`Math.random`/engine/store), locale-injected; `buildCoachNarrative` + `rankByLeverage` unit-tested FR+EN with honesty asserts.
2. The Coach result shows a **directional narrative** (CO8) and an honest **"start here"** leverage line (CO9) — **no grade, no invented number**.
3. The Coach result shows a **concept card** for the top weak motif behind a toggle (CO1), reusing `cardForThemes` + `ConceptCard`; absent when no card resolves.
4. The previously-discarded `GameAnalysis` is surfaced (CO13): `<EvalGraph>` + top 2-3 `criticalMoments`, with per-ply **replay via F4 `SolutionReveal`** and an `explainPly` "why" (no fork); shown only when a game was played; player vs opponent swings distinguished.
5. 504+ tests green; svelte-check 0/0; build green; i18n parity green; **Insights / `explainPly` / `EvalGraph` / `concepts` byte-identical**; **no `DB_VERSION` bump**.

---

## §9 Anti-patterns (AP-CTEACH-)

- **AP-CTEACH-1** — *Reimplementing a surface that exists.* `EvalGraph`, `criticalMoments`, `explainPly`, `cardForThemes`, `ConceptCard`, and F4's `SolutionReveal` are **consumed**, never re-written or forked. (Mirrors F4 AP-TEACH-1 and FOLD-4.)
- **AP-CTEACH-2** — *Over-claiming in the narrative.* The summary is **directional**, never a grade or a verdict. On thin/puzzle-only data it says so. No sentence implies a measured full-game grade. (Mirrors `coach.directional` honesty / AP-CHESS-13/24.)
- **AP-CTEACH-3** — *Inventing a payoff number.* CO9 names **which** fix matters most and a **qualitative** payoff cue only. **No Elo gain, no % improvement, no "+150 rating"** is computed or shown — there is no validated model for it. Tests assert the narrative carries no fabricated digit-payoff.
- **AP-CTEACH-4** — *Runtime LLM / free-text narrative.* The narrative is **templated catalogue phrases** (`gt` over `generators`), pure and offline. No LLM call, no non-deterministic text (purity + FR/EN parity + byte-stable tests).
- **AP-CTEACH-5** — *Concatenating bilingual fragments.* Every sentence is a complete per-locale template; lists join via `coachReview.listJoin`. Never glue translated pieces or raw labels with `", "`. (ADR-0052/0053.)
- **AP-CTEACH-6** — *Persisting the review / bumping `DB_VERSION`.* The `GameAnalysis` is held in component `$state` for the just-played game only. No new persisted field, no migration. Historical review re-surfacing is out of scope (§11).
- **AP-CTEACH-7** — *Touching Insights / selection.* `buildStudyPlan`, `weaknessCounters`, SRS, grades, and the radar/program algorithms are untouched. Insights output stays byte-identical (AP-COACH-1).
- **AP-CTEACH-8** — *Scope creep into T1/C7.* No trainer-side teaching, no closed-loop efficacy, no cards-for-every-weakness, no historical-game review — those are other PRs.
- **AP-CTEACH-9** — *Misattributing a swing.* A turning point caused by the **opponent** must not be framed as the player's blunder; reuse EvalGraph's `side` (player/opponent) in the turning-points list and the replay "why".

---

## §10 Rollback

- Pure-additive: a new pure module + new bilingual keys + additive result-screen render + one retained-in-state value. Rollback = revert the PR commit.
- Partial rollback is safe and independent: drop A6 (game review) and keep A1/A4/A5 (narrative + card) — the narrative is profile-only; or drop A5 (card) and keep the rest. A3 (retaining `analysis`) is inert without A6.
- No data/migration to unwind (no `DB_VERSION` change, no persisted field).

---

## §11 Follow-up (explicitly downstream, not C6)

- **C7** (Program v2): time-budget toggle, mastery-based steps, **closed-loop efficacy** (did showing the review/card help?), opening→repertoire routing — the narrative may later cite efficacy once C7/F3 telemetry exists.
- **Historical game review on the result/Dashboard**: re-surfacing reviews for *past* games (not just the just-played one) needs the games store reads (F5) and a selection UI → Dashboard/Insights path, **DEFER** (G-scope).
- **Reveal/card usage telemetry** (does teaching change outcomes?) — DEFER (no telemetry layer in C6 scope; mirrors F4 T3 deferral).
- **Richer narrative** (multi-paragraph, opening-name-aware, trend vs `coachProfilePrev`) — the prev-profile trend belongs to **C1**; C6 keeps the narrative to the current profile (single concern).
- **T1** (Trainer feedback core) already builds on F4 `SolutionReveal` independently; C6 shares the component, not the wiring.
