# Spec — `weakness-intelligence`: fingerprint + study plan + progress

**Scope:** feature (bundles #1 fingerprint, #2 study-plan, #10 progress) · **Status:** V1 (3 cycles) · **Date:** 2026-06-01
Batch 2, spec A of 6. Foundation — its fingerprint feeds `scenario-sparring` (D).

## §0 Context
The 5-dimension radar ([weakness.ts](../src/analysis/weakness.ts)) says *which* axis is weak but not
*what specifically* you keep getting wrong, nor *what to do about it*, nor *whether you're improving*.
This spec adds the diagnosis/coaching brain — all pure, local, no-LLM, over the already-stored
`gameAnalyses`:
- **Fingerprint** — cluster your mistakes across all games by `motif + phase` → ranked "top leaks" with example positions.
- **Study plan** — a deterministic weekly plan derived from the leaks + a time budget.
- **Progress** — recompute the radar at successive points in time → trend (improved/regressed).

## §1 Empirical baseline
- `loadAllAnalyses()` returns `GameAnalysis[]`; each `PlyAnalysis` has `color, motif{tag,tags,confidence}, phase, severity, winProbLoss, fenBefore, moveNumber`.
- `gameAnalyses` has an `analyzedAt` index → ordering for trend; **no new store** (recompute snapshots).
- 162 tests, svelte-check clean. AP-CHESS 48-50. ADR-0027.

## §2 Scope
**In:**
- `src/analysis/fingerprint.ts` — `buildFingerprint(analyses, playerRating)` → `{ leaks: Leak[] }`, `Leak = { key, motif, phase, count, avgWpl, sampleFens: string[], severityMix }`, ranked by `count × avgWpl` (impact). Player moves only, mistakes/blunders (+ confident motifs).
- `src/analysis/studyPlan.ts` — `buildStudyPlan(fingerprint, weaknessProfile, opts:{minutesPerDay, days})` → ordered `PlanItem[]` (`{ activity: 'tactics'|'endgames'|'repertoire'|'comeback'|'vision', focus, count|minutes, reason }`), allocating time to the worst leaks/dims first; reuses `drillTarget` mapping.
- Progress: `weaknessTrend(analyses, ratingHistory?)` → per-window `WeaknessProfile` snapshots (window by game count or time) → series per dimension; pure.
- `src/ui/Insights.svelte` — new view: top leaks (each with a "Drill" button via `drillTarget`), the plan checklist, and a trend sparkline (reuse the `EvalGraph` inline-SVG approach). Reachable from Dashboard + nav.
**Deferred:** opponent-strength-adjusted weakness; persisted snapshots; ML clustering.

## §3 Pre-flight gates
1. `buildWeaknessProfile`, `Dimension`, `drillTarget` unchanged signatures.
2. `loadAllAnalyses` available; `analyzedAt` index present.
3. 162 tests green; svelte-check clean.

## §4 Phase A — code
### §4.1 `fingerprint.ts` (pure)
- Candidate plies: `color === playerColor && (severity mistake|blunder)`. Cluster key = `motif.confidence==='high' ? motif.tag : `${phase}:${severity}``. Aggregate count, mean `winProbLoss`, up to 3 `sampleFens` (highest wpl), severity mix. Rank by `count × avgWpl`. Cap leaks (e.g. top 8). Deterministic tie-break by key.
### §4.2 `studyPlan.ts` (pure)
- Input leaks + profile + `{minutesPerDay, days}`. Greedy allocate: each leak → an activity via a `leak→activity` map (motif→Tactics(theme), endgame leak→Endgames, opening→Repertoire, resilience dim→Comeback, plus a vision warm-up). Distribute the time budget proportional to impact; emit a per-day checklist. Pure, deterministic (no Date — `days` is a count; UI stamps dates).
### §4.3 `weaknessTrend` (pure)
- Sort analyses by `analyzedAt`; slice into N windows (default: rolling, by game count); `buildWeaknessProfile` per window → `{ window, dims: Record<Dimension, score> }[]`. UI plots per-dim lines + an "vs first window" delta.
### §4.4 `Insights.svelte`
- On mount `loadAllAnalyses()` → fingerprint + plan + trend. Empty-state when no analyses (CTA to Play/Analyse). Leak rows: motif/phase + count + avg −wp% + "Drill". Plan: per-day checklist. Trend: small multiples or one sparkline per dim. Add `'insights'` to the `View` union + a Dashboard link (+ optional nav).

## §5 Phase B — tests
- `fingerprint.test.ts`: clustering by motif, impact ranking, sampleFens picked by wpl, cap, player-only, empty.
- `studyPlan.test.ts`: worst-leak-first ordering, time budget respected, activity mapping, deterministic.
- `weaknessTrend.test.ts`: window count, per-dim series, delta sign on synthetic improving/worsening data.

## §6 Phase C — verification
`npm test` green incl. 3 new selector suites; svelte-check clean; manual: seed analyses → Insights shows ranked leaks + a plan + a trend; "Drill" routes correctly.

## §7 Phase Z — docs
ADR-0027 (weakness-intelligence: fingerprint + plan + trend, recomputed not stored, no-LLM). README "differentiating loop": add the fingerprint → plan → measured-progress layer.

## §8 Acceptance
Ranked leaks with example FENs; deterministic plan honoring the time budget; per-dim trend; one-click drill from a leak; all pure/unit-tested; no new store; no engine/LLM; ADR + README updated.

## §9 Anti-patterns
- **AP-CHESS-48** — Fabricated/over-precise leak labels: cluster only on confident motifs, else fall back to phase:severity (honesty, cf. ADR-0007/0009).
- **AP-CHESS-49** — Plan that ignores the time budget or front-loads trivia instead of worst-impact leaks.
- **AP-CHESS-50** — Trend over-claiming on tiny samples; show sample size / "low data" like the radar.

## §10 Rollback
3 new pure modules + 1 view + a View-union arm. No schema, no data migration. Revert files + the union/nav additions.

## §11 Follow-up
Persist trend snapshots for long-horizon history; opponent-strength-adjusted weakness; goal tracking.
