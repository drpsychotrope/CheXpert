# Spec — `critical-moment-drill`: the "when to think" trainer

**Scope:** feature · **Status:** V1 (V0 → cycles 1–2; cycle 3 skipped) · **Date:** 2026-06-02
**Batch:** specs batch 3 (clock, modes, pedagogy) — see [reports/specs-batch-3_scan.md](../reports/specs-batch-3_scan.md).
Siblings: `time-controls`, `chess960`, `metacognition`, `concept-cards`, `efficacy-session`.
UI + one pure selector; **no engine change**, **no schema change**, **no new dependency**.

> **Decisions to confirm before execution (see [reports/critical-moment-drill_arbitrages.md](../reports/critical-moment-drill_arbitrages.md)):**
> Q-A criticality signal/threshold · Q-B the "uniquely-best margin" criterion · Q-C ROUTINE
> definition · Q-D scoring (binary vs graded) · Q-E fallback source · Q-F nav entry · Q-G relation
> to the existing `timeManagement` drill route. The spec body below assumes the **refiner
> recommendations**; flip any decision and the marked lines change.

> **One-paragraph pitch.** Time trouble is rarely a clock-speed problem — it's a *decision-allocation*
> problem: spending two minutes on a forced recapture and four seconds on the only-move that saves the
> game. This drill trains the underlying skill directly. The player sees a position from **their own
> analysed games**, calls it **CRITICAL** (a moment that demands thought) or **ROUTINE** (play fast),
> and immediately sees whether they were right — with the real win-probability swing that hung on that
> move and the existing `explainPly` text. No clock; the skill is *recognising* the critical moment,
> which is upstream of managing the clock.

---

## §0 Context
Today the `timeManagement` radar dimension routes its one-click Drill to **timed Tactics**
(`app.tacticsTimed`, a per-puzzle clock — ADR-0024). A clock teaches *speed*, not *judgement*: it
penalises slow play uniformly and never asks "was this a position that deserved your time?". The real
skill behind time management is knowing **which positions are critical** — the few moves per game where
a mistake is expensive — and banking time for them by playing the rest quickly.

This PR adds a **recognition drill**. From the stored `gameAnalyses` we already know, per ply, the
win-probability points that hung on the move (`PlyAnalysis.winProbLoss`, mover-POV, ADR-0006/0021). A
pure selector labels each **player-to-move** ply CRITICAL or ROUTINE from that stored signal, builds a
**balanced, shuffled** drill set (injected rand — no `Math.random` in the core), and a new
`when-to-think` view presents positions on a **read-only mini-board** (the `EvalGraph` precedent),
scores the player's CRITICAL/ROUTINE call, then reveals the actual swing + `explainPly`. **No engine
re-evaluation at drill time** (precedent: `comeback`, `eval-graph`). Source priority: the player's own
analysed games → a fallback so the drill works before any game is analysed (Q-E).

This reuses [criticalMoments.ts](../src/analysis/criticalMoments.ts) (already the home of stored-analysis
selectors) and follows the `comeback` access model (Dashboard-reached, no new top-nav button) unless an
arbitrage argues otherwise (Q-F/Q-G).

## §0.5 Foundation constraint (drives the design — read before §2)
**The "uniquely best move by a clear margin" idea in the design seed is NOT computable from stored
data.** `BatchAnalyzer` evaluates each position with a single `engine.evaluate()` call (ADR-0006:
"each position is evaluated ONCE"), which returns only the **best** move + its eval. The stored
`PlyAnalysis` therefore carries `bestWhiteCp` (best-line eval) and `playedWhiteCp` (played-result eval)
but **no second-best line** — there is no MultiPV in the analysis path (`analyzeLines` exists on
`EngineClient` but is used only by puzzle generation / the analysis board, not by `BatchAnalyzer`).
"Uniquely best by a margin" requires `bestCp − secondBestCp`, which is not stored.

Consequence: the only **stored** criticality signal is `winProbLoss` of the *played* move — *how much
was actually lost*. That is a faithful, if imperfect, label: a position where the player **did** drop
≥ T win% was, in hindsight, critical; one where any reasonable move kept the eval was routine. The
spec is drafted on this stored signal (Q-A). Recovering the true "only-move" margin would need either a
**MultiPV re-eval at drill time** (violates the no-engine-at-drill-time doctrine — `comeback`/`eval-graph`
precedent, AP-CMD-3) or **persisting a margin field during analysis** (a `BatchAnalyzer` change — out
of scope here, surfaced as Q-B and §11 follow-up). This is a *design constraint*, not a blocking defect:
the drill is fully realisable on `winProbLoss` alone.

## §1 Empirical baseline (consume from the shared scan)
From [reports/specs-batch-3_scan.md](../reports/specs-batch-3_scan.md) + anchor reads (2026-06-02):
- `whenToThink` absent in `src/` (grep, case-insensitive) → net-new. Anchors all present.
- `PlyAnalysis` (types.ts) per ply: `color`, `fenBefore`, `uci`, `san`, `moveNumber`, `severity`,
  `winProbLoss` (mover-POV, 0..100), `bestWhiteCp`, `playedWhiteCp`, `cpLoss`, `phase`, `captured?`,
  `motif?`, `mate?`. **No second-best-line field** (§0.5).
- `criticalMoments.ts` already exposes `winCurve` + `criticalMoments(analysis, {max, minLoss})` —
  pure, no engine, no chess.js. `CriticalMoment` tags `side: 'player' | 'opponent'` via
  `ply.color === analysis.playerColor`. Default `minLoss = 10`.
- `explainPly(ply): { headline, reasons[], better }` (explain.ts) is pure and works for **any** ply.
- `EvalGraph.svelte` renders a read-only position context; the repo's mini-board pattern is
  `<Board fen viewOnly lastMove={uciToMove(uci)} />` (eval-graph §4.3, AP-CHESS-37).
- `loadAllAnalyses(): Promise<GameAnalysis[]>` (runAnalysis.ts) reads the `gameAnalyses` store.
- `weakness.ts` `drillTarget('timeManagement')` returns `{ view: 'tactics', timed: true }` today; the
  `DrillTarget.view` union is `'tactics' | 'repertoire' | 'endgames' | 'comeback'`.
- `app.svelte.ts` `View` union lists 19 views incl. `'comeback'`; cross-view signal flags
  (`tacticsTimed`, `tacticsFilterThemes`) live here. `Dashboard.svelte.drill(dim)` reads `drillTarget`
  then `app.go(t.view)`.
- `guess/games.ts` `MASTER_GAMES`: 8 raw annotated PGNs, **never run through `runAnalysis`** (so they
  carry no `winProbLoss`) — relevant to Q-E.
- **DB schema v4, no change**: positions derive on the fly from stored analyses (comeback precedent).
- 135 tests green; `svelte-check` clean (README). AP-CHESS allocation runs to 43; this spec opens a new
  **AP-CMD-N** namespace. New ADR id at implementation time = **ADR-0038** (provisional; `time-controls`
  owns ADR-0036, the next-lowest batch id).

## §2 Scope
**In:**
- `src/analysis/criticalMomentDrill.ts` — pure, unit-tested selector + scorer (NO `Math.random`,
  NO `Date.now`, NO engine, NO chess.js):
  - `labelPly(ply, opts?) → DrillLabel | null` — CRITICAL vs ROUTINE from `winProbLoss` (Q-A);
    `null` for the ambiguous band (excluded from the set).
  - `buildDrillSet(analyses, rand, opts?) → DrillItem[]` — collect player-to-move plies, balance
    CRITICAL/ROUTINE, shuffle via the **injected** `rand: () => number`, cap at N.
  - `scoreCall(item, call) → CallResult` — grade one CRITICAL/ROUTINE answer (Q-D).
- `src/ui/WhenToThink.svelte` — new view: read-only mini-board of `item.fenBefore`, two buttons
  **Critical / Routine**, score the call, reveal actual `winProbLoss` + `explainPly(item.ply)`, then
  Next. Running tally. **No board interaction**, **no engine call**.
- `'when-to-think'` added to the `View` union (app.svelte.ts) + a route arm in App.svelte.
- Dashboard `timeManagement` entry to the new view (Q-F/Q-G).
- A fallback drill source so the view is non-empty before any analysis exists (Q-E).
- Phase Z: **ADR-0038**.

**Deferred (§11):** persisting a true `secondBestCp`/uniqueness margin in `BatchAnalyzer` (the real
"only-move" signal, Q-B); FSRS-scheduling these positions as recall items; a live clock laid over the
drill; tracking a per-player "decision-allocation" score over time on the dashboard.

**Explicitly out:** any engine re-eval at drill time (AP-CMD-3); any schema/`DB_VERSION` bump
(AP-CMD-6); a new top-nav button if Q-F resolves to Dashboard-only.

## §3 Pre-flight gates (re-verify at execution time)
1. `criticalMoments.ts` still exports the `CriticalMoment` shape and `criticalMoments()`; `PlyAnalysis`
   still carries `winProbLoss`, `bestWhiteCp`, `playedWhiteCp`, `severity`, `captured?`, `phase`.
2. `explainPly(ply)` signature unchanged and pure.
3. `loadAllAnalyses()` returns `GameAnalysis[]` with player-POV-derivable per-ply cp.
4. `Board.svelte` still exposes `viewOnly` + `fen` + `lastMove`.
5. `View` union + App.svelte routing editable without breaking nav (mirror the `comeback` add).
6. The fallback source chosen in Q-E is reachable as a pure import (no async engine work).
7. `npm test` 135 green; `npm run check` clean.

## §4 Phase A — code

### §4.1 `src/analysis/criticalMomentDrill.ts` (pure core)
Types:
```ts
export type DrillLabel = 'critical' | 'routine';

export interface DrillItem {
  gameId: string;
  plyIndex: number;
  ply: PlyAnalysis;        // carries fenBefore, uci, san, winProbLoss, severity, …
  fenBefore: string;       // convenience mirror of ply.fenBefore (board prop)
  label: DrillLabel;       // the GROUND TRUTH for this position
  winProbLoss: number;     // the swing that hung on the move (reveal value)
}

export interface CallResult {
  correct: boolean;
  truth: DrillLabel;
  call: DrillLabel;
}

export interface DrillOptions {
  /** Win% loss at/above which a player ply is CRITICAL. Default = Q-A (rec. 15). */
  criticalLoss?: number;
  /** Win% loss at/below which a player ply is ROUTINE. Default 3. The band between
   *  routineLoss and criticalLoss is "ambiguous" and is NOT used as a drill item. */
  routineLoss?: number;
  /** Max items in the built set. Default 12. */
  max?: number;
  /** Exclude trivial recaptures from ROUTINE candidates (Q-C, rec. true). */
  excludeRecaptures?: boolean;
}
```
- `labelPly(ply, opts): DrillLabel | null`: player-to-move filtering is the *caller*'s job
  (`buildDrillSet`); this fn returns `'critical'` if `ply.winProbLoss >= criticalLoss`, `'routine'` if
  `ply.winProbLoss <= routineLoss`, else `null` (ambiguous band — excluded). Q-A sets the CRITICAL
  threshold; **recommend 15** (above the `mistake` line of 10, below `blunder` 20 — a genuinely
  expensive moment, not a borderline inaccuracy). Honesty note in code: the label is *realised* swing,
  not a proven "only-move" signal (§0.5, AP-CMD-2).
- `buildDrillSet(analyses, rand, opts)`:
  - For each analysis, for each ply where `ply.color === analysis.playerColor`, compute `labelPly`.
    Skip `null` (ambiguous-band) plies.
  - **ROUTINE candidate filter (Q-C):** when `excludeRecaptures`, drop a **ROUTINE** ply (never a
    CRITICAL one — a recapture can itself be a blunder) that is a plain recapture: `ply.captured != null`
    AND the immediately preceding ply **moved to** the same square the player now takes back —
    `plies[i-1].uci.slice(2,4) === ply.uci.slice(2,4)`. (`uci = from+to+promo` per pgn.ts, so
    `slice(2,4)` is the destination; `plies[i-1]` is in scope because `buildDrillSet` holds the full
    `plies` array while iterating player plies; pure, no chess.js.) Rationale: "obvious recapture =
    play fast" is *correct* but trivial; the instructive ROUTINE items are quiet positions where
    nothing is hanging.
  - **Balance + shuffle (best-effort, never empty-on-imbalance):** collect all CRITICAL and all
    ROUTINE items, take up to `ceil(max/2)` from each side, then **top up from the larger side** if one
    side is short (a player with only CRITICAL data still gets a full-length set — AP-CMD-7 is
    "balance *when possible* + always shuffle," not "50/50 or nothing"). Concatenate, then **Fisher–
    Yates shuffle using the injected `rand`** (deterministic in tests). Dedup by `fenBefore`.
  - Return up to `max` items. Each item's `label` is the ground truth.
- `scoreCall(item, call)`: `{ correct: call === item.label, truth: item.label, call }`. Q-D: this is
  the **binary** scorer (recommended). The graded variant (partial credit weighted by how far
  `winProbLoss` is from the threshold) is specified in Q-D option (b); if chosen, return a `0..1`
  `score` instead of/alongside `correct`.

### §4.2 `src/ui/WhenToThink.svelte` (new view)
- On mount: `loadAllAnalyses()` → **own games first**: `buildDrillSet(analyses, Math.random, {})`
  (rand injected **at the call site**, AP-CMD-4). Only if that yields **0 items** (no analysed games,
  or none cross a threshold), fall back per Q-E — feeding the fallback positions through the **same**
  `buildDrillSet`/`scoreCall` path with `Math.random` injected identically.
- State: `items: DrillItem[]`, `idx`, `revealed: boolean`, `result: CallResult | null`, running
  `{ right, total }`.
- Per item: `<Board fen={item.fenBefore} viewOnly lastMove={undefined} />` with a "**White/Black to
  move — would you stop and think here?**" caption (POV from `fenBefore` side-to-move). Two buttons:
  **Critical (invest time)** / **Routine (play fast)**.
- On a call: `scoreCall`, set `revealed`, update tally. Reveal panel shows the **truth**, the actual
  **`winProbLoss`** ("about N% in winning chances hung on this move"), and `explainPly(item.ply)`
  (headline + reasons + better). For a ROUTINE truth, state the small swing honestly ("only about N%
  in winning chances hung on this — a position to play quickly"); don't call a near-threshold ROUTINE
  "trivial" (AP-CMD-2 honesty — the number is shown, not editorialised).
- **Next** advances; at the end, show the tally + an honest framing line ("recognising critical
  moments is a trainable feel; this is practice, not a graded verdict" — mirrors comeback AP-CHESS-43).
- Empty/degenerate: if the set is empty even after fallback, show a friendly "analyse a game to drill
  your own positions" with a button to `import`.

### §4.3 Wiring
- Add `'when-to-think'` to the `View` union (app.svelte.ts) and a `{:else if app.view === 'when-to-think'}
  <WhenToThink />` arm in App.svelte (mirror the `comeback` block exactly).
- **Dashboard route (Q-F/Q-G):** *recommended* — keep the `timeManagement` Drill button routing to its
  current target but add a **companion link** in the time-management dim row ("Train *when* to think →")
  that calls `app.go('when-to-think')`. This is **additive** and needs **no `weakness.ts` change**
  (`drillTarget` stays as-is; the new link is a second button in `Dashboard.svelte` only). If Q-G
  instead resolves to *replace*, then `weakness.ts` `drillTarget('timeManagement')` changes to
  `{ view: 'when-to-think' }` and the `DrillTarget.view` union gains `'when-to-think'` (a `weakness.ts`
  edit + its unit test) — see Q-G.

## §5 Phase B — tests (`criticalMomentDrill.test.ts`)
Pure-core coverage (the Svelte view is manually verified, per repo convention):
- `labelPly`: `winProbLoss` of 20 → critical; 1 → routine; 8 (between 3 and 15) → `null`; threshold
  boundaries (exactly `criticalLoss`, exactly `routineLoss`).
- `buildDrillSet`:
  - returns **only player-to-move** plies (opponent plies never appear), via a synthetic 2-game
    `GameAnalysis[]` with mixed colors.
  - balance: given many of each, the set is ~50/50 and capped at `max`; given **only one** label,
    it tops up from that side (non-empty, never crashes) — best-effort balance (AP-CMD-7).
  - **determinism**: same `analyses` + same seeded `rand` (e.g. a small LCG in the test) → identical
    order; a different seed → different order (shuffle actually uses `rand`).
  - `excludeRecaptures`: a ROUTINE ply that recaptures on the prior ply's destination square is
    dropped when the flag is on, kept when off.
  - dedup by `fenBefore`; empty input → `[]`.
- `scoreCall`: correct/incorrect both directions; `truth`/`call` echoed.
- **No-`Math.random`/`Date.now` guard:** a source assertion (grep in the test, mirroring repo style)
  that `criticalMomentDrill.ts` contains neither token (AP-CMD-4).

## §6 Phase C — verification
- `npm test` green incl. the new selector tests; `npm run check` clean.
- Manual: from the Dashboard time-management row, open **When to think**; positions from your own games
  load on a **read-only** board; calling Critical/Routine scores immediately and reveals the real
  win-prob swing + explanation; the tally updates; Next cycles; reaching the end shows the honest
  framing; with **zero** analysed games the fallback set (Q-E) loads instead of an empty screen.
- Grep diff guard: no `runAnalysis`/`analyzeLines`/`engine.evaluate`/engine import added; no new package
  in `package.json`; no `DB_VERSION`/new object store; no "accuracy %" grade string.

## §7 Phase Z — docs
- Append **ADR-0038 — "Critical-moment ('when to think') drill: recognition trainer over stored
  win-prob swings; no engine at drill time"** to [decisions.md](../decisions.md). Record: the realised-
  `winProbLoss` label (not an "only-move" margin — and *why* (§0.5)); the CRITICAL threshold (Q-A);
  ROUTINE definition + recapture exclusion (Q-C); binary vs graded scoring (Q-D); the fallback source
  (Q-E); the Dashboard companion-vs-replace decision for `timeManagement` (Q-F/Q-G). Cross-link
  ADR-0021 (criticalMoments / no accuracy grade), ADR-0024 (drill routing), ADR-0025 (comeback,
  Dashboard-reached precedent). **Append-only.**
- README "Train & retain" / the differentiating-loop section: add the when-to-think drill with the
  honest framing (recognition practice, not a proven method). Note the `timeManagement` dimension now
  offers both the timed-Tactics drill and the recognition drill (or that it routes to the recognition
  drill, per Q-G).

## §8 Acceptance criteria
1. 135 baseline + new `criticalMomentDrill` selector tests pass; `npm run check` clean.
2. `buildDrillSet` returns balanced, **player-to-move-only**, deterministically-shuffled items from
   stored analyses; `labelPly`/`scoreCall` behave per Q-A/Q-C/Q-D.
3. The pure core contains **no** `Math.random`, **no** `Date.now`, **no** engine/chess.js import
   (AP-CMD-4); rand is injected by the caller.
4. **No** engine re-evaluation and **no** new dependency anywhere in the diff (AP-CMD-3).
5. **No** schema change / `DB_VERSION` bump / new object store (AP-CMD-6).
6. The view renders a **read-only** board (AP-CMD-5), scores the call, and reveals the **actual**
   `winProbLoss` + `explainPly` text (no invented reasons — explain.ts is already fact-derived).
7. The drill is non-empty before any game is analysed (fallback per Q-E) and reachable in one click
   from the Dashboard `timeManagement` row (Q-F/Q-G).
8. `'when-to-think'` added to the `View` union + route without breaking nav.
9. **No** single "accuracy/skill grade" number presented as a verdict (AP-CMD-1); the tally is framed
   as practice (honesty doctrine, ADR-0009/0021).
10. ADR-0038 appended; README updated.

## §9 Anti-patterns
- **AP-CMD-1** — Presenting the drill tally as a precise "time-management score" or accuracy grade.
  It's directional practice; never a graded verdict (honesty doctrine; mirrors AP-CHESS-32).
- **AP-CMD-2** — Claiming the CRITICAL label means "this was objectively the only good move." The
  stored signal is *realised* `winProbLoss`, not a second-best margin (§0.5). Copy must say "a moment
  where a wrong move proved expensive," not "the only move."
- **AP-CMD-3** — Running the engine (`evaluate`/`analyzeLines`) at drill time to (re)derive criticality
  or the only-move margin. Forbidden — reuse stored analysis only (comeback/eval-graph precedent).
- **AP-CMD-4** — `Math.random`/`Date.now` **inside** the selector. The shuffle rand and any clock must
  be **injected** by the view; the core stays pure and deterministically testable.
- **AP-CMD-5** — The mini-board accidentally interactive. It must be `viewOnly` (AP-CHESS-37 precedent);
  the player decides Critical/Routine, never moves a piece.
- **AP-CMD-6** — Adding a `DB_VERSION` bump / new object store / `PlyAnalysis` field for this drill.
  Positions derive on the fly from stored analyses; zero migration (comeback precedent).
- **AP-CMD-7** — A set that is all-CRITICAL (or all-ROUTINE), or unshuffled (CRITICAL always first), so
  the player games it by always answering the same way or by position. Must balance **and** shuffle.
- **AP-CMD-8** — Surfacing **opponent** plies (or non-player-to-move positions) as drill items — the
  player can only train *their own* decisions. Filter to `ply.color === playerColor`.

## §10 Rollback
Delete `criticalMomentDrill.ts` + `WhenToThink.svelte` + the `criticalMomentDrill.test.ts`; drop the
`'when-to-think'` `View` arm and the Dashboard companion link; revert the ADR-0038 append (and, if Q-G
chose *replace*, revert the `weakness.ts` `drillTarget` line + its test — `timeManagement` falls back to
timed Tactics). No data/schema/engine touched.

## §11 Follow-up
- **True "only-move" signal:** persist `secondBestCp` (or a `uniqueMargin`) per ply in `BatchAnalyzer`
  via a one-shot `analyzeLines(multipv:2)` *during analysis* (not at drill time), enabling a sharper
  CRITICAL label (Q-B option (b)). Needs an analysis-path change + a (no-bump, load-path) field add —
  its own spec.
- FSRS-schedule missed critical-moment recognitions as spaced-repetition items (recall the *judgement*,
  not the move).
- A live clock laid over the drill (decide fast *and* correctly) — but only after recognition is trained.
- A dashboard "decision allocation" trend (how your critical-moment recognition improves over sessions),
  paired with the `efficacy-session` sibling.
- Feed `when-to-think` results back into the `timeManagement` dimension detail string.
