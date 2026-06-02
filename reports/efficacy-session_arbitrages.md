# Arbitrages — `efficacy-session`

User-facing decisions for `specs/efficacy-session-spec.md`. Each has a recommended default (baked into the
spec as the assumed path). Decide before / at implementation; the new **ADR-0039** records the chosen
answers to Q-A and Q-B especially.

---

## Q-A — Split the runner from the efficacy readout, or keep bundled? **(HEADLINE)**
The spec deliberately bundles two separable concerns (§0.5). draft-general §3.4 prefers single-concern specs.
- **(a) Split into two PRs, ship readout (6b) first — RECOMMENDED.** 6b = `efficacy.ts` + an Insights
  panel: **zero schema, zero nav, one pure module**, so it can't regress the DB or navigation and closes
  the README honesty loop immediately. 6a (runner: new View + conditional v5 store) follows. One ADR-0039
  covers both. The spec is already cleaved (Phase A.1/A.2, B.1/B.2) for this.
- (b) Ship as one PR. Simpler bookkeeping, but a larger blast radius lands at once and the low-risk
  readout is gated behind the riskier runner.
- (c) Drop the runner entirely; ship only the efficacy readout. Smallest, but loses the guided-practice
  value the seed asked for.
> **Recommendation: (a).** Same code, lower risk, honesty win lands first.

## Q-B — Persist a `sessions` store (v5 bump) or derive session history? **(HEADLINE — the only v4→v5 bump in batch 3)**
Per the [scan contract](specs-batch-3_scan.md), a new object store is the **only** thing that bumps
`DB_VERSION` v4→v5; the spec must justify or drop it.
- **(a) Add the `sessions` store + bump to v5 — RECOMMENDED *if* the runner ships (6a).** Justified
  **only** by storing the **reflection free-text** + explicit session boundaries (start/finish, steps
  completed) — data a derive-path cannot reconstruct. Additive `v5` upgrade case; v1–v4 untouched;
  `clearAllData` auto-covers it. **Cost:** must also update [db.test.ts](../src/store/db.test.ts) (the
  `DB_VERSION===4` assertion + the 10-store enumeration). Mirrors the `SrsStore` idiom (epoch-ms, injected
  `now`/ids, no Date/random).
- (b) Derive session history from existing `games`/`puzzleAttempts` `playedAt` clustering — **no bump**.
  Avoids the migration + test churn, but **loses reflection notes** (the one thing that makes the
  reflection step worth having) and only yields a coarse, inferred history.
> **Recommendation:** **(a) if Q-A ships the runner and you want reflection notes** (the bump is cheap and
> well-precedented); **(b) if the runner is deferred (Q-A=c)** — then there's nothing to persist and the
> bump is unjustified (AP-ES-9). Record the choice in ADR-0039.

## Q-C — Efficacy honesty-caveat wording (exact string)
The spec fixes this verbatim string (§4.4):
> *Descriptive, not proof. This shows your before/after miss-rate; it does not prove the training caused
> the change. "Personalised beats generic" stays plausible, not proven — the data is local so you can
> watch it for yourself.*
- **(a) Use it verbatim — RECOMMENDED.** Directly echoes the [README](../README.md) Honesty note and the
  AP-CHESS-13/43 precedent; no causal overclaim.
- (b) Reword to taste (keep the no-causal-claim + plausible-not-proven invariants).
> **Recommendation: (a).** Consistency with the README's own framing is the point.

## Q-D — Efficacy metric: per-motif miss-rate over which windows?
- **(a) Two windows — early vs recent half, split at the median `analyzedAt`; phase-scoped denominator —
  RECOMMENDED.** Answers the single before/after question ("22%→9%") the README raises; the multi-window
  *drift series* already exists in `weaknessTrend`, so a series here would duplicate it.
- (b) Rolling N-window series per motif (like `weaknessTrend` but per-motif). More granular, more UI, more
  small-sample noise, overlaps the existing trend.
- (c) Whole-history single number (no before/after). Loses the "did it move?" framing entirely.
> **Recommendation: (a).** Denominator = player plies in the motif's phase(s), NOT all moves (AP-ES-3),
> with a `minMoves` (default 20) sample gate (AP-ES-4).

## Q-E — Runner orchestration: how does `Session.svelte` launch the trainers?
[App.svelte](../src/ui/App.svelte) shows **one** view at a time and has **no overlay / return-to-caller**;
cross-view tasks pass via signal flags on [app](../src/state/app.svelte.ts).
- **(a) Embed: `Session.svelte` renders the trainer component inside a session shell** (a thin wrapper that
  swaps the child component per step + shows progress/skip chrome) — RECOMMENDED. Keeps a single `'session'`
  view, no nav round-trips, cleanest "I'm in a session" UX. Needs a light "single-drill / on-complete"
  affordance from each child (most already end a drill discretely).
- (b) Drive nav: set the trainer's signal flags + `app.go(kind)`, plus a new `app.sessionReturn` flag so
  the trainer routes back to `'session'` on completion. Less new shell code, but adds return-routing to
  every trainer and flickers through full-view transitions.
- (c) Hybrid: simple steps (vision/reflection) inline; heavy trainers (Tactics/Endgames/Comeback) via nav
  (b). Pragmatic but two code paths.
> **Recommendation: (a)** if the trainers expose (or can cheaply expose) a single-item/on-done hook;
> else **(b)** with one shared `sessionReturn` flag. Either way the runner core stays pure (§4.1) — this is
> purely a UI-wiring decision. **This is the main implementation-design call; settle it before 6a.**

## Q-F — Include a spaced-Review block in the session?
The seed's shape is warm-up → weakness drills → **spaced Review** → reflection, but `studyPlan.ts` emits no
Review item.
- **(a) Yes, when due cards exist — RECOMMENDED.** Runner inserts one `review` step after drills /
  before reflection, gated on `dueCount(now) > 0` at the UI boundary (core just reserves the slot). Closes
  the active-recall loop in the same session.
- (b) No — keep the session to exactly what `studyPlan.ts` produces (warm-up + drills + reflection).
  Simpler; defers Review to its own nav entry.
> **Recommendation: (a).** Matches the seed and the retention doctrine; cheap (slot + a due check).

## Q-G — Session entry point
- **(a) Insights "Start session" button — RECOMMENDED (primary).** The plan + efficacy already live on
  Insights; starting the session from there is the natural flow and adds no top-nav clutter (consistent
  with the Comeback "no new nav button" precedent).
- (b) Also add a Home CTA ("Today's session") for one-tap daily start.
- (c) Add a top-nav "Session" button.
> **Recommendation: (a)** primary; **(b)** optional if you want a daily-habit nudge. Avoid (c) — nav is
> already dense (18 buttons).

---

## Cross-spec dependency
- **`sessions` store (Q-B=a) is the ONLY potential v4→v5 `DB_VERSION` bump in batch 3.** All five sibling
  specs add *fields* to existing records (no bump) per the [scan contract](specs-batch-3_scan.md). If this
  spec takes Q-B=b (derive) or defers the runner (Q-A=c), **batch 3 stays at v4 entirely.** No ownership
  conflict with `time-controls` (PlayerModel/GameRecord reshape) or `metacognition`
  (PuzzleAttemptRecord fields) — `sessions` is a wholly new store touching none of those records.
- ADR id: spec specifies **ADR-0039** (siblings claim 0036–0038); confirm the next free id at
  implementation time and renumber if the batch ships out of the assumed order.
