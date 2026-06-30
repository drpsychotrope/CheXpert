# Arbitrages: coach-output-teaching (C6)

## Critical structural defects (cycle 1 stops)
**None.** Pre-V0 scan verdict PROCEED. Every reuse hook verified present except `SolutionReveal.svelte` (F4 forward contract), which is correctly a **hard dependency** (Pre-flight §3 gate: STOP if F4 not merged), not a defect of C6's premise. Four premise *refinements* (not stops) folded into §0.5 / §0.

## Refiner cycles (4) — diminishing returns noted

| Cycle | Focus | Findings | Outcome |
|---|---|---|---|
| 1 | Premise validation | (a) "turning points the coach computes then discards" is imprecise — `GameAnalysis` has no `criticalMoments`/`winCurve` FIELD; they're pure selectors over `plies`. (b) The discarded `analysis` is not on `CoachProfile`. (c) `explainPly` needs a real `PlyAnalysis` — Coach has one. (d) `SolutionReveal` doesn't exist (F4 unbuilt). | All 4 → premise refinements in §0/§0.5; (d) → hard-dep gate. No stop. |
| 2 | Integration consistency + cross-axis | Narrative purity path must mirror `program.ts` (pure, `gt`, Locale) → Q-A/Q-F locked. Review state must be component `$state`, not persisted → Q-H locked + AP-CTEACH-6. CO9 must not invent Elo → Q-D locked + AP-CTEACH-3. i18n namespace cohesion → Q-E `coachReview.*`. | 5 arbitrages crystallized (Q-A,D,E,F,H); anti-patterns AP-CTEACH-3/4/6 added. |
| 3 | Measurability + reproducibility | Leverage heuristic needed concrete thresholds → reuse `program.ts` `delta<=-40`/`score<=35`, `severity`/`frequency`/`leverage` formulas spelled in §4 A1. Honesty test made concrete (regex: no digit-payoff). Component-test absence (portfolio §8) → §5 verifies via pure unit + manual, not component tests. | 3 polish patches applied; Q-B (one card) + Q-C (consume F4) confirmed. |
| 4 | Final pass | Only wording nits (e.g. "start here" phrasing, list-join key naming). **Delta < 10% vs cycle 3 → diminishing returns; STOP.** | 1 nit (added `coachReview.listJoin` to forbid raw glue, AP-CTEACH-5). Stop. |

**Diminishing returns**: cycle 4 surfaced 1 nit vs cycle 3's 3 patches vs cycle 2's 5 arbitrages — clear decay. Stopped at 4 as instructed; cycle 4 was already low-yield.

## Decisions requested from user (defaults APPLIED — spec is written against them)

### Q-A — Narrative implementation
**Options**: (a) templated catalogue phrases (pure, bilingual); (b) free runtime LLM text; (c) hybrid.
**Recommendation / APPLIED**: **(a)**. New pure `src/coach/narrative.ts` assembling sentences via `gt(generators, …, locale)`, mirroring `program.ts`. **No runtime LLM** — preserves purity, FR/EN parity, offline-first, and byte-stable tests. (b) violates pure-core doctrine + parity + determinism.

### Q-B — Teach surface depth
**Options**: (a) one concept card for the top weak motif behind a toggle; (b) cards for all weak motifs; (c) none.
**Recommendation / APPLIED**: **(a)**. Reuse `cardForThemes(topMotifThemes, cards)` + `ConceptCard.svelte`. One card keeps the result focused (mirrors Dashboard's single "biggest opportunity"); (b) is noise/scope-creep.

### Q-C — Game review
**Options**: (a) `EvalGraph` + top turning points + replay via F4; (b) `EvalGraph` only; (c) none.
**Recommendation / APPLIED**: **(a)**. `<EvalGraph analysis>` + top 2-3 `criticalMoments`; selecting a turning point replays via F4 `SolutionReveal` with `explainPly` "why". Consumes F4's source-agnostic `why?` (FOLD-4) — no fork. Shown only when a game was played.

### Q-D — Prioritization framing (CO9)
**Options**: (a) qualitative "start here" + honest rough framing, no Elo; (b) invented precise elo/% gain; (c) reuse `dashboard.biggestOpportunity` verbatim.
**Recommendation / APPLIED**: **(a)**. Leverage rank (severity × frequency, sample-gated) names the single "start here"; payoff is a qualitative cue. **No invented number** (AP-CTEACH-3). (b) is dishonest (no validated model); (c) too thin for the coach surface but its tone is reused.

### Q-E — i18n namespace
**APPLIED**: **`coachReview.*`** for all new strings; `dashboard.biggestOpportunity`/`motif.*`/`dim.*`/`severity.*`/`phase.*`/`evalGraph.*`/`calc.solution` **reused**, never redefined.

### Q-F — Narrative core home
**APPLIED**: **(a)** new pure module `src/coach/narrative.ts` (keeps `program.ts` single-concern; mirrors its pattern). Never inline in the component.

### Q-G — New ADR?
**APPLIED**: **No.** Reuse under ADR-0040/0021/0045/0052/0053. If ever warranted, allocate **≥0059** (0054-0058 reserved per portfolio) — do not pre-spend.

### Q-H — Review state location
**APPLIED**: **(a)** Coach component `$state<GameAnalysis|null>` for the just-played game. No persistence, **no `DB_VERSION` bump** (AP-CTEACH-6). Historical review re-surfacing → §11 (DEFER, needs F5).

## Auto-applied patches (no user input needed)
- Leverage thresholds reuse `program.ts` constants (`delta<=-40`, `score<=35`) for cross-surface consistency.
- `explainLine` adapter (ply → single `why` string) noted as a thin local helper, **not** a `SolutionReveal` fork (FOLD-4 of F4).
- Robustness: empty `criticalMoments` / `null bestUci` / empty `motifs` handled (no throw); `coachReview.noSwings` + `moves=[]` (F4 FOLD-3).
- `coachReview.listJoin` added to prevent raw label gluing (AP-CTEACH-5).
- Honesty regex test (no digit-payoff) added to §5.

## Stop status
- Cycles run: **4/4** (as instructed).
- Stop reason: **all cycles run; cycle 4 hit decreasing returns** (1 nit, <10% of cycle-3 yield).
- Final spec: `specs/coach-output-teaching-spec.md` (V1 — arbitrage defaults applied).

## Next steps
1. Read the arbitrages above (all defaults already applied to the spec).
2. Reply to override any default (e.g. "Q-B: b").
3. Then `/enrich` ran (see `reports/coach-output-teaching_improvements.md`) — ratify its FOLD set.
4. **Build gate: F4 must be merged first** (hard dependency). Then build Phase A→Z.
