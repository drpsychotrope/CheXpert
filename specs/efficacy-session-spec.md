# Spec — `efficacy-session`: guided deliberate-practice runner + efficacy readout

**Scope:** feature (bundles a session runner + an efficacy readout) · **Status:** V1 (2 cycles) · **Date:** 2026-06-02
Batch 3, spec 6 of 6. Cost MED. Depends on nothing else in the batch; the optional `sessions` store is
the **only** potential v4→v5 bump in the whole batch (per [scan contract](../reports/specs-batch-3_scan.md)).

> **§0.5 Bundling caveat (RAISE — see [arbitrages](../reports/efficacy-session_arbitrages.md) Q-A).**
> This spec deliberately bundles two arguably-separable concerns: **(1)** a *session runner* that
> executes the existing study plan end-to-end, and **(2)** an *efficacy readout* that closes the
> honesty loop (did drilling a leak move it?). They share one motivation — making deliberate practice
> *measurable* — and the readout is most meaningful when sessions are the unit being measured, so they
> are specified together. But they are independently shippable: the readout reads only
> already-stored `gameAnalyses` (no runner, no new store), and the runner is useful without it.
> **§3.4 single-concern (draft-general) is in tension here.** Recommendation: **split into two PRs**
> (6a runner, 6b readout) behind one ADR, **ship 6b first**. 6b is zero-schema, zero-nav (one pure
> module + one Insights panel), so it cannot regress navigation or the DB and de-risks the larger 6a
> (new View + conditional v5 bump). This spec is written so the two halves (Phase A.1 vs A.2, B.1 vs B.2)
> cleave cleanly. See Q-A.

## §0.6 Decisions locked (V1 — user accepted ALL refiner recs, 2026-06-02)

The arbitrages below are **resolved** (see [decisions-applied](../reports/specs-batch-3_decisions-applied.md)). Build to these; the conditional ("Q-B=a/Q-B=b") language later in the spec is superseded by this block:

- **Q-A = SPLIT, readout first.** This one plan implements BOTH halves but **sequenced**: the **efficacy readout (A.2 / 6b)** ships **first** (pure `efficacy.ts` + Insights panel + shared `leakKey`, zero-schema, zero-nav), THEN the **session runner (A.1 / 6a)**. Plan tasks are ordered readout-before-runner so the readout is independently shippable/revertable.
- **Q-B = DERIVE, NO bump.** The `sessions` object store and `src/store/sessionStore.ts` (§4.5) are **NOT built**; **`DB_VERSION` stays 4** (whole batch stays v4). Session reflection is **display-only, NOT persisted** (documented limitation; persistence is a §11 follow-up). The §3 gate about the v5 bump and the `db.test.ts` blast-radius are therefore **N/A**. `SessionRecord`/`saveSession` are not introduced.
- **Q-C** verbatim honesty caveat (§4.4) · **Q-D** two-window early/recent split at median `analyzedAt`, phase-scoped denominator, minMoves gate · **Q-E** runner launches existing trainers via signal flags + `app.go` (the implementer picks shell-embed vs flag-return; core stays pure) · **Q-F** Review step included when `dueCount>0` · **Q-G** entry = Insights "Start session" button, no new top-nav button. All = **rec a**.

## §0 Context

The README "Honesty notes" concede that **"'personalised beats generic' is plausible, not proven … the
model stays local so the effect could one day be measured for real"**
([README](../README.md) §Honesty notes). [`studyPlan.ts`](../src/analysis/studyPlan.ts) already turns the
weakness fingerprint into a deterministic daily plan (warm-up → resilience → worst-impact leaks within a
time budget), and [`fingerprint.ts`](../src/analysis/fingerprint.ts) already recomputes the weakness radar
over rolling windows (`weaknessTrend`). What's missing is the *connective tissue*:

1. **No runner.** The plan is a static checklist on [Insights](../src/ui/Insights.svelte); the user must
   manually navigate to Tactics/Endgames/Comeback/Review for each item, with no notion of "I'm doing my
   session now", no sequencing, no completion/time tracking, no closing reflection.
2. **No efficacy readout.** `weaknessTrend` shows *all* dimensions drifting over windows of games, but
   never answers the precise honesty question the README raises: *"I drilled forks for three weeks — did
   my fork-miss rate actually fall?"* The data to answer it (per-motif miss counts over time windows) is
   already in the stored `PlyAnalysis` motifs; nothing surfaces it as a **before/after, descriptive,
   caveated** statement.

This spec adds both, **pure-core + thin UI, no engine, no LLM**, reusing the existing trainers as the
session's building blocks rather than reimplementing them.

## §1 Empirical baseline

- **Plan source.** `buildStudyPlan(leaks, weakest, minutesPerDay) → PlanItem[]`
  ([studyPlan.ts](../src/analysis/studyPlan.ts)) is **single-day** and **pure** (no `Date`): warm-up
  (vision, ≤3m) → resilience→comeback (if weakest) → leaks mapped to `tactics|endgames|repertoire`,
  budget-capped. `PlanItem = { activity: 'tactics'|'endgames'|'repertoire'|'comeback'|'vision'; focus; minutes; reason }`.
- **Leaks / trend.** `buildFingerprint(analyses) → { leaks: Leak[] }`;
  `Leak = { key, motif, phase, count, avgWpl, sampleFens, severity:{mistake,blunder} }`, ranked by
  `count × avgWpl`, capped at 8, cluster key = confident `motif.tag` else `${phase}:${severity}`.
  `weaknessTrend(analyses,{window}) → TrendPoint[]` (`{ window, games, dims }`).
- **Analyses.** `loadAllAnalyses() → GameAnalysis[]` ([runAnalysis](../src/analysis/runAnalysis.ts));
  each `PlyAnalysis` carries `color, motif{tag,confidence}, phase, severity, winProbLoss, fenBefore` and
  the parent `GameAnalysis` carries `playerColor, analyzedAt` ([types.ts](../src/analysis/types.ts)).
- **Nav model.** [App.svelte](../src/ui/App.svelte) renders **exactly one** `app.view` at a time
  (mutually-exclusive if/else); cross-view "tasks" pass through **signal flags** on
  [app.svelte.ts](../src/state/app.svelte.ts) (`tacticsFilterThemes`, `tacticsTimed`, `analysisFen`),
  consumed by the target view on mount. **There is no view-stacking / overlay / "return to caller"
  mechanism today.** This is the central runner-orchestration constraint (see §4.1, Q-E).
- **Persistence.** DB schema **v4**, `DB_VERSION = 4` ([db.ts](../src/store/db.ts)); additive
  fallthrough `upgrade()` ladder; **adding fields to existing records needs NO bump — a new object store
  is the ONLY thing that bumps v4→v5** ([scan contract](../reports/specs-batch-3_scan.md)). Store helpers
  follow the [SrsStore](../src/srs/SrsStore.ts) idiom (epoch-ms timestamps, string ids, `now` injected,
  no `Date`/`Math.random` in logic). `clearAllData()` iterates **all** stores, so a new store is wiped
  automatically by privacy-reset.
- **Honesty precedent.** AP-CHESS-13/40/43; ADR-0007/0009/0027. Radar/trend already self-label
  "Directional, not a grade" and gate on sample size.
- 135 tests passing, svelte-check clean, build green (README). AP-CHESS ceiling = 67 (ADR-0032).

## §2 Scope

**In:**

- **(A.1 runner core, pure)** `src/analysis/session.ts` — `buildSession(plan, opts) → SessionPlan`:
  wrap the existing `PlanItem[]` into ordered, executable **steps** (`SessionStep[]`), append a terminal
  **reflection** step, and expose progress helpers. Pure, deterministic, **no `Date`** (timestamps
  injected by the caller). Reuses `buildStudyPlan`'s output verbatim — does **not** re-derive the plan.
- **(A.1 runner UI)** `src/ui/Session.svelte` — a new `'session'` [View](../src/state/app.svelte.ts):
  steps through the `SessionPlan`, launching the **existing trainers** for each block (no
  reimplementation), tracking elapsed time + completion, ending on a 20-second reflection step with an
  optional free-text note. Entry: a "Start session" button on [Insights](../src/ui/Insights.svelte)
  (and/or Home — Q-G).
- **(A.2 efficacy core, pure)** `src/analysis/efficacy.ts` —
  `motifEfficacy(analyses, motifKey, opts) → EfficacyReadout`: for a chosen leak key/dimension, split the
  player's analysed plies into an **early** vs **recent** window (by `analyzedAt`) and report the
  per-motif **miss rate** (flagged mistakes of that motif ÷ player moves in that phase) in each window,
  plus the signed delta. Descriptive only. Pure, no `Date`.
- **(A.2 efficacy UI)** an **efficacy panel** inside [Insights](../src/ui/Insights.svelte): for the top
  leaks, render "you drilled *X*; *X*-miss rate **before → after** (Δ)" with the **honesty caveat**
  verbatim (§4.4). Reuses the existing inline-SVG sparkline approach.
- **(persistence — CONDITIONAL on Q-B)** `sessions` object store + `src/store/sessionStore.ts`
  (`saveSession`/`loadSessions`), **bumping `DB_VERSION` v4→v5** — *only if* the runner persists session
  history + reflection notes. The fallback (Q-B=b) derives session history from existing
  `puzzleAttempts`/`games` timestamps (no bump, no reflection text).

**Deferred (§11):** correlating efficacy with *which* sessions drilled the motif (true causal-ish
attribution); FSRS-scheduling whole sessions; streaks/calendar; multi-day plan; configurable session
templates; exporting reflection notes; any analysis of reflection free-text (permanently out — no-LLM).

**Out (doctrine):** any LLM/NLP on the reflection note (store + display only); any backend; any network;
any *causal* efficacy claim ("this app made you better").

## §3 Pre-flight gates

1. `buildStudyPlan`, `buildFingerprint`, `weaknessTrend`, `Leak`, `PlanItem`, `Dimension`,
   `loadAllAnalyses` available with the signatures in §1 (unchanged).
2. `View` union + [App.svelte](../src/ui/App.svelte) route table editable without breaking nav.
3. Existing trainers (Tactics/Endgames/Repertoire/Comeback/Review/Vision) launchable via the established
   signal-flag pattern (`app.tacticsFilterThemes`, `app.tacticsTimed`, `app.go(view)`).
4. `gameAnalyses` carries `analyzedAt` + per-ply `motif`/`severity`/`phase` (present per §1).
5. **If Q-B=a:** `DB_VERSION` is bump-able and the `upgrade()` ladder appends a `v5` case without touching
   v1–v4 (additive only); `clearAllData` auto-covers the new store (it iterates all stores). **Blast
   radius:** [db.test.ts](../src/store/db.test.ts) hard-asserts `DB_VERSION === 4` *and* an exact
   10-store enumeration (lines 17-19) — both MUST be updated to `5` + add `'sessions'` when this gate is
   taken. (Implementation-time change; this spec only flags it.)
6. 135 tests green; svelte-check clean; build green.

## §4 Phase A — code

### §4.1 `src/analysis/session.ts` (pure runner core)

```ts
export type SessionStepKind = 'vision' | 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'review' | 'reflection';

export interface SessionStep {
  index: number;                 // 0-based position in the runner
  kind: SessionStepKind;
  focus: string;                 // from PlanItem.focus, or 'Reflect on this session'
  minutes: number;               // planned minutes (reflection ≈ 0.5 / "20s")
  reason: string;                // carried from PlanItem, for the runner's "why this" line
  themes?: string[];             // for kind==='tactics' → app.tacticsFilterThemes (leak.key)
  timed?: boolean;               // for kind==='tactics' → app.tacticsTimed (timeManagement)
}

export interface SessionPlan {
  steps: SessionStep[];
  totalMinutes: number;          // sum of step.minutes (incl. reflection)
}

/** Wrap a deterministic study plan into an executable session: map each PlanItem to a
 *  SessionStep, optionally insert a spaced-Review block, and append a terminal reflection.
 *  Pure: NO Date, NO Math.random. */
export function buildSession(
  plan: PlanItem[],
  opts?: { includeReview?: boolean; reviewMinutes?: number },
): SessionPlan;
```

- **Mapping.** Each `PlanItem` → one `SessionStep` of the same `kind` (the `PlanItem.activity` union is a
  subset of `SessionStepKind`). `focus`/`minutes`/`reason` copied through. For `tactics` steps, derive
  `themes`/`timed` from the focus the same way [Insights.drillLeak](../src/ui/Insights.svelte) /
  [drillTarget](../src/analysis/weakness.ts) do (so the runner launches Tactics filtered to the leak, or
  timed for time-management) — **reuse, do not re-derive a parallel mapping** (AP-ES-2).
- **Review block (Q-F).** If `opts.includeReview` (default per Q-F), insert one `review` step (spaced
  repetition due-queue) **after** the weakness drills and **before** reflection — matching the seed's
  "warm-up → weakness drill block → spaced Review → reflection" shape. The plan from `studyPlan.ts` has
  no review item today, so the runner adds it; whether it appears is driven by due-card availability at
  the UI boundary (the core just reserves the slot).
- **Reflection step.** Always append a terminal `{ kind:'reflection', minutes: 0.5, focus:'Reflect on this session', … }`.
  The core keeps the precise `0.5` (determinism); the UI renders it as "~20s" and rounds the displayed
  `totalMinutes` (so a 30-min plan shows "~30 min", not "30.5").
- **Determinism.** Same inputs → identical `SessionPlan` (`toEqual`), no `Date`/random. Empty plan →
  a session with just the reflection step (the runner is never empty-but-broken).
- **Orchestration note (NOT in the core; UI concern, see §4.3 + Q-E).** Because [App.svelte](../src/ui/App.svelte)
  shows one view at a time and has no overlay/return-to-caller, the runner cannot "embed" Tactics as a
  sub-view trivially. The core stays a pure data structure + progress helpers; **how** the UI advances
  through it is the Q-E arbitrage. The core MUST NOT import Svelte or `app`.

### §4.2 `src/analysis/efficacy.ts` (pure efficacy core)

```ts
export interface EfficacyReadout {
  motifKey: string;              // the leak key being measured (e.g. 'fork', 'endgame:mistake')
  label: string;                 // display label (leak.motif)
  early: { missRate: number; playerMoves: number; misses: number };  // older window
  recent: { missRate: number; playerMoves: number; misses: number }; // newer window
  deltaPct: number;              // recent.missRate - early.missRate (negative = improved)
  enoughData: boolean;           // both windows ≥ minMoves (else caveat hard)
}

/** Descriptive before/after miss-rate for ONE motif/leak across the player's analysed games.
 *  Splits player plies by analyzedAt into an older vs newer half (or by opts.splitAt).
 *  miss = a player ply flagged mistake|blunder whose cluster key === motifKey.
 *  denominator = player plies in the SAME phase(s) the motif occurs in (so the rate is
 *  "how often, when this kind of position arose, did I get it wrong"). Pure: NO Date.
 *  NO causal claim — caller MUST attach the honesty caveat (§4.4). */
export function motifEfficacy(
  analyses: GameAnalysis[],
  motifKey: string,
  opts?: { minMoves?: number; splitAt?: number },  // splitAt = analyzedAt boundary; default = median
): EfficacyReadout;
```

- **Cluster key parity (AP-ES-1).** The `motifKey` MUST be computed with the **same** rule as
  `buildFingerprint`: `motif.confidence==='high' ? motif.tag : `${phase}:${severity}``. Share a tiny
  exported helper (`leakKey(ply)`) lifted from `fingerprint.ts` so the readout and the fingerprint can
  never disagree about what "fork" means.
- **Windowing (Q-D).** Default: sort player-relevant analyses by `analyzedAt`, split at the **median
  timestamp** into early/recent halves (≥1 game each). `opts.splitAt` lets the UI pin the boundary to
  "when you started drilling this" later (§11). The readout is **two windows**, not a per-window series —
  it answers a single before/after question (the multi-window drift series already lives in
  `weaknessTrend`).
- **Denominator (AP-ES-3 — avoid the rate artefact).** miss-rate = misses-of-this-motif ÷ **player plies
  in the phase(s) where this motif occurs** (not ÷ all player plies, which would make every per-motif
  rate microscopic and a 22%→9% headline impossible). For a `${phase}:${severity}` fallback key the phase
  is explicit; for a confident motif, use the union of phases the motif's misses occurred in across the
  data (same as `Leak.phase`).
- **Honesty (AP-ES-4).** `enoughData=false` when either window has `< minMoves` (default 20) player plies
  in scope; the UI then shows the numbers greyed with "too little data to read a trend" and suppresses
  the Δ headline. The core states facts; it NEVER returns a verdict string like "improved".
- **Determinism.** No `Date`, no random; `toEqual`-stable.

### §4.3 `src/ui/Session.svelte` (runner view — new `'session'` View)

- Add `'session'` to the `View` union ([app.svelte.ts](../src/state/app.svelte.ts)) + a route arm in
  [App.svelte](../src/ui/App.svelte). Add a session-launch signal flag to `app` (see Q-E).
- **On mount:** `loadAllAnalyses()` → `buildFingerprint` + `buildWeaknessProfile.weakest` →
  `buildStudyPlan(leaks, weakest, minutes)` → `buildSession(plan, { includeReview: (await dueCount(Date.now())) > 0 })`.
  (Reuses the exact Insights derivation; the user picks the same 15/30/60 budget. The Review slot is only
  reserved when [`dueCount`](../src/srs/SrsStore.ts) > 0, keeping the core pure of any due-queue I/O.)
- **Step UI:** show the current step (`kind`, `focus`, `reason`, planned minutes), a progress indicator
  ("Step 2 of 5 · ~18 min left"), and elapsed time (UI-owned `Date.now()` at the boundary — never in the
  core). For each non-reflection step the runner **launches the existing trainer** (Q-E): per the chosen
  orchestration, either it sets the trainer's signal flags + `app.go(kind)` and the trainer renders one
  drill, or it mounts the trainer component inside a session shell. **No trainer logic is reimplemented**
  (AP-ES-5). A "Done / Skip" control advances `index`.
- **Reflection step:** a textarea ("What did you notice? What will you do differently?"), a ~20-second
  soft timer (informational, non-blocking — AP-ES-7), and "Finish". On finish, **if Q-B=a**, persist a
  `SessionRecord` (incl. the note) via `sessionStore.saveSession($state.snapshot(record), Date.now())`;
  else just route Home/Insights. The note is **stored + displayed only, never analysed** (AP-ES-6).
- **Empty/low-data state:** if there are no analyses, the session is warm-up + reflection only, with a CTA
  to Play/Analyse (mirrors Insights' empty state) — never a blank or broken runner.

### §4.4 Efficacy panel in `Insights.svelte`

- Below "Your top leaks", a **"Did it move?"** panel: for each of the top ~3 leaks, call
  `motifEfficacy(analyses, leak.key)` and render
  **`{label}: miss rate {early}% → {recent}% ({signed Δ})`**, a tiny two-point sparkline, and the
  sample-size detail. Δ coloured by sign (reuse the existing `--good`/`--bad` + delta pattern already in
  [Insights](../src/ui/Insights.svelte)). When `!enoughData`, grey it + "too little data to read a trend".
- **Honesty caveat (verbatim, fixed wording — Q-C).** The panel header carries:
  > *Descriptive, not proof. This shows your before/after miss-rate; it does not prove the training
  > caused the change. "Personalised beats generic" stays plausible, not proven — the data is local so
  > you can watch it for yourself.*

  This is the spec-fixed string (echoes the [README](../README.md) Honesty note + AP-ES-4). It MUST be
  present whenever a Δ is shown.

### §4.5 `sessions` store + `src/store/sessionStore.ts` (CONDITIONAL — Q-B=a only)

```ts
export interface SessionRecord {
  id: string;                    // `${startedAt}` (epoch ms) — stable, sortable
  startedAt: number;
  finishedAt: number;
  minutesPlanned: number;
  steps: { kind: SessionStepKind; focus: string; completed: boolean }[];
  reflection?: string;           // optional free-text; STORED + DISPLAYED ONLY, never analysed
}
```

- New store in [db.ts](../src/store/db.ts): `sessions: { key: string; value: SessionRecord; indexes: { startedAt: number } }`,
  created in a **`v5`** `upgrade()` case (`if (oldVersion < 5)`), `DB_VERSION = 5`. Additive only; v1–v4
  untouched (gate §3.5). `sessionStore.ts` mirrors [SrsStore](../src/srs/SrsStore.ts): `saveSession(rec, now)`,
  `loadSessions(limit?)` (newest-first via the `startedAt` index). `now`/ids injected by the caller; no
  `Date`/random in the helper logic.
- A small **session history** list MAY appear on Insights (date · minutes · steps done · note) — display
  only. `clearAllData` already wipes it (iterates all stores).
- **If Q-B=b:** skip this file + the bump entirely; derive a coarse history from `games`/`puzzleAttempts`
  `playedAt` clustering and accept **no reflection text** (documented limitation).

## §5 Phase B — tests (Vitest; pure cores only — UI/engine loop = manual)

### §5.1 `src/analysis/session.test.ts`
- `buildSession` maps each `PlanItem` to a same-`kind` step, preserving order and `focus`/`reason`.
- `tactics` steps carry `themes` (from leak key) and the `timed` flag for a time-management focus.
- Review block inserted after drills + before reflection iff `includeReview`; reflection is always the
  **last** step; `totalMinutes` = sum of step minutes.
- Empty plan → session with only the reflection step (length 1, no throw).
- Deterministic: `buildSession(p)` ⟂ `buildSession(p)` `toEqual`; no `Date`/random reachable.

### §5.2 `src/analysis/efficacy.test.ts`
- `motifEfficacy` on synthetic analyses where fork-misses fall from early→recent → `deltaPct < 0`,
  `enoughData` true; rising misses → `deltaPct > 0`.
- `leakKey` parity: a confident-motif ply and a low-confidence ply key exactly as `buildFingerprint` does
  (shared helper; assert equality against a fingerprint leak key on the same fixture).
- Denominator = phase-scoped: changing player-move count in an *unrelated* phase does NOT move the rate.
- `enoughData=false` below `minMoves`; never returns a verdict string; player-moves-only (opponent plies
  ignored); empty input → zeroed readout, `enoughData=false`, no throw.
- Deterministic / no `Date`.

### §5.3 `src/store/sessionStore.test.ts` (only if Q-B=a)
- `saveSession` then `loadSessions` round-trips a record incl. `reflection`; newest-first ordering;
  `clearAllData` empties it. (Mirrors [db.test.ts](../src/store/db.test.ts) fake-IndexedDB setup.)

## §6 Phase C — verification

`npm test` green incl. the new pure suites (session, efficacy, [+ sessionStore if Q-B=a]); `svelte-check`
clean; build green. **Manual:** Insights → "Start session" → runner steps warm-up → a leak drill in the
real trainer → (Review) → reflection; time/progress update; note saved (Q-B=a) and shown in history;
nav unaffected; Insights "Did it move?" panel shows a before/after miss-rate with the caveat on seeded
analyses, and greys out under low data. If Q-B=a: reload the app → DB opens at v5, prior v4 data intact.

## §7 Phase Z — docs (at IMPLEMENTATION time)

- **New ADR, provisional id `ADR-0039`** (this spec only *specifies* it; it is appended when the code
  lands): *"Deliberate-practice session runner + descriptive efficacy readout."* Records: runner is a
  pure plan-wrapper over `studyPlan` driving the existing trainers (no reimplementation); efficacy is a
  **descriptive** per-motif before/after miss-rate sharing `fingerprint`'s cluster key, carrying the
  plausible-not-proven caveat (no causal claim, no LLM); the **Q-B store decision** (v5 bump for
  `sessions` + reflection **vs** derive) and the **Q-A split decision** (6a/6b) with their rationale; new
  anti-patterns mapped to the next free **AP-CHESS** range (≥ 68). Cross-links ADR-0027 (weakness
  intelligence) and ADR-0007/0009 (honesty/no-overclaim).
- **README.** "Honesty notes": upgrade the *"could one day be measured"* line to note the app now shows a
  **descriptive** local before/after efficacy readout (still not a controlled study). "Train & retain" /
  differentiating-loop: add the guided session runner.

## §8 Acceptance

- A `'session'` View runs the **existing** study plan end-to-end (warm-up → weakness drills → optional
  Review → reflection) via the real trainers (no reimplementation), tracking time + completion, ending
  with an optional reflection note; reachable in one click from Insights; nav unaffected.
- Insights shows a **descriptive** per-motif before/after miss-rate ("drilled forks; 22%→9%") with the
  **verbatim honesty caveat** and sample-size gating — **no causal/over-precise claim**.
- `session.ts` + `efficacy.ts` are **pure** (no `Date.now`/`Math.random` inside; caller injects), unit-tested.
- The `sessions` store is **either** added with a clean v4→v5 bump (Q-B=a, prior data intact) **or**
  deliberately omitted with history derived (Q-B=b) — the choice is recorded in ADR-0039.
- No engine call, no network, no LLM, no analysis of reflection free-text. `npm test` + `svelte-check` green.

## §9 Anti-patterns

- **AP-ES-1 — Efficacy/fingerprint key drift.** The readout computing "fork-miss rate" with a *different*
  cluster rule than `buildFingerprint`, so the Insights leak and its efficacy number disagree about what
  counts as a fork. → share one exported `leakKey(ply)` helper; test parity.
- **AP-ES-2 — Parallel leak→activity mapping.** The runner re-deriving its own leak→trainer routing
  instead of reusing the [Insights.drillLeak](../src/ui/Insights.svelte)/[drillTarget](../src/analysis/weakness.ts)
  logic, drifting from the established routes.
- **AP-ES-3 — Miss-rate denominator artefact.** Dividing motif-misses by *all* player moves (rate becomes
  microscopic, no readable headline, and unrelated activity dilutes it) instead of phase-scoped moves.
- **AP-ES-4 — Efficacy over-claim.** Any causal phrasing ("training improved you"), a precise "grade", or
  a trend shown on tiny samples without the caveat + sample-size gate. Descriptive only; mirrors
  AP-CHESS-13/43 and the README Honesty note.
- **AP-ES-5 — Reimplementing trainers in the runner.** Rebuilding a Board/onMove or puzzle loop inside
  `Session.svelte` instead of launching the existing Tactics/Endgames/Comeback/Review views.
- **AP-ES-6 — Analysing the reflection note.** Any parsing/NLP/sentiment/LLM on the free-text reflection.
  It is **store + display only** (no-LLM doctrine). The store schema treats it as opaque text.
- **AP-ES-7 — Blocking the user on the reflection timer.** The "20-second" reflection is a soft,
  informational prompt; it must never lock the UI or force a wait before "Finish".
- **AP-ES-8 — Date/random in a core.** `Date.now()`/`Math.random()` inside `session.ts`/`efficacy.ts`.
  Timestamps + ids are injected at the UI/store boundary (caller-injects doctrine).
- **AP-ES-9 — Unjustified schema bump.** Bumping `DB_VERSION` to v5 if the runner does NOT actually
  persist anything a derive-path can't reconstruct. The bump is justified ONLY by storing reflection
  notes (+ explicit session boundaries); otherwise derive (Q-B). Decision recorded in ADR-0039.

## §10 Rollback

- **Readout-only revert (6b):** delete `efficacy.ts` + its test + the Insights "Did it move?" panel and
  the shared `leakKey` export reverts to inline. Zero schema, zero data impact.
- **Runner revert (6a):** delete `session.ts`/`Session.svelte` + test, drop the `'session'` View arm +
  the launch signal flag (falls back to manual navigation from Insights). If Q-B=a was taken, the `v5`
  store is **left in place** (additive; dropping a store would need a destructive migration) — it simply
  goes unused; or a follow-up no-op `v6` documents it. No user data lost either way.

## §11 Follow-up

- Pin the efficacy split boundary to "when you started drilling motif X" (uses session history → real
  before/after), tightening the descriptive link toward (still non-causal) attribution.
- FSRS-schedule whole sessions; multi-day plans; streak/calendar; configurable session templates;
  per-session efficacy ("sessions where you drilled forks" vs not).
- Export reflection notes (local file). **Permanently out:** any LLM/NLP over reflections.
