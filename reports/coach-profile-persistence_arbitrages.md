# coach-profile-persistence (C1) — Arbitrages

**Drafted** 2026-06-30 · **Method** `/draft-general` 4 refiner cycles · pre-V0 scan: all premises confirmed, no STOP.
**Defaults below are APPLIED to V1** (the spec reflects the recommended column). User may override before build.

## Pre-V0 corrections (vs the brief)
- Brief paths were repo-root-relative (`D:\Download\Chess\specs\…`); the actual root is the **worktree** (`…\worktrees\vigorous-hofstadter-7b1751`). All files exist there. No premise broke — just the path prefix.
- Everything else in the brief verified TRUE: `coachProfile`/`coachProfilePrev`/`assessedAt` are **write-only** (read only at the write site Coach.svelte:189 + the type decl); `delta` recomputed vs the current baseline each run (diagnostic.ts:61) → not cross-run comparable; "Plus tard" = `app.go('home')` (Coach.svelte:265) discards `programPreview` because `activeSession` (in-memory only, app.svelte.ts:57) is never set on that path; `buildCoachProgram` is pure and rebuilds a program from a saved profile with no re-probe.

## Refiner-cycle trace (diminishing returns, honest)
| Cycle | Focus | Yield |
|---|---|---|
| 1 | Structure / single-concern | 1 finding: trend (CO2) and comparability (CF5) are one computation surfaced twice → must share ONE pure core (`coachTrend.ts`), not duplicate. |
| 2 | Correctness | 2: resume must REBUILD via `buildCoachProgram` (activeSession can't persist); cross-run compare must inner-join motifs on `theme` (sets differ when a theme had n=0). |
| 3 | Honesty / edges | 2: trend stays directional (↑/↓/≈ + delta + sample sizes, no grade — AP-COACH-2); guard absent `coachProfilePrev`/`assessedAt` (legacy/first-run). |
| 4 | Polish | <10% delta — string keys + n-guard wording only. **Stopped at 4; cycle 4 low-yield.** |

## Arbitrages

### Q-A — Intro surfacing of a saved profile
**Question.** When a saved `coachProfile` exists, what does the coach intro offer?
- (a) Nothing (status quo — always re-run the ~14-puzzle assessment).
- (b) **A summary card: "Last assessment <date>" + Radar + strengths/weaknesses, with three actions — `View profile` / `Start program` / `Re-assess`.** `Start program` rebuilds the program via `buildCoachProgram(savedProfile, 30, locale)` → `buildSession` → `activeSession` → `go('session')` WITHOUT re-probing.
- (c) Auto-resume the program on entry (no choice).

**Recommended → (b).** Directly fixes CF2 (write-only profile now surfaced) and the core complaint (re-entry forced a full re-assessment). `Re-assess` preserves the existing flow verbatim. (c) is too aggressive — a returning user may want to re-assess or just look. Rebuild-not-replay is the only reload-safe resume (Q-D).

### Q-B — Progress trend (prev → current) basis
**Question.** What does the trend compare, and where is it shown?
- (a) `motifAggregateScore` (the 0..100 tactics roll-up) prev vs current.
- (b) **Per-theme ABSOLUTE `MotifScore.rating` prev vs current, inner-joined on `theme` (only themes measured in BOTH runs); plus the absolute tactics-rating direction.** Shown on the result screen AND in the intro summary card.
- (c) `delta` prev vs current.

**Recommended → (b).** This is the CF5 fix: `delta = rating − baseline` drifts because `puzzleRating` moves between runs, so prev/current deltas aren't comparable; absolute themed `rating` is the stable quantity. Inner-join avoids comparing a theme that was dropped (n=0) in one run. (c) is the bug; (a) hides per-motif movement and still rides the drifting baseline indirectly. Directional only: render `↑ / ↓ / ≈` + the rating delta + both sample sizes, **no grade** (AP-COACH-2).

### Q-C — Staleness / re-assessment nudge
**Question.** When (if ever) does the coach nudge a re-assessment?
- (a) Never.
- (b) **Soft nudge when `now − assessedAt > STALE_DAYS` (default 21d): a one-line "This read is N days old — consider re-assessing" on the intro summary card. Never blocks `Start program`/`View`. Threshold is a single named constant (`COACH_STALE_DAYS`), trivially tunable.**
- (c) Hard gate (force re-assessment past the threshold).

**Recommended → (b), 21 days.** Uses the already-stored-but-unread `assessedAt` (CO19). Soft and dismissable-by-ignoring — consistent with the app's honesty posture (nudge, don't coerce). 21d ≈ a training cycle; it's a constant, so changing it is one edit. (c) violates "directional, user-led." Pure core decides staleness from injected `now` + `assessedAt` (no `Date` in the core).

### Q-D — "Plus tard" / resume the last program
**Question.** How does a user get their program back after leaving?
- (a) Status quo (`go('home')`, program lost).
- (b) Persist `activeSession` to IndexedDB so it can be reloaded.
- (c) **Rebuild the program from the saved `coachProfile` via `buildCoachProgram` whenever the user chooses `Start program` (intro Q-A) — no session persistence needed.**

**Recommended → (c).** `activeSession` is intentionally in-memory (ADR; Session.svelte rebuilds from it or from history). Persisting it would duplicate session state and risk drift with the saved profile, and (b) would touch the DB (possible bump) for no gain. Since `buildCoachProgram` is pure and deterministic over the profile, rebuilding yields the same program every time — reload-safe, zero new persisted state, **no DB_VERSION bump**. The "Plus tard" button itself stays `go('home')`; the recovery path is the intro's `Start program` (Q-A) on next entry.

## Net doctrine posture (all APPLIED to V1)
- **NO DB_VERSION bump, NO new persisted field, NO schemaRev bump** — C1 only *reads* `coachProfile`/`coachProfilePrev`/`assessedAt` (already persisted by ADR-0045). `COACH_STALE_DAYS` is a code constant.
- **NO new ADR** — additive surfacing, not architectural. Extends ADR-0045. (Next free is 0059 if an override forces it.)
- **Pure cores** — new `coachTrend.ts` (trend + staleness) takes injected `now`; no `Date`/`Math.random`. UI stamps time.
- **Directional, no grade** (AP-COACH-2). **Bilingual FR/EN** for every new string. **Insights/study-plan byte-identical** (AP-COACH-1) — C1 never touches `buildStudyPlan`/`buildSession` logic, only reuses `buildSession` as-is.
- **Verification** via pure-core unit tests (`coachTrend.test.ts`) + static wiring-presence + manual/preview (no Svelte component harness).
