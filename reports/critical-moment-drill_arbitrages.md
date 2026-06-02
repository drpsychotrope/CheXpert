# Arbitrages: `critical-moment-drill`

Spec: [specs/critical-moment-drill-spec.md](../specs/critical-moment-drill-spec.md) · drafted V0 → cycles 1–2 → V1 (cycle 3 skipped).
Reuses `criticalMoments.ts` / stored `gameAnalyses`. **No engine at drill time, no schema change, no new dependency.**

## Critical structural defects (cycle 1 stops)
**None.** One foundation *constraint* surfaced and documented (it shapes the design, doesn't block it):
the stored `PlyAnalysis` has **no second-best line** (`BatchAnalyzer` does one `evaluate()` per
position — ADR-0006; `analyzeLines`/MultiPV confirmed absent from the analysis path). So the design
seed's "uniquely best move by a clear margin" is **not computable from stored data**. The drill is
drafted on the stored `winProbLoss` (realised swing) instead — see spec §0.5 and Q-A/Q-B below.

## Decisions requested from user

### Q-A: CRITICAL criticality signal + threshold
The label that defines a "critical moment."
**Options**
- (a) **`winProbLoss ≥ 15`** (the realised win% the player's move actually swung), ROUTINE `≤ 3`,
  ambiguous band excluded. Reuses the exact metric `criticalMoments.ts`/`EvalGraph` already trust.
- (b) `winProbLoss ≥ 10` (== the existing `mistake` line) — more items, but conflates borderline
  inaccuracies with genuinely critical moments.
- (c) `winProbLoss ≥ 20` (== `blunder`) — purest CRITICAL set, but sparse for stronger players.
**Refiner recommendation: (a) 15.** Sits between `mistake` (10) and `blunder` (20): a moment where a
wrong move *proved* expensive, without flooding the set with near-misses. Tunable via `DrillOptions`.

### Q-B: the "uniquely-best margin" criterion (the design-seed idea)
Whether to also label CRITICAL by "the best move is uniquely best by a clear margin."
**Options**
- (a) **Drop it for this PR.** Not in stored data (§0.5); deriving it needs MultiPV. Ship on the
  `winProbLoss` signal alone.
- (b) Add it **the right way**: a one-shot `analyzeLines(multipv:2)` **during analysis** in
  `BatchAnalyzer`, persisting a `secondBestCp`/`uniqueMargin` per ply (no `DB_VERSION` bump — load-path
  field add). Then CRITICAL = `winProbLoss ≥ T` **OR** `margin ≥ M`. This is an analysis-path change.
- (c) Compute it at drill time with a live MultiPV eval. **Rejected** — violates no-engine-at-drill-time
  (AP-CMD-3, comeback/eval-graph precedent).
**Refiner recommendation: (a) now, (b) as the §11 follow-up spec.** Keeps this PR pure-selector + UI and
honest (AP-CMD-2); the sharper "only-move" signal is real value but belongs in an analysis-path spec,
not bolted onto a drill. (c) is off the table by doctrine.

### Q-C: ROUTINE definition — exclude trivial recaptures?
**Options**
- (a) **Exclude plain recaptures from ROUTINE** (`excludeRecaptures: true`): ROUTINE items are quiet
  positions where nothing hangs — the instructive "play fast" call. (Recapture = `captured != null`
  AND prior ply moved to the same square.)
- (b) Keep recaptures: simpler, but "is an obvious recapture routine?" is a giveaway, not training.
**Refiner recommendation: (a).** A forced recapture is *correctly* routine but teaches nothing; the
skill is recognising a quiet position as safe-to-rush. Flag is in `DrillOptions`, default on.

### Q-D: scoring — binary vs graded
**Options**
- (a) **Binary**: right/wrong per call, running tally. Matches comeback's outcome-grading simplicity.
- (b) **Graded**: partial credit by how far `winProbLoss` is from the threshold (confident-correct on a
  −40% blunder worth more than a borderline call). Returns a `0..1` score.
**Refiner recommendation: (a) binary.** The judgement *is* binary ("stop and think, yes/no"); a graded
score invites an "accuracy %" reading the honesty doctrine forbids (AP-CMD-1). Reveal the real swing
number so the player feels the magnitude without a composite grade.

### Q-E: fallback source (before any game is analysed)
The drill must be non-empty on a fresh install.
**Options**
- (a) **A small curated static FEN set** (~10–12 hand-picked positions, each pre-labelled
  CRITICAL/ROUTINE) bundled in the new module. Pure, instant, no engine, works offline day one.
- (b) Reuse `guess/games.ts` `MASTER_GAMES` — **but** they're raw PGNs, never analysed (no
  `winProbLoss`). Using them needs either an engine pass (violates AP-CMD-3) or hand-labelling specific
  plies anyway → collapses into (a) with extra coupling.
- (c) No fallback: empty state ("analyse a game to drill") until the player has analysed games.
**Refiner recommendation: (a) curated FEN set.** (b) can't work without an engine pass or manual
labels (so it's just (a) wearing a costume); (c) makes the dimension's drill dead on a fresh install.
A dozen curated positions are cheap and let the feature demo immediately. Keep the own-games path
primary; fallback only when the built set is empty.

### Q-F: navigation entry — Dashboard-only vs top-nav
**Options**
- (a) **Dashboard-only** (no new top-nav button), reached from the `timeManagement` dim row. Exactly
  the comeback precedent (ADR-0025): top nav stays uncluttered.
- (b) Add a top-nav "When to think" button (16 buttons already in the header).
**Refiner recommendation: (a) Dashboard-only.** Consistent with comeback; the top bar is already dense.
The view is still one click from the Dashboard.

### Q-G: relation to the existing `timeManagement` drill route
Today `drillTarget('timeManagement') → timed Tactics` (ADR-0024).
**Options**
- (a) **Companion (additive):** keep timed Tactics as the dim's Drill button, add a second link in the
  time-management row ("Train *when* to think →") → `when-to-think`. **No `weakness.ts` change** (the
  new link lives only in `Dashboard.svelte`).
- (b) **Replace:** `drillTarget('timeManagement')` returns `{ view: 'when-to-think' }`; the recognition
  drill becomes *the* time-management drill. Touches `weakness.ts` + its unit test + the `DrillTarget`
  union.
- (c) **Standalone:** reachable only via a generic entry, not tied to the dimension.
**Refiner recommendation: (a) companion.** The two drills train *different* sub-skills — timed Tactics
trains *speed under pressure*; this trains *recognising which positions deserve the clock* (the upstream
skill). Offering both is richer than replacing, and (a) is the smallest diff (no `weakness.ts` churn).
Revisit (b) later if telemetry shows the recognition drill is strictly better.

## Auto-applied patches (no user input needed)
- **C1-P1** Recapture heuristic made precise: `captured != null` AND `plies[i-1].uci.slice(2,4) ===
  ply.uci.slice(2,4)` (verified `uci = from+to+promo`, `captured` reliable from chess.js verbose).
- **C2-1** `labelPly` return typed `DrillLabel | null` across §2/§4.1; ambiguous band named in JSDoc.
- **C2-2** Mount path: own-games-first; fallback only on 0 items; rand injected identically in both.
- **C2-4** `excludeRecaptures` restricted to ROUTINE candidates (never drops a CRITICAL recapture).
- **C2-5** Balance is best-effort with top-up from the larger side (never empty-on-imbalance);
  AP-CMD-7 reworded accordingly.
- **C2-6** ROUTINE reveal copy: show the small swing as a number, don't editorialise "trivial."

## Stop status
- Cycles run: **2/3** (cycle 3 skipped — `cycle_3_skipped.json`).
- Stop reason: **cycle-3-skip** (cycle 2: 0 critical, 6 polish ≤ 8) + decreasing returns.
- Final spec: `specs/critical-moment-drill-spec.md` (V1).

## Next steps
1. Read Q-A..Q-G above.
2. Reply with decisions (e.g. `Q-A: a, Q-B: a, Q-C: a, Q-D: a, Q-E: a, Q-F: a, Q-G: a`).
3. The drafter applies the chosen decisions as a final V1 patch (mostly already baked as the
   recommendations; only Q-G=b would add a `weakness.ts` edit).
4. ADR-0038 is appended at **implementation** time (code → tests → verify → docs), not now.
