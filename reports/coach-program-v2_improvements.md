# Enrichments — `coach-program-v2` (C7)

`/enrich` 3 cycles, 8-axis sweep over the drafted V1. Verdict per finding: **FOLD** (integrate now) /
**DEFER** (good idea, wrong PR or premature) / **REJECT** (violates honesty/scope/causality).
ANTI-FABRICATION held: an axis with nothing notable is marked **CLEAN**, not padded.

The 4 mandated folds (CO5 budget, CO16 mastery, CO10 loop, CO17 opening) are the spec's backbone —
this sweep looks for NOTABLE additions *around* them, not a re-listing of them.

## Cycle 1 — sweep (8 axes)

| Axis | Finding | Verdict | Rationale |
|---|---|---|---|
| **1 Capability gap** | **E1** — co-locate each step's before/after advisory ON that step (inline), instead of (or in addition to) a separate "Did it move?" block, so the user sees "drill fork — looks improved" together. | **FOLD** | Higher signal at zero cost; the data already keys by `mastery.motifKey` which equals the step's key. Folded into §4.4. |
| **1 Capability gap** | **E1b** — auto-REORDER the program by least-improved-first (efficacy drives priority). | **REJECT** | Fighting the worst-first sort with efficacy implies "you improved, so I deprioritized" — a soft **causal** claim on disk-derived data. Violates the honesty posture (AP-CPROG-4). Keep ordering weakness-driven; efficacy is descriptive only. |
| **2 Observability / honesty** | **E2** — distinguish "this motif was **never measured** (no games / ladders-only)" from "**too little data** to read a trend". The efficacy contract already separates these (`scoped.length===0` → all-zero windows vs thin-data `enoughData:false`). | **FOLD** | Honesty refinement, fully groundable in `efficacy.ts` (verified). A ladders-only coach run should say "play some games to see if this moves", not the ambiguous "too little data". Folded into §4.3/§4.4 + AP-CPROG-5. |
| **3 Render fidelity** | Mastery badge + criterion display on each step (preview + session). | **CLEAN** | Already in scope (§4.4/§4.5). No gap. |
| **4 Robustness** | **E3** — a ladders-only coach run has **no analyses** (`loadAllAnalyses()` may be empty); `programEfficacy([], …)` must return `[]` and the UI must render **nothing** (no empty "Did it move?" header), and `namedOpeningForGap([], …)` must return `null` (generic reason). | **FOLD** | Real path: the coach can finish without a game (`finishWithoutGame`). The cores already return empty/null; the spec now states the UI must **not** render the header when the list is empty (no hollow section). Folded into §4.4 + §6 manual. |
| **5 Reuse** | **E4** — extract the 15/30/60 `<select>` into a shared Svelte snippet used by Insights + Coach. | **REJECT** | Over-engineering for 2 call-sites with no component-test harness; a shared snippet adds a coupling surface for a 4-line markup. Mirror the markup (the keys are already shared). |
| **6 Extensibility** | `MasteryCriterion.kind` union ('streak'\|'missRate') + `target` already extensible to future criteria. | **CLEAN** | Shape is open; no change needed. |
| **7 Symmetry** | Coach gains the toggle Insights has; the manual "advance / mark worked" lever mirrors Insights' descriptive posture. | **CLEAN** | Toggle symmetry is the CO5 fold; the manual lever is the Q-C belt (arbitrages). Already symmetric. |
| **8 Honest framing** | Efficacy advisory reuses `insights.didItMove`/`didItMoveBody` verbatim; README keeps "descriptive, not proof". | **CLEAN** | Posture already mirrored (§4.7/§7). |

## Cycle 2 — prune + pressure-test the cycle-1 FOLDs

- **E1 (inline advisory)** survives: confirmed the advisory keys on `mastery.motifKey`, which is the
  step's own key — co-location is a join already available, not new data. Kept.
- **E2 (never-measured vs thin)** survives: re-checked `efficacy.ts` — `scoped.length===0` returns
  `{early:ZERO, recent:ZERO, enoughData:false}`; thin data returns real windows with `enoughData:false`.
  The UI can tell them apart by `readout.early.playerMoves + readout.recent.playerMoves === 0`. Kept,
  with that exact predicate added to the spec so it is not hand-wavy.
- **E3 (empty-analyses guard)** survives: the coach `finishWithoutGame` path is real; without the guard
  the result would show a "Did it move?" header over an empty list. Kept.
- **No new FOLD** surfaced in cycle 2. Pruned: an earlier idea to show a per-step "expected impact"
  number — that is **CO9 / C6** (expected-impact prioritization), not C7 (→ DEFER, see below).

## Cycle 3 — conditional / cross-PR

| Finding | Verdict | Target |
|---|---|---|
| **D1** — persist the user's **preferred budget** across coach runs (so 60 sticks). | **DEFER** | **C1** (profile persistence) owns the additive-field pattern; C7 keeps the budget in-session (`app.activeSession.budgetMin`, not persisted). |
| **D2** — **auto re-probe** a motif that looks resolved (efficacy → re-assessment). | **DEFER** | **C2** (probe v2) / **C1** (staleness nudge). C7's loop is descriptive feedback, not re-diagnosis. |
| **D3** — one-click **"add this opening as a RepertoireLine"** from the named gap. | **DEFER** | Trainer/repertoire + **F5** (games store); C7 only *names* the opening (book-agnostic). |
| **D4** — per-step **expected-impact** score next to the criterion. | **DEFER** | **CO9 / C6** (output & teaching). Out of C7's single concern. |
| **D5** — give the efficacy advisory the coach's **narrative voice** (not the bare Insights line). | **DEFER** | **C6** (narrative voice) consumes this loop's data; C7 reuses `insights.*` strings. |
| **D6** — **ADR-0059** for the mastery-criterion step model. | **CONDITIONAL** | Flag only if PR-time review judges "a step can end on mastery, not minutes" architectural (changes the `PlanItem` contract). Reserved 0054–0058 taken. Do **not** pre-spend (§7). |

## Folded into the spec (this PR)

- **E1** → §4.4: render each step's before/after advisory **inline on the step**, keyed by
  `mastery.motifKey`; the separate header carries only the honesty caveat.
- **E2** → §4.3 (`StepEfficacy` gains the never-measured distinction via the
  `early.playerMoves+recent.playerMoves===0` predicate) + §4.4 copy + **AP-CPROG-5** (never-measured
  shows "play some games", not "too little data").
- **E3** → §4.4 (UI renders no efficacy header when `programEfficacy` is empty) + §6 manual case +
  `coachLoop.test.ts` §5 (empty analyses → `[]`, null opening).

## Net effect on the spec
+1 inline-advisory rendering rule, +1 honesty distinction (never-measured), +1 robustness guard
(empty analyses), +~2 test assertions (empty-path + never-measured). No new concern, no scope creep,
no `DB_VERSION` change, no new mandated fold. Backbone (CO5/CO16/CO10/CO17) unchanged.
