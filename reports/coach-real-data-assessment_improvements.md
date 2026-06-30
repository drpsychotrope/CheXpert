# Enrichments — coach-real-data-assessment (C4)

**`/enrich` 3 cycles** (sweep → prune → conditional) · 8-axis · verdict per finding: **FOLD** (into V1) / **DEFER** (good, wrong PR) / **REJECT** (violates scope/causality).
**ANTI-FABRICATION**: empty axes are reported CLEAN; the FOLD set is the *minimum* that earns its place — not grown to hit a count.

Axes: 1 capability-gap · 2 observability · 3 render-fidelity · 4 robustness · 5 reuse · 6 extensibility · 7 symmetry · 8 honest-framing.

---

## FOLD set (6) — folded into the V1 spec

| ID | Axis | One-line | Where |
|---|---|---|---|
| **FOLD-C1** | 8 honest-framing | Provenance line must say **which** data fed the profile + the count: "based on N recent games (M played, K imported)" — extend the existing `coach.source*` line, not a grade. | §2.5, §4, §5 |
| **FOLD-C2** | 4 robustness | **Empty/thin-history fallback**: if windowed analyses < a floor, fall back to the existing toy-game/ladders path (current behaviour is the floor) — never show an all-"not measured" radar as if assessed. | §2.6, §4, §5, §9 |
| **FOLD-C3** | 1 capability-gap | **Window helper is a PURE function** `recentAnalyses(analyses, n, now?)` (sort by `analyzedAt` desc, take N) — unit-testable, no `Date.now()` in the core; the UI passes the list. | §4 (CODE FIRST), §5 |
| **FOLD-C4** | 2 observability | Surface **per-source counts** so the user sees the blend is real (M played + K imported), derived purely from `GameAnalysis.source`. Reuses FOLD-C1's line. | §2.5, §4 |
| **FOLD-C5** | 7 symmetry | The **offer-game step** becomes an offer of *data source*: (a) use my recent games, (b) play a quick game (existing), (c) import more (existing Import flow). Keeps the toy game as one option, not the only one — symmetric with the new history path. | §2.3, §4 |
| **FOLD-C6** | 8 honest-framing | **`CoachProfile.source.game` semantics**: today it means "a game was analyzed". With history-blend it must stay truthful — set `game:true` when ANY real-game dimensions fed the profile (history or toy), and the provenance line distinguishes *history* vs *single game* in text. No schema change (the boolean already exists). | §2.7, §7, §9 |

---

## DEFER set (4) — good ideas, not this PR

| ID | Axis | One-line | Defer to |
|---|---|---|---|
| **DEF-C1** | 6 extensibility | **User-tunable window N** (slider 5/10/20) + per-source filter toggles. | C5 (intake) or a coach-settings follow-up; V1 ships a fixed N=10. |
| **DEF-C2** | 1 capability-gap | **Opening-specific diagnosis** from the blended history (which openings leak most) → repertoire line. | **C7** (opening→repertoire routing, CO17) — distinct concern. |
| **DEF-C3** | 3 render-fidelity | **Game-review surfacing** (EvalGraph) for the games that fed the profile. | **C6** (output & teaching, CO13) — explicitly that PR's scope. |
| **DEF-C4** | 6 extensibility | **Bulk multi-game `.pgn` upload** to seed history fast for assessment. | F5 §11 (bulk import, already deferred there). C4 consumes whatever import produces. |

---

## REJECT set (2) — out of scope / violate doctrine

| ID | Axis | One-line | Why rejected |
|---|---|---|---|
| **REJ-C1** | 5 reuse | Add a **coach-local history-aggregation** that pre-folds dimensions before `buildWeaknessProfile`. | Violates **AP-COACH-1** (fork) and is redundant — `buildWeaknessProfile` already aggregates an N-game array. Window the array, call the shared core. |
| **REJ-C2** | 1 capability-gap | Seed the **blended weakness signal into the puzzle rating / coach rating pool** so assessment "counts". | Violates **AP-COACH-8** (no diagnostic→pool leak) and the deferred-coach-pool decision (coach §11). C4 reads analyses; it must not write pools. |

---

## Clean axes (anti-fabrication — reported, not padded)
- **Axis 3 render-fidelity** beyond DEF-C3: the existing **Radar** already renders `DimensionScore[]` with "not measured" handling; C4 needs **no** new viz. CLEAN.
- **Axis 5 reuse** beyond REJ-C1: `loadAllAnalyses` is cached and already reused by Dashboard/Insights/Comeback/Session — C4 is one more consumer, no new infra. CLEAN.
- **i18n parity**: covered by the existing structural test; new `coach.*` keys pass by construction (FR+EN). No new test harness. CLEAN.

## Cycle log (diminishing returns)
- **Cycle 1 (sweep)**: 12 raw candidates across 8 axes.
- **Cycle 2 (prune)**: collapsed 4 into FOLD-C1/C4 (same provenance line), moved 4 to DEFER (belong to C5/C6/C7/F5), rejected 2 on AP grounds.
- **Cycle 3 (conditional)**: only FOLD-C6 (source.game semantics) was net-new; everything else firmed. Delta small → **STOP**. Final FOLD set = **6**.
