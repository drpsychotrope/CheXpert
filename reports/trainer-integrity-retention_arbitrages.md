# T3 `trainer-integrity-retention` — Arbitrages & refiner log

**Drafted** 2026-06-30 · head `9296aff` · method `/draft-general` 4 cycles (defaults applied → V1).
Pre-V0 verdict: **premise CONFIRMED with corrections** (no STOP). See `_target_exists.json`.

---

## Arbitrages (defaults applied to V1 — ratify or override)

| # | Question | **Default applied** | Override if… |
|---|---|---|---|
| **Q-A** | Hint tiers & reveal | **3 progressive**: motif/piece → target square → full move; **any** tier sets `usedHint` + clamps | you want to keep 1 tier (simpler) or 2; or want only tier-3 to clamp (rejected — see cycle 1) |
| **Q-B** | Grade-clamp severity | **FSRS ≤ Hard + skip Glicko gain** (rating flat, not dropped; puzzle rating unmoved) | you prefer ≤ Good + 50% Glicko dampening, or treat a hint as a full miss (harsher) |
| **Q-C** | Streak/goal/last-trained schema | **Additive optional on `PlayerModel`; bump `schemaRev` 1→2; NO `DB_VERSION` bump** | (not recommended) you want a `DB_VERSION` bump — unnecessary, breaks the additive doctrine |
| **Q-D** | Impulsivity placement | **Insights metacog section + gentle inline fast-miss nudge** | Insights-only (drop the nudge) or inline-only (drop the aggregate) |
| **Q-E** | Daily-goal default & unit | **10 puzzles, configurable** in Settings | 5 minutes (needs wall-clock tracking the app lacks) or a different count |

All five are **applied** in `specs/trainer-integrity-retention-spec.md` V1. Nothing blocks the build; these are confirm-or-tune.

---

## Refiner cycle 1 — structural defects (load-bearing)

- **DEFECT (fixed): clamp ownership / composition.** First draft put the hint cap inside `fsrs.ts`. That collides with the existing first-exposure clamp (`fsrs.ts:85`, `Easy→Good` on `State.New`) and risks a clamp that *raises* a grade. **Fix**: a pure `hintGrade.ts` `clampGradeForHint`, applied at the `finish()` call site, composing with the FSRS clamp as `min()`; `fsrs.ts` stays generic. (→ §4 A1/A3, AP-TINTEG-3.)
- **DEFECT (fixed): F3 co-edit collision on `finish()`.** T3 and its dependency F3 both touch `Tactics.svelte`. Verified F3 edits `loadNext` (a new steered branch) + `Coach.svelte`, leaving `finish()` ~as-is; T3 threads `usedHint` through `finish()`. **Fix**: T3 deliberately stays OUT of `loadNext` (retention hangs off `finish()`/mount), so the only co-edited function is `finish()` — flagged for merge review. (→ `_collision.json`, §3.)
- **Q-A resolved**: any tier clamps (not only tier-3). Letting only the full-move tier clamp would let a player take the target-square hint and still grade clean — the integrity hole stays open. Rejected.
- **Q-B resolved**: ≤ Hard + skip gain (not full miss). A hint isn't a miss — the move was executed — so penalising into `Again`/a rating drop is dishonest in the other direction. (AP-TINTEG-2.)

## Refiner cycle 2 — schema & placement

- **Q-C resolved**: three additive-optional fields, `schemaRev` 1→2, **no `DB_VERSION` bump**. Verified the precedent chain (`conceptSeen?`/`visionStats?`/`coachProfile?`, `db.ts:121-124`) and that `metacog-schema.test.ts` asserts `DB_VERSION === 4` — the additive route keeps that test green.
- **Name collision (fixed): `streak`.** Vision.svelte already owns a component-local in-drill `streak`. **Fix**: persisted field is `dailyStreak` (AP-TINTEG-4).
- **Q-D resolved**: Insights metacog section (reuses the locale-following, descriptive-honesty pattern at Insights.svelte:165-196; `rushed` self-tag already names the failure mode) + a passive inline nudge. Verified `allAttempts()` returns rows WITH `ms` (only the `MetacogAttempt` *type* omits it) → the impulsivity core gets real data.
- **AP-COACH-1 re-checked**: `buildStudyPlan` consumes leaks + weakest dimension only; neither retention nor `ms` feed it. The impulsivity readout is a NEW section. Safe; determinism test is the guard.

## Refiner cycle 3 — edges (smaller, folded)

- **Q-E resolved**: 10 puzzles, configurable. Minutes need wall-clock session tracking the PWA doesn't keep; puzzle-count is what the trainer already counts. Default optional field reads 10 when absent.
- **Streak rollover edges (folded into §4 A1/§5)**: same-day multi-session (no double-count), exact next-day (+1), >1-day gap (reset to 1), and the **midnight boundary** (different `dayKey` ⇒ +1). All deterministic via an injected `dayKey` — no `Date.now` in the core (AP-TINTEG-5/9).
- **Transparency fold**: added a "(hint used)" marker (`tactics.hintedTag`) on the solved feedback so the clamp isn't invisible — honesty cuts both ways (the player should know why the card resurfaces).
- **`solvedToday` source confirmed**: reuse `allAttempts()`/`attemptsByPuzzle` filtered by today's `dayKey` — no new store, no index needed (`playedAt` already indexed).

## Refiner cycle 4 — diminishing returns (STOP)

- No new arbitrage. Only wording tightening on §4.2 (clamp seam) and §9 (AP wording). Delta < 10% → **stop at 4 cycles** as planned.

---

## Applied → V1

All five defaults baked into `specs/trainer-integrity-retention-spec.md`. Three pure cores (`hintGrade.ts`, `retention.ts`, `impulsivity.ts`), four additive-optional fields (`usedHint?`, `dailyStreak?`, `dailyGoal?`, `lastTrainedAt?`), `schemaRev` 1→2, **no `DB_VERSION` bump**. Ready for `/enrich`.
