# Spec — Coach mode (personalized coaching)

**PR**: `coach-mode` · **Scope**: feature · **ADR**: ADR-0045 · **Spec version**: V1 (post cycle-2)
**Drafted**: 2026-06-04 · **Pre-V0 scan**: PASS (`reports/coach-mode_*.json`)

---

## §0 Context

The app already computes a 5-dimension strength/weakness radar (`analysis/weakness.ts`), ranked
leaks (`analysis/fingerprint.ts`), a deterministic study plan (`analysis/studyPlan.ts`), and an
executable session (`analysis/session.ts` + `ui/Session.svelte`) — **but all of it is driven by
analysed *played* games**. A new or returning player with little game history gets a blank profile.

The launch-time skill evaluation (`calibration/Calibration.ts`) already owns the opposite property:
an **active, adaptive probe** (Glicko-2 `PuzzleLadder` + an optional ACPL calibration game) that
needs no history — but it outputs only two scalar ratings (puzzle, game), not a strength/weakness
breakdown.

**Coach mode** joins the two: it reuses the calibration *method* — run the adaptive `PuzzleLadder`
**once per tactical motif** plus an endgame probe, and replay the optional calibration game through
the existing `BatchAnalyzer` — to build a multi-dimensional **CoachProfile** directly, then turns
that profile into a prioritized **program of drills and game modes** via the *existing*
`buildSession` runner. Net-new feature; no symbol is already at this end state (baseline PASS).

## §0.5 Arbitrages flagged

Surfaced by the pre-V0 scan; see `reports/coach-mode_arbitrages.md` for the user-facing bundle.
**RESOLVED 2026-06-04 — user accepted all defaults: Q-A=a, Q-B=a, Q-C=a, Q-D=a.** The spec body
below already reflects these; no open decisions remain.

- **Q-A — diagnostic game persistence.** Run the Stage-2 game through `runAnalysis(source:'played')`
  (persists a `gameAnalyses` row, generates personal puzzles, folds `weaknessCounters`) **[default a]**
  vs ephemeral `analyzeGame` only. (a) makes the coach game feed the existing loop and seeds
  downstream Comeback/Sparring/Play-steer; (b) avoids history "pollution".
- **Q-B — game-mode seeding depth.** Add `app.sparringScenarioId` + `app.steerDimension` signals so a
  program step auto-seeds the *exact* scenario/dimension **[default a]** vs minimal (step only lands
  the user on the mode's picker, no new signals).
- **Q-C — resilience→Comeback fallback.** `Comeback` needs ≥1 "behind" episode in history; a fresh
  coach run has none. Fall back to a resilience-style **Sparring** imbalance when no comeback
  positions exist **[default a]** vs show "play more games first".
- **Q-D — per-motif ladder length.** `COACH_LADDER_MIN/MAX = 3/5` (≈7 probes × ~4 = ~28 puzzles,
  ~6–9 min) **[default a]** vs `2/3` (faster, noisier).

## §1 Empirical baseline

Captured 2026-06-04 (`reports/coach-mode_baseline.json`, `_target_exists.json`). Anchors, not estimates:

| Reused symbol | Location | Shape relied on |
|---|---|---|
| `PuzzleLadder` | `calibration/Calibration.ts:49` | `next(now)/report(solved)/isDone()`, ctor `(repo, priorRating)` |
| `PuzzleRepo.next` | `trainer/PuzzleRepo.ts:95` | honors `{rating,window,themes,phase,exclude,source}` |
| `analyzeGame` | `analysis/BatchAnalyzer.ts:58` | `(gameId, ParsedGame, evaluator, {playerColor,source:'played'}) → GameAnalysis` |
| `runAnalysis` | `analysis/runAnalysis.ts:39` | `(engine, repo, {pgn,playerColor,source:'played',baseRating,now}) → {analysis,puzzles}` |
| `buildWeaknessProfile` | `analysis/weakness.ts:176` | `(analyses, playerRating) → {dimensions: DimensionScore[], weakest}` |
| `buildSession` | `analysis/session.ts:41` | `(PlanItem[], opts) → SessionPlan`; passes `kind: item.activity` through |
| `Radar.svelte` | `ui/Radar.svelte:9` | `Props { dimensions: DimensionScore[]; size }` |
| `Session.svelte` | `ui/Session.svelte:50,45` | onMount RESUMES if `app.activeSession` set; `TRAINER_VIEW` + `launch()` |
| `ChessGame.pgn()` | `game/ChessGame.ts:96` | feeds `parsePgn` → `runAnalysis` |
| additive-field precedent | `db.ts:30/61/63` | `conceptSeen?/visionStats?` — optional field, `?? default`, **no `DB_VERSION` bump** |

Radar dims: `tactics · openingAccuracy · endgameConversion · timeManagement · resilience`.
Geometric motifs probed (match `motif.ts` high-confidence set): `fork · pin · skewer · hangingPiece · discoveredAttack · mate`.
Test baseline: 376 passing, `svelte-check` 0 errors, build green (README).

## §2 Scope

**In:**
1. `src/coach/types.ts` — `CoachProfile`, `MotifScore`, `ThemeProbeResult`.
2. `src/coach/diagnostic.ts` — pure `buildCoachProfile(...)` + probe constants (`COACH_MOTIF_PROBES`, `COACH_LADDER_MIN/MAX`).
3. `src/coach/program.ts` — pure `buildCoachProgram(profile, minutes) → PlanItem[]` (drills + game modes), incl. `profileToLeaks` synthesis.
4. `src/ui/Coach.svelte` — the wizard (`intro → ladders → offer-game → game → analysing → result`).
5. Additive widening: `PlanItem.activity` + `SessionStepKind` `+= 'sparring' | 'play-steered'`; `View += 'coach'`; `PlayerModel.coachProfile? + coachProfilePrev?`.
6. Additive signals + reads: `app.sparringScenarioId`, `app.steerDimension`; consumed by `Session.svelte.launch()`, `Sparring.svelte`, `Play.svelte`.
7. Entry points: `Home.svelte`, `Insights.svelte`, `Settings.svelte`.
8. Tests for the two pure cores. Docs: ADR-0045 + README line.

**Deferred (§11):** multi-day scheduling; a separate coach rating pool; Chess960 as a program target; low-confidence/phase-fallback motifs in the probe set.

## §3 Pre-flight gates (re-verify at exec time)

- [ ] `git status` clean on a fresh `coach-mode` branch off `main`.
- [ ] `src/coach/` still absent; no parallel coach PR opened since 2026-06-04 (`gh pr list` / `git log`).
- [ ] `npm test` green **before** any edit (lock the 376 baseline).
- [ ] `PlanItem.activity` (studyPlan.ts:10) and `SessionStepKind` (session.ts:10) unions still as captured.
- [ ] `DB_VERSION === 4` (db.ts:109) and unchanged — confirms additive-no-bump still valid.
- [ ] **Theme-vocabulary gate (cycle-1 patch):** confirm each `COACH_MOTIF_PROBES` key returns ≥1 puzzle from the loaded `PuzzleRepo` (the keys must exist in `puzzle.themes`, the Lichess vocabulary that `weakness.ts:TACTICS_THEMES` already assumes — `fork·pin·skewer·hangingPiece·discoveredAttack·mate`). Inspect `public/puzzles/seed-puzzles.json` / the ETL `scripts/build-puzzle-subset.mjs`. Any key with 0 puzzles is dropped from the probe set at runtime (see A2/A7), never silently scored as a weakness.
- [ ] **Exhaustiveness gate (cycle-2 patch):** grep for any `switch`/`never` check keyed on `PlanItem['activity']` or `SessionStepKind` (`grep -rn "satisfies never\|: never" src/analysis src/ui`). Widening the unions must not turn an existing exhaustive switch non-exhaustive (would fail `svelte-check`). Current code uses non-exhaustive `Record` maps (`Session.svelte:TRAINER_VIEW`, `studyPlan.activityForLeak`) → safe, but re-verify at exec time.

## §4 Phase A — code change (ordered; CODE FIRST)

**A1 · `src/coach/types.ts`**
```ts
import type { DimensionScore } from '../analysis/weakness';

export interface MotifScore {
  theme: string;     // motif key or 'endgame'
  rating: number;    // Glicko rating from the themed ladder
  baseline: number;  // puzzleRating at probe time
  delta: number;     // rating - baseline (>0 strength, <0 weakness)
  n: number;         // puzzles attempted (sample size — honesty)
}
export interface ThemeProbeResult { theme: string; rating: number; n: number; }
export interface CoachProfile {
  assessedAt: number;            // UI-stamped at the Date.now boundary
  puzzleRating: number;          // baseline for motif deltas
  motifs: MotifScore[];
  dimensions: DimensionScore[];  // 5-dim radar (game-derived when present)
  strengths: string[];
  weaknesses: string[];          // program targets these, worst-first
  source: { ladders: boolean; game: boolean };
  gameAnalyzed: boolean;
}
```

**A2 · `src/coach/diagnostic.ts`** (pure; no Date, no engine)
- `export const COACH_MOTIF_PROBES = ['fork','pin','skewer','hangingPiece','discoveredAttack','mate'] as const;`
- `export const COACH_LADDER_MIN = 3; export const COACH_LADDER_MAX = 5;` (Q-D).
- `export function buildCoachProfile(args: { puzzleRating: number; probes: ThemeProbeResult[]; gameDimensions: DimensionScore[] | null; assessedAt: number }): CoachProfile` — the UI computes `gameDimensions = gameAnalysis ? buildWeaknessProfile([gameAnalysis], puzzleRating).dimensions : null` and injects it, keeping this core pure of the analysis dependency and trivially unit-testable (no `GameAnalysis` fixture).
  - **n=0 guard (cycle-1 patch):** first `const scored = probes.filter(p => p.n > 0)`. A probe with no attempts (its theme had no in-band puzzle) is excluded from `motifs`, deltas, ranking, and the tactics aggregate — never scored as a weakness. If `scored.length === 0` and no game, return a profile with empty `motifs`/`weaknesses` and `source.ladders=false` (UI shows "not enough puzzle data").
  - `motifs` = `scored.map(p => ({ theme:p.theme, rating:p.rating, baseline:puzzleRating, delta:Math.round(p.rating-puzzleRating), n:p.n }))`.
  - `dimensions`:
    - if `gameAnalysis` → `buildWeaknessProfile([gameAnalysis], puzzleRating).dimensions`, then **override** the `tactics` dim score with the motif aggregate (motifs carry finer signal than one game's middlegame).
    - else → `tactics` from motif aggregate; the other four = `{score:50, detail:'Play the calibration game to assess this', sampleSize:0}` (honest placeholder).
  - `strengths` = top motif deltas (>+40) + dims with score ≥ 65, as labels.
  - `weaknesses` = bottom motif deltas (<-40) + dims with score ≤ 35, **worst-first**, as labels.
  - `source = { ladders: probes.length>0, game: !!gameAnalysis }`.
- A small `motifAggregateScore(motifs): number` maps mean delta → 0..100 (same shape as `weakness.acplToScore`: delta 0→50, +200→~90, −200→~10).

**A3 · `src/coach/program.ts`** (pure)
- `export function profileToLeaks(profile): Leak[]` — one pseudo-`Leak` per weakness (key = motif theme or `${dim}`), `count` ∝ severity rank, `avgWpl` ∝ |delta|/dim-gap, `sampleFens: []`. Worst-first.
- `export function buildCoachProgram(profile, minutes): PlanItem[]` — worst-first within `minutes`, routing per the table below. Does **not** import or mutate `buildStudyPlan` (Insights stays regression-free). May reuse `studyPlan` helper shapes but emits the wider activity set.

| Weakness | PlanItem.activity | focus / notes |
|---|---|---|
| motif (fork/pin/…) | `tactics` | `focus = theme`; if theme maps to an imbalance scenario, append a `sparring` step |
| endgameConversion | `endgames` | — |
| openingAccuracy | `repertoire` then `play-steered` | steer bot openings to the gap |
| timeManagement | `tactics` | `focus = 'time'` (→ `session.tacticsRouting` runs timed) |
| resilience | `comeback` | fallback `sparring` imbalance if no comeback positions (Q-C) |

**A4 · `src/analysis/session.ts`** + **`src/analysis/studyPlan.ts`** — widen both unions additively:
`'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'vision' | 'sparring' | 'play-steered'`.
`buildSession` already does `kind: item.activity`; new kinds pass through (no themes/timed). **No logic change** beyond the union — `buildStudyPlan` never emits the new values, so Insights is untouched.

**A5 · `src/state/app.svelte.ts`** — `View += 'coach'`; add
`sparringScenarioId = $state<string | null>(null)` and `steerDimension = $state<Dimension | null>(null)`.

**A6 · `src/store/db.ts`** — `PlayerModel.coachProfile?: CoachProfile; coachProfilePrev?: CoachProfile;`
(import type from `../coach/types`). Optional → no migration, **no `DB_VERSION` bump** (mirrors `conceptSeen?`/`visionStats?`).

**A7 · `src/ui/Coach.svelte`** — wizard reusing `Board`, `PuzzleLadder` (themed loop, pattern from `Onboarding.svelte`), `AdaptiveOpponent`+`ChessGame` for the game, `Radar`.
- `ladders`: for each theme in `[...COACH_MOTIF_PROBES, 'endgame']`, run a `PuzzleLadder` seeded from `poolRating`/`puzzleRating`; the ladder's `PuzzleRepo.next` call passes `themes:[theme]` (or `phase:'endgame'` for the endgame probe). Collect `ThemeProbeResult{theme, rating, n}`. Progress label "Probing forks (2/4)". **Empty-theme skip (cycle-1 patch):** if `PuzzleRepo.next` returns `null` on the first pull (theme absent in the loaded set), record `n:0` and advance — the probe is dropped by `buildCoachProfile`'s n=0 guard; the wizard never stalls on a missing theme.
- `offer-game` / `game`: reuse the `Onboarding` game flow; on end, `game.pgn()` → `runAnalysis(app.engine, app.puzzles, {pgn, playerColor:'w', source:'played', baseRating:puzzleRating, now:Date.now()})` (Q-A=a) → `GameAnalysis`.
- `result`: `buildCoachProfile(...)` → render `Radar{dimensions}` + strengths/weaknesses (with sample-size labels) + `buildCoachProgram(profile, 30)` list. Button **Start coaching session**: `app.activeSession = { plan: buildSession(buildCoachProgram(profile,30)), current:0, startedAt:Date.now(), reflection:'' }` then `app.go('session')`. Persist: shift `coachProfile → coachProfilePrev`, set `coachProfile = profile`, `persistModel`.

**A8 · `src/ui/Session.svelte`** — `TRAINER_VIEW += { sparring:'sparring', 'play-steered':'play' }`; in `launch()`, for `sparring` set `app.sparringScenarioId = scenarioForFocus(step.focus)`, for `play-steered` set `app.steerDimension = step.focus as Dimension` (Q-B=a).
- **`scenarioForFocus(focus)` (cycle-2 patch)** — a small deterministic map from a program focus to an `IMBALANCE_LIBRARY` id (defined in `coach/program.ts`, imported here or passed on the step): endgame/resilience-in-endgame → `'rook-up'`; opposite-side-castling/attacking foci → `'opp-castle'`; default middlegame imbalance → `'iqp'`. Stable (no randomness); the id is validated to exist in `IMBALANCE_LIBRARY`. If `scenariosFromWeakness` later supplies a real leak FEN, prefer that id.

**A9 · `src/ui/Sparring.svelte`** — onMount: if `app.sparringScenarioId`, find it in `scenarios`, auto-`start` it, then clear the signal.

**A10 · `src/ui/Play.svelte`** — in the opening-steer block, if `app.steerDimension` is set, use it as the `weakest` override (instead of the history-derived value), then clear it.

**A11 · entry points** — `Home.svelte`: button "Personal coaching" → `app.go('coach')`. `Insights.svelte`: link near the radar. `Settings.svelte`: "Re-run coaching assessment" (mirrors "Re-run skill evaluation"). `App.svelte`: render `Coach` when `view==='coach'`.

## §5 Phase B — tests

- `src/coach/diagnostic.test.ts` — `buildCoachProfile`: (i) motif deltas computed vs baseline; (ii) with `gameAnalysis` the 4 game-only dims populate and `tactics` is motif-overridden; (iii) without a game those four are `sampleSize:0` placeholders and `source.game===false`; (iv) strengths/weaknesses ranking worst-first; (v) empty probes → no crash.
- `src/coach/program.test.ts` — `buildCoachProgram`: (i) each weakness routes per the table (motif→tactics, endgame→endgames, opening→repertoire+play-steered, time→tactics focus 'time', resilience→comeback); (ii) worst-first order; (iii) honors `minutes` budget; (iv) `play-steered`/`sparring` kinds survive `buildSession` (`kind` passthrough); (v) `profileToLeaks` shape.
- No UI unit tests (repo norm). Keep all cores pure (inject `assessedAt`/ratings — no `Date`/`Math.random`).

## §6 Phase C — verification (acceptance gates)

- [ ] `npm test` — 376 prior + new `coach/*` tests, all green; **no prior test regressed**.
- [ ] `npm run check` — `svelte-check` 0 errors (union widening type-checks across `studyPlan`/`session`/`Session.svelte`).
- [ ] `npm run build` — production build green.
- [ ] Manual smoke: Home → Personal coaching → ladders complete → skip game → profile renders with placeholders for game-only dims → Start coaching session → `Session.svelte` resumes the coach program (does **not** rebuild from history) → a `sparring` step lands on the seeded scenario.
- [ ] Re-run from Settings → `coachProfilePrev` populated; profile overwrites.

## §7 Phase Z — docs (LAST)

- **`decisions.md`** — append **ADR-0045 — Coach mode: active multi-dimensional diagnostic reusing the calibration method**. Content: the gap (history-driven profile vs history-free probe); reuse of `PuzzleLadder` per motif + `runAnalysis` for the game; additive `coachProfile?` field (no `DB_VERSION` bump, cross-link ADR-0040/0043 precedent); program routes to drills **and** game modes via additive `sparring`/`play-steered` kinds + `sparringScenarioId`/`steerDimension` signals; honesty posture (directional, sample-size-labelled — cross-link AP-CHESS-13/24); Q-A..Q-D decisions recorded. **Append-only; do not amend prior ADRs.**
- **`README.md`** — one line under "Play & calibrate" or a new "Coach" bullet: active strength/weakness assessment + dedicated program. Keep the honesty note (directional, not a grade).

## §8 Acceptance criteria

1. New player (no history) completes a coach assessment and gets a non-empty program. ✅ = ladders alone produce ≥1 weakness → ≥1 program step.
2. Profile is persisted and survives reload; re-run shifts prior. ✅ = `coachProfile`/`coachProfilePrev` round-trip through IndexedDB.
3. "Start coaching session" reuses `Session.svelte` with **zero** history dependency. ✅ = `app.activeSession` pre-set → RESUME branch.
4. Game modes are reachable **and** seeded (Q-B): a `sparring` step opens the chosen scenario; `play-steered` steers to the chosen dimension.
5. All §6 gates pass; no prior test/behaviour regressed (Insights study plan unchanged).
6. Every displayed score carries a sample-size / data-source qualifier (honesty).

## §9 Anti-patterns

- **AP-COACH-1 — Forking `buildStudyPlan`.** Do NOT branch Insights' generator. `buildCoachProgram` is separate; the only shared change is the additive union. Insights output must be byte-identical post-PR.
- **AP-COACH-2 — Grading.** No single "coach score"/letter grade. Per-motif from 3–5 puzzles and one short game are low-n; label every number, reuse "where to focus" language (AP-CHESS-13/24).
- **AP-COACH-3 — `Date`/`Math.random` in a core.** `diagnostic.ts`/`program.ts` stay pure; the UI stamps `assessedAt` and owns randomness (mirrors `session.ts`/`studyPlan.ts`).
- **AP-COACH-4 — `DB_VERSION` bump.** `coachProfile?` is additive-optional; bumping the schema would force a needless migration and contradict the documented pattern.
- **AP-COACH-5 — Routing to an empty mode.** Resilience→Comeback with no history shows nothing; MUST fall back to a Sparring imbalance (Q-C), else the program dead-ends.
- **AP-COACH-6 — Probing low-confidence motifs.** Only the 6 geometric motifs `motif.ts` detects with confidence are probed; inventing themes the repo can't verify breaks the honesty doctrine.
- **AP-COACH-7 — History rebuild on coach session.** Coach MUST pre-set `app.activeSession`; if it navigates to `session` without it, `Session.svelte` rebuilds from `loadAllAnalyses()` (wrong, possibly empty).
- **AP-COACH-8 — Leaking diagnostic state into rating pools.** The coach ladders seed nothing into `puzzleRating`/game pools; they read `puzzleRating` as a baseline only (no separate coach pool — §11).

## §10 Rollback

Single branch `coach-mode`. New files are inert until wired. If a gate fails mid-exec:
1. Revert the entry-point edits (A8–A11, A4–A6) first — restores the app to pre-coach behaviour with `src/coach/*` dormant.
2. `git checkout -- src/analysis/session.ts src/analysis/studyPlan.ts src/state/app.svelte.ts src/store/db.ts` to drop the union/field widening.
3. `npm test && npm run check` must return to the 376-green / 0-error baseline.
No data migration ran (no `DB_VERSION` bump) → stored `coachProfile` on any dev model is simply ignored by reverted code. No persisted-data rollback needed.

## §11 Follow-up

- Multi-day / weekly coaching plan (calendar) layered over `buildCoachProgram`.
- A dedicated coach rating pool + progress trend across re-runs (delta is already stored via `coachProfilePrev`).
- Chess960 strengths/weaknesses probe (needs 960-aware puzzles; out of current data).
- Fold low-confidence phase-bucket motifs into the probe once `motif.ts` confidence widens.
- Seed the coach game's `steerDimension` into Play automatically on the next game (closing the loop tighter).
