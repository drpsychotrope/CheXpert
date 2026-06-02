# Spec — `metacognition`: confidence capture, self-diagnosed error cause, calibration readout

**Scope:** feature (single concern) · **Status:** V1 (2 cycles; cycle 3 skipped — clean) · **Date:** 2026-06-02
Batch 3, spec 3 of 6 (`reports/specs-batch-3_scan.md`). Cost: **LOW**.

## §0 Context

The app already tells the player what the *engine* sees: motif tags, win-prob loss, weakness
fingerprint, FSRS scheduling. It captures **nothing the engine can't see** — whether the player
*felt sure* of a move, and *why* they think they missed (rushed? unfamiliar pattern? miscalculated?).
These are the two highest-value metacognitive signals in deliberate practice:

- **Calibration** — the gap between stated confidence and actual accuracy. A player who is "sure" and
  wrong 40% of the time is overconfident; that miscalibration is itself a trainable leak, and it is
  invisible to every existing analysis (the engine only knows the move was wrong, not that the player
  was *certain*).
- **Self-diagnosed cause** — "rushed" / "fatigue" / "wrong plan" are causes the engine fundamentally
  cannot detect. A breakdown ("41% of your misses, you said you rushed") points at a behavioural fix
  (slow down, take breaks) that no eval graph can.

This spec captures both as **optional, additive** signals on puzzle attempts and surfaces an **honest,
descriptive** calibration readout in Insights. Per doctrine this is **descriptive feedback, NOT a
grade** — "when you said 'sure' you were right 78%" is a fact about the player, not a score of them.

**Non-goals:** no per-move confidence inside multi-move lines (one confidence per attempt); no
confidence on played games or analysis (puzzle attempts only, this spec); no LLM interpretation of the
self-tag; no new top-nav surface.

## §0.5 Scope check (Q-A)

Single concern: **metacognitive self-report on puzzle attempts + a calibration panel**. It touches one
pure core (`metacog.ts`), one additive store change (`PuzzleAttemptRecord`), three solver views (chips),
and the Insights panel. This is cohesive and ships as **one PR** — there is no clean sub-feature to peel
off (the chips are worthless without the readout, and the readout is empty without the chips). No split
recommended.

## §1 Empirical baseline

- `PuzzleAttemptRecord` (`src/store/db.ts`) already persists every attempt: `solved`, `ms`, `themes`,
  `source`, `playedAt`. Written from **three** call sites — `Tactics.svelte` `finish()`, and (puzzle
  Glicko/attempt log) `Review.svelte` `grade()`. `Calculate.svelte` currently **does not** persist an
  attempt at all (it grades in-memory via `gradeCalcLine`, no `db.put('puzzleAttempts', …)`).
- The store is written via `db.put('puzzleAttempts', {...})` after `$state.snapshot(puzzle)` (proxy
  clone fix, ADR-0033-era; cf. AP in §9). Reads: `db.getAll('puzzleAttempts')` (Review's
  `buildMissesSet`).
- Insights (`src/ui/Insights.svelte`) loads `loadAllAnalyses()` and renders leaks + study plan + a
  progress trend — all from **game analyses**, not from puzzle attempts. It does **not** read
  `puzzleAttempts` today; the metacognition panel is its first puzzle-attempt consumer.
- `SettingsRecord` (`src/store/db.ts`) is the established home for opt-in toggles (`coachedMode`,
  `allowNetwork`, `opponentStyle`), defaulted in `freshSettings()` (`src/store/playerModel.ts`) and read
  with `?? default` for old records (ADR-0035 pattern).
- Solver flow doctrine: Tactics is **active recall** — the user PLAYS the move (AP-CHESS-2); the
  solution is never auto-played. Anything that blocks/slows the move-then-feedback loop is a regression.
- Pure-core convention: no `Date.now`/`Math.random` inside cores; the caller injects (cf. `calc.ts`,
  `fingerprint.ts`, `humanMove.ts`). Vitest, `*.test.ts` colocated.
- 135 tests passing, type-clean, build green (scan §2.2). Next batch ADR id = ADR-0036; this spec
  provisionally claims **ADR-0037** at implementation (clock=0036, chess960 later; this is spec 3 in
  ship order, but ADR ids are assigned at merge — §7 records the provisional id only).

## §2 Scope

**In:**
- `src/metacog/metacog.ts` (new pure core): the fixed **self-tag taxonomy**, the **confidence** value
  type, and `calibration(attempts)` → a per-confidence accuracy table + self-tag breakdown + an honest
  one-line readout helper. Pure, no Date.now/Math.random. Unit-tested (`metacog.test.ts`).
- `PuzzleAttemptRecord` **+** `confidence?: 'sure' | 'unsure' | 'guess'` **+** `selfTag?: string`
  (both optional, additive — **NO `DB_VERSION` bump**, per the data-model contract).
- `SettingsRecord` **+** `metacogEnabled?: boolean` (opt-in master switch; **default off** — see §0.5/Q-E)
  so the chips never appear unless the player opts in. Defaulted in `freshSettings`, read with `?? false`.
- A Settings toggle ("Track confidence & error cause on puzzles") that flips `metacogEnabled`.
- UI chips in **Tactics**, **Calculate**, **Review** solvers (only when `metacogEnabled`):
  - a **confidence** chip-row shown *before* the move/reveal (3 chips: sure / unsure / guess),
  - a **self-tag** chip-row shown *after a MISS* (the fixed taxonomy),
  both optional/skippable; written onto the attempt record at persist time.
- An **Insights** "Calibration" panel rendering the `calibration()` readout (sentence + per-confidence
  table + self-tag breakdown), gated on a minimum sample size.

**Out (deferred to §11):** per-ply confidence; confidence on played games / analysis-board;
Brier-score variant (offered as Q-D, not the default); a dedicated Dashboard tile; trend-over-time of
calibration; persisting `Calculate` attempts (touched only minimally — see §4 note + Q-C).

## §3 Pre-flight gates

1. `PuzzleAttemptRecord` is written from `Tactics.finish()` and `Review.grade()`; both snapshot the
   puzzle before `db.put`. Adding two optional fields requires editing only those put-sites (+ the
   interface). **Verify no other writer exists** (grep `puzzleAttempts'` puts) before editing.
2. Adding optional fields needs **no migration and no version bump** (data-model contract): old records
   simply lack the fields; `calibration()` must treat `undefined` as "not reported".
3. `SettingsRecord` is extensible additively (ADR-0035 precedent); `freshSettings` + `?? default` reads
   cover old records. No bump.
4. Insights can read `puzzleAttempts` via `openTrainerDB().getAll('puzzleAttempts')` (Review already
   does this in `buildMissesSet`) — confirm the call shape.
5. 135 tests green, svelte-check clean before starting (Phase order code→tests→verify→docs).

## §4 Phase A — code

### `src/metacog/metacog.ts` (new pure core)

```ts
export type Confidence = 'sure' | 'unsure' | 'guess';

/** Fixed self-tag taxonomy (closed set — AP-META-2). 'other' is the escape hatch. */
export const SELF_TAGS = [
  'miscalculated',
  'missed-opponent-resource',
  'rushed',
  'unfamiliar-pattern',
  'wrong-plan',
  'other',
] as const;
export type SelfTag = (typeof SELF_TAGS)[number];

/** Human labels for chips/readout (taxonomy keys stay stable for storage). */
export const SELF_TAG_LABELS: Record<SelfTag, string>;

/** Minimal attempt shape the calibration math needs (decoupled from the DB record). */
export interface MetacogAttempt {
  solved: boolean;
  confidence?: Confidence;
  selfTag?: string; // free-ish; unknown values bucket under 'other' in the breakdown
}

export interface ConfidenceRow {
  confidence: Confidence;
  n: number;          // attempts with this confidence reported
  correct: number;    // of which solved
  accuracy: number;   // correct / n, 0..1 (0 when n === 0)
}

export interface SelfTagRow {
  tag: SelfTag;
  n: number;          // misses tagged with this cause
  pct: number;        // n / totalTaggedMisses, 0..1
}

export interface Calibration {
  byConfidence: ConfidenceRow[];     // always 3 rows in fixed order sure>unsure>guess
  reportedAttempts: number;          // attempts with confidence !== undefined
  taggedMisses: number;              // misses with selfTag !== undefined
  selfTags: SelfTagRow[];            // sorted desc by n, then taxonomy order
  /** Honest, descriptive readout. null when below the sample-size floor. */
  readout: CalibrationReadout | null;
}

export interface CalibrationReadout {
  /** e.g. "When you said you were sure, you were right 78% of the time." */
  sentence: string;
  /** Descriptive verdict, NOT a grade: 'well-calibrated' | 'overconfident' | 'underconfident' | 'mixed'. */
  verdict: 'well-calibrated' | 'overconfident' | 'underconfident' | 'mixed';
  /** Most common self-diagnosed cause, e.g. "rushed". null if no tagged misses. */
  topCause: { tag: SelfTag; pct: number } | null;
}

export function calibration(
  attempts: MetacogAttempt[],
  opts?: { minReported?: number }, // default 10
): Calibration;
```

Math (pure, deterministic — no Date.now/Math.random):
- **`byConfidence`**: group attempts that have a `confidence` into the 3 buckets; per bucket
  `accuracy = correct / n` (n === 0 → accuracy 0, n recorded as 0). Always emit all 3 rows in fixed
  order so the UI renders a stable table.
- **`verdict`** (descriptive, threshold-based — Q-B picks the metric; default = confidence×accuracy
  table, NOT Brier). Evaluated in order against the `sure` and `guess` rows; precedence matters so the
  branches are mutually exclusive (test asserts each):
  1. **insufficient data**: if `sure` n < minReported → fall through to `mixed` (the `readout` itself is
     also null below the global floor, AP-META-3, so this rarely shows).
  2. **`overconfident`**: `sure` accuracy < 0.60 (said sure, often wrong — the headline miscalibration).
  3. **`well-calibrated`**: `sure` accuracy ≥ 0.80.
  4. **`underconfident`**: `guess` n ≥ minReported AND `guess` accuracy ≥ 0.70 (i.e. the player solves
     even when they call it a guess — they know more than they think). Checked only after 2–3 so a
     well-calibrated "sure" wins.
  5. **`mixed`**: everything else (incl. the 0.60–0.80 `sure` band).
  Exact thresholds (0.60 / 0.80 / 0.70) → **Q-B**.
- **`sentence`**: built from the `sure` row when it has data ("When you said you were sure, you were
  right N% of the time."); fall back to the bucket with the most data. Strictly descriptive phrasing
  (AP-META-1) — no "good/bad", no letter/number grade.
- **`selfTags`**: count misses by `selfTag`; unknown/legacy values bucket under `'other'`
  (forward-compat, AP-META-2); sort desc by count then taxonomy order; `pct = n / taggedMisses`.
- **`topCause`**: first `selfTags` row (or null if none).
- **Sample-size floor (AP-META-3):** `readout = null` when `reportedAttempts < minReported` (default
  10). The UI shows "keep reporting — need a few more" instead of a noisy verdict off 2 attempts.
- **No I/O, no clock, no randomness.** Caller passes the attempts array.

### `PuzzleAttemptRecord` (`src/store/db.ts`)

Add two optional fields (additive; **no `DB_VERSION` bump** — keep `DB_VERSION = 4`):

```ts
export interface PuzzleAttemptRecord {
  // …existing…
  confidence?: 'sure' | 'unsure' | 'guess'; // metacognition (ADR-0037); absent on legacy records
  selfTag?: string;                          // self-diagnosed cause; absent on legacy / when skipped
}
```

A `// metacognition: optional, additive — no migration (ADR-0037)` comment, mirroring db.ts's existing
schema-history comments.

### `SettingsRecord` (`src/store/db.ts`) + `freshSettings` (`src/store/playerModel.ts`)

```ts
// SettingsRecord:
metacogEnabled?: boolean; // opt-in: show confidence/error-cause chips on puzzles (default false)
```
`freshSettings()` adds `metacogEnabled: false`. All reads use `settings.metacogEnabled ?? false`.

### Solver chips (Tactics / Calculate / Review)

A small shared chip-row pattern (inline markup per view — these views already own their own small
`<style>`; no new shared component required, though one is acceptable — Q-F). Behaviour, identical
across the three:
- **Confidence row** — shown while `status === 'solving'` (i.e. *before* the user commits / before the
  miss-or-solve reveal), only if `app.settings?.metacogEnabled`. Three chips (sure/unsure/guess); click
  sets a local `confidence` var; re-clickable to change; **fully skippable** (no chip selected → field
  left `undefined`). Must **not** block moving (the board stays interactive; selecting a chip is not a
  precondition to playing — AP-META-4).
- **Self-tag row** — shown only **after a MISS** (`status === 'failed'`), only if `metacogEnabled`. Six
  chips (the taxonomy, via `SELF_TAG_LABELS`); click sets local `selfTag`; skippable.
- At persist time, pass `confidence` and `selfTag` (whichever are set) into the
  `db.put('puzzleAttempts', { … })` object. Reset both locals on `loadNext`/`load`/`nextCard`.

Per-view wiring:
- **Tactics.svelte** `finish(solved)`: include `confidence` + (when `!solved`) `selfTag` in the existing
  attempt put. Confidence captured before the move resolves (the chip-row is visible during `solving`);
  the self-tag row appears in the existing miss feedback area.
- **Review.svelte** `grade(solved)`: **Established fact (grep-verified):** the ONLY production
  `puzzleAttempts` writer is `Tactics.svelte`; Review's `grade()` updates the puzzle Glicko +
  `db.put('puzzles', …)` + FSRS, and only **reads** `puzzleAttempts` (`getAll` in `buildMissesSet`) — it
  does **not** write an attempt row. Therefore **do not** add a new attempt write to Review solely for
  metacognition (scope creep + double-counting risk, AP-META-5). **Review chips are deferred** (firm
  default). Re-enable them later only if Review gains its own attempt write. **Decision → Q-C.**
- **Calculate.svelte** `onMove`: Calculate does **not** persist an attempt today. Adding metacognition
  here means **either** (a) wire a minimal `puzzleAttempts` put in Calculate (so confidence/self-tag are
  captured *and* the calc attempt finally shows up in history/calibration), **or** (b) skip Calculate to
  stay strictly additive. **Decision → Q-C.** Default recommendation: (a) — Calculate is the purest
  "did you really see it?" surface, so confidence there is high-signal; a minimal attempt put is small
  and arguably a latent bug-fix (calc attempts are currently invisible).

### Insights "Calibration" panel (`src/ui/Insights.svelte`)

- In `onMount` (alongside `loadAllAnalyses`), also `const attempts = await openTrainerDB().then(db =>
  db.getAll('puzzleAttempts'))`; compute `cal = calibration(attempts)`.
- New `<h3>Calibration</h3>` section, rendered only when `app.settings?.metacogEnabled` AND
  `cal.reportedAttempts > 0`:
  - If `cal.readout`: the `sentence`, the per-confidence table (sure/unsure/guess → accuracy%, n), and
    the self-tag breakdown ("Most common: rushed, 41%" + the full list).
  - Else (below floor): "Calibration needs a few more reported attempts ({reportedAttempts}/10 so far)."
  - A muted footnote: "Descriptive, not a grade — this reflects how your confidence lines up with your
    results." (mirrors the existing "Directional, not a grade" footnote on the progress trend).
- Placement: a sibling `<h3>` block after the progress trend (Q-G offers Dashboard instead;
  recommendation = Insights, where descriptive self-knowledge already lives).

## §5 Phase B — tests (`src/metacog/metacog.test.ts`)

Pure, hand-built attempt arrays (no DB, no clock):
- **byConfidence accuracy**: e.g. 5 `sure` (4 solved) → row accuracy 0.8, n 5; 3 `unsure` (1 solved) →
  0.333; `guess` empty → n 0, accuracy 0. All 3 rows always present, fixed order.
- **verdict thresholds**: `sure` ≥ 0.80 over ≥ floor → `well-calibrated`; `sure` < 0.60 →
  `overconfident`; high `guess` accuracy with weak `sure` → `underconfident`; otherwise `mixed`.
  (Use exactly the thresholds chosen in Q-B; assert each branch.)
- **sentence is descriptive**: contains a percentage and the chosen confidence word; assert it does NOT
  contain a grade token (no "A"/"B"/"good"/"bad"/"poor") — guards AP-META-1.
- **selfTags breakdown**: counts misses by tag, sorts desc, `pct` sums ~1 over tagged misses; an unknown
  tag string buckets under `'other'` (AP-META-2); solved attempts with a stray selfTag are ignored in
  the miss breakdown.
- **sample-size floor**: below `minReported` → `readout === null` (and `reportedAttempts` still counted);
  custom `minReported` via opts honoured (AP-META-3).
- **legacy-safe**: attempts with no `confidence`/`selfTag` are ignored by the respective tallies and do
  not throw; an all-legacy array → `reportedAttempts 0`, `readout null` (AP-META-6).
- **determinism**: same input → identical output (no Date.now/Math.random; ties broken by taxonomy
  order, not insertion).

(Chip UI + persistence = manual verification, §6 — Svelte runes aren't unit-tested here, consistent with
the repo's pure-core-only test doctrine.)

## §6 Phase C — verification

- `npm test` green incl. the new `metacog` suite; `svelte-check` clean.
- Manual: Settings toggle **off** by default → **no chips** appear in Tactics/Calculate (flow unchanged,
  AP-META-4); toggle **on** → confidence chips appear before the move, self-tag chips appear after a
  miss, both skippable; solving/missing with chips set persists `confidence`/`selfTag`
  (inspect the `puzzleAttempts` record in devtools / via a temporary log).
- Insights → Calibration panel: with `metacogEnabled` on and < 10 reported, shows the "need a few more"
  line; after ≥ 10 reported across mixed confidences, shows the sentence + table + self-tag breakdown.
- Regression: legacy attempts (no metacog fields) load and the panel/`buildMissesSet` still work; **no
  `DB_VERSION` bump** (still 4) and existing data is intact (open the app on an existing DB).

## §7 Phase Z — docs

- **ADR-0037** (provisional id; assigned at merge — confirm next free id then, as the batch also lands
  clock/etc.): "Metacognition — confidence & self-diagnosed error cause on puzzle attempts; descriptive
  calibration readout." Records: optional additive fields on `PuzzleAttemptRecord` (no version bump per
  the data-model contract); opt-in `metacogEnabled` (default off) to protect the active-recall flow;
  the fixed self-tag taxonomy; calibration as **descriptive, not a grade** (extends the
  say-only-what-you-can-prove / no-fake-grade doctrine, cf. ADR-0007/0009/0027); the metric chosen in
  Q-B; and the Calculate-attempt-persistence decision (Q-C) if (a) is taken. Cross-links the honesty
  doctrine.
- **README** ("Train & retain" / Insights section): add a line — confidence & error-cause self-report
  on puzzles + a calibration readout (opt-in; descriptive, not a grade).

## §8 Acceptance

- `metacog.ts` pure (no Date.now/Math.random), unit-tested; `calibration()` returns a per-confidence
  accuracy table, a self-tag breakdown, and a descriptive (non-grade) readout gated by a sample-size
  floor; legacy/undefined-safe.
- `PuzzleAttemptRecord` gains `confidence?`/`selfTag?` **additively** with **no `DB_VERSION` bump**;
  `SettingsRecord` gains `metacogEnabled?` (default false).
- Chips appear in the solver(s) **only when opted in**, are **skippable**, and **never block** the
  active-recall move flow; selections persist onto the attempt.
- If Q-C=a: Calculate now writes a `puzzleAttempts` row (previously it logged nothing). This is a
  deliberate, documented side effect — calc attempts begin counting in history/calibration (and would
  feed lapse-set/Glicko if wired the same as Tactics; keep calc's grading as-is unless explicitly
  scoped). Acceptance: exactly **one** attempt per calc position (no duplicate vs Tactics, AP-META-5).
- Insights shows a Calibration panel (sentence + table + self-tag breakdown) gated on opt-in and sample
  size; framed as descriptive, not a grade.
- `npm test` + `svelte-check` green; legacy data intact; ADR-0037 + README updated.

## §9 Anti-patterns

- **AP-META-1** — Presenting calibration as a **grade/score** ("calibration: B−", "confidence IQ 78").
  Doctrine = descriptive feedback only. Readout must be a fact-sentence ("when sure, right 78%") + a
  *descriptive* verdict word (well-calibrated / over- / under- / mixed), never a numeric/letter grade.
  Test asserts no grade token in the sentence.
- **AP-META-2** — Treating the self-tag as free text / an open enum. It is a **fixed closed taxonomy**
  (`SELF_TAGS`); unknown or legacy values bucket under `'other'` so the breakdown can't fragment or
  break on stale data. Storage uses stable keys; only labels are display-facing.
- **AP-META-3** — Emitting a confident verdict off a tiny sample (e.g. "overconfident" after 2
  attempts). Gate `readout` behind `minReported` (default 10); below it, show progress, not a verdict.
- **AP-META-4** — Confidence/self-tag capture **slowing or gating** the active-recall flow (e.g. forcing
  a chip selection before the board accepts a move, or before "Next"). It must be optional, skippable,
  and (master switch) **default off**. The board stays interactive regardless of chip state.
- **AP-META-5** — Adding a **new** `puzzleAttempts` write purely to attach metacognition (double-counts
  attempts in Glicko/lapse-set/history). Only attach to writes that already happen — except the
  deliberate, scoped Calculate decision (Q-C), which *replaces* "no attempt logged" with one attempt,
  not a duplicate.
- **AP-META-6** — `calibration()` throwing or miscounting on legacy attempts missing the fields. Treat
  `undefined` as "not reported"; an all-legacy array yields an empty-but-valid result (no readout).
- **AP-META-7** — Bumping `DB_VERSION` (or adding an object store) for these optional fields. The
  contract is explicit: additive fields need **no** bump; only a new store bumps v4→v5, and this spec
  adds none. `DB_VERSION` stays `4`.
- **AP-META-8** — Confidence captured **after** the result is known (post-reveal), which destroys the
  calibration signal (hindsight = no information). Confidence chips must be live during `solving`,
  before solve/miss is shown.

## §10 Rollback

Fully additive and reversible:
- Delete `src/metacog/metacog.ts` + `metacog.test.ts`.
- Remove `confidence?`/`selfTag?` from `PuzzleAttemptRecord` and `metacogEnabled?` from `SettingsRecord`
  (legacy records with the fields are simply ignored — no migration, no version change either way).
- Drop the chip-rows from Tactics/Calculate/(Review) and the Calibration panel + the `getAll` read from
  Insights; revert the Settings toggle and `freshSettings` default.
- No `DB_VERSION` change to undo. If Calculate attempt-persistence (Q-C=a) shipped, removing it returns
  Calculate to logging nothing (its prior behaviour).

## §11 Follow-up

- Per-ply / per-move confidence inside calculation lines (richer signal where it matters most).
- Confidence on played-game moves and the analysis board.
- A **Brier score** companion metric (Q-D) once the table proves useful — finer-grained calibration.
- Calibration **trend over time** (a sparkline like the weakness trend) to show whether self-knowledge
  is improving.
- Feed `selfTag === 'rushed'` frequency into the time-management dimension / study plan ("you self-report
  rushing 40% of misses — try the timed-off drill"), closing a loop with `weakness.ts`/`studyPlan.ts`.
- A small Dashboard surface (one-line calibration tile) if the Insights panel proves popular (Q-G).

---

## Arbitrages (decisions requested — recommend, don't decide)

- **Q-A — opt-in master switch & default.** Make the whole feature an opt-in `metacogEnabled` setting,
  **default off** (recommended) to protect the active-recall flow for users who don't want it; vs
  default on (more data, but adds chips to everyone's solver). **Rec: opt-in, default off.**
- **Q-B — calibration metric.** (a) confidence×accuracy table + threshold verdict (recommended — legible,
  no stats literacy needed, "when sure, right 78%"); (b) Brier-style score (single number, but opaque to
  most players and reads like a grade — tension with AP-META-1). **Rec: (a); Brier deferred to §11/Q-D.**
- **Q-C — where chips live & Calculate persistence.** Tactics always; for Calculate, (a) add a minimal
  `puzzleAttempts` put so calc attempts (currently unlogged) are captured *and* carry metacognition
  (recommended — high-signal surface, fixes a latent gap), or (b) skip Calculate to stay strictly
  additive. For Review, attach chips **only if** Review already persists an attempt (it appears not to —
  default: defer Review chips, AP-META-5). **Rec: Tactics + Calculate(a); Review deferred.**
- **Q-D — self-tag timing: miss-only vs always.** Self-tag after a **miss only** (recommended — that's
  where "why did I fail?" is meaningful and it adds zero friction on solves) vs always (also capture
  *why you were sure* on a solve — more data, more friction). **Rec: miss-only.**
- **Q-E — the taxonomy list.** Default closed set: `miscalculated, missed-opponent-resource, rushed,
  unfamiliar-pattern, wrong-plan, other`. Confirm/trim/extend (e.g. add `time-pressure`, `tired`?).
  Keep ≤ 6–7 chips so the row stays one tap and unintimidating. **Rec: ship the seed list as-is.**
- **Q-F — chip implementation.** Inline chip markup per view (recommended — 3 small views, matches their
  self-contained `<style>`, lowest surface) vs a new shared `MetacogChips.svelte` component (DRY, but a
  new component for ~30 lines). **Rec: inline; extract later if a 3rd+ surface appears.**
- **Q-G — where the readout surfaces.** Insights Calibration panel (recommended — descriptive
  self-knowledge already lives there alongside the trend's "not a grade" framing) vs a Dashboard tile
  (more prominent, but Dashboard is action-oriented). **Rec: Insights; Dashboard tile is §11.**
- **Q-H — sample-size floor.** `minReported = 10` before any verdict (recommended balance) vs lower
  (5 — earlier feedback, noisier) or higher (20 — stabler, slower to appear). **Rec: 10, tunable via opts.**
