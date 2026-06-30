# Arbitrages — coach-real-data-assessment (C4)

**Drafted**: 2026-06-30 · `/draft-general` 4 cycles applied · recommended defaults APPLIED in the V1 spec (flip any to re-fold).
Resolution: **Q-A=both · Q-B=a (small recent window, sample-labelled) · Q-C=a (persist via F5, no pool leak) · Q-D=consume**.

> **Pre-V0 premise-shift that re-points these.** The scan found that (1) `buildWeaknessProfile(analyses[], rating, locale)` is **already N-game**; (2) `loadAllAnalyses()` already returns **both** imported and played analyses (single `gameAnalyses` store); (3) Import.svelte **already imports real Lichess/Chess.com PGN** and runs `runAnalysis(source:'imported')`. So C4 is **not** "build PGN import" — it is "make the coach **consume** real (windowed) analyses instead of one toy game." The arbitrages below are framed around that reality.

---

## Q-A — Blend source: imported PGN vs existing analyzed history vs both?
**Recommend: BOTH (history-first, import optional).** → `Q-A=both`

- **Why.** `loadAllAnalyses()` already unifies imported+played into one list (`runAnalysis` writes every source to `gameAnalyses`; `runAnalysis.ts:63,91`). The "both" blend is therefore the **native data shape** — there is no extra cost to consuming both, and *excluding* either would be artificial. If the user already has analyzed games (played via Play, or imported via Import), C4 offers to **build dimensions from that history**; the existing **Import flow** (already built) lets them add more games which then flow into the same pool.
- **Mechanism (no fork — Q-D).** `buildWeaknessProfile(window(loadAllAnalyses()), baseline, locale).dimensions` replaces today's `buildWeaknessProfile([oneToyGame]).dimensions` at `Coach.svelte:172`, feeding the **same** `buildCoachProfile({gameDimensions})`.
- **Alternatives rejected.** *Imported-only* — ignores the played history the user already has (CO6's whole point). *Played-only* — ignores the import path that already exists and that CO11 names. *Both* dominates and costs nothing extra.

## Q-B — How many games feed the profile (last N)?
**Recommend: a small recent window, sample-size labelled.** → `Q-B=a`

- **Why.** Recency keeps the assessment representative of current strength; a cap bounds analysis/compute and avoids a stale 6-month tail dominating. `GameAnalysis.analyzedAt` (`types.ts:71`) gives a **pure** sort key — window = "most recent N by `analyzedAt`". **N is a small default (recommend 10)**, exposed as a constant, not a user setting in V1.
- **Honesty is inherited, not rebuilt.** `buildWeaknessProfile` already returns `gamesAnalyzed` + per-dim `sampleSize` and collapses thin phases to "not measured" (`weakness.ts:185-202,258-264`). C4 surfaces `gamesAnalyzed` in the provenance line ("based on N recent games") — directional, no grade (AP-CHESS-13/24).
- **Edge: empty history.** If `loadAllAnalyses()` is empty (or all games filtered out), C4 falls back to the **existing toy-game/ladders path** — no regression, the current behaviour is the floor. (See improvements FOLD-C2.)
- **Alternative rejected.** *All-time, unbounded* — stale + unbounded compute; rejected. A user-tunable N is DEFERRED (§11) to keep V1 single-concern.

## Q-C — Imported games: persist via F5 or ephemeral for assessment?
**Recommend: PERSIST via the existing import path (F5's named substrate); do NOT leak into rating pools.** → `Q-C=a`

- **Why.** Import.svelte **already persists** imported games (`putImportedGame`, `Import.svelte:85-86`) and their analyses (`gameAnalyses`), so they already feed the wider loop (Insights/Dashboard/trainer steering via `weaknessCounters`). Making C4's import *ephemeral* would fork a second, throw-away path — strictly worse. C4 reuses the persisted path; the games become first-class history.
- **AP-COACH-8 boundary (no diagnostic→pool leak).** The leak rule forbids **coach *probe* puzzles** seeding `puzzleRating`/game pools. C4 does **not** violate it: the blend **reads** real-game *analyses*; it writes nothing into rating pools. The `weaknessCounters`/personal-puzzle fold that `runAnalysis` performs is the **intended Phase-2 loop for real games** (F3/F5 doctrine), not a diagnostic leak — real analyzed games are exactly what those counters are *for*. Probe-ladder results remain pool-inert (unchanged).
- **Alternative rejected.** *Ephemeral assessment-only import* — duplicates the import path, discards data the user would want in history, and gains nothing.

## Q-D — Confirm coach CONSUMES buildWeaknessProfile, never forks it (AP-COACH-1)?
**Recommend: CONSUME (confirmed by code).** → `Q-D=consume`

- **Evidence.** Today's coach already consumes: `Coach.svelte:172` calls `buildWeaknessProfile([analysis], …).dimensions` and hands it to `buildCoachProfile({gameDimensions})` (`diagnostic.ts:77-81`). C4 changes only the **input array** (one toy game → windowed real history), not the generator. `buildStudyPlan` and `buildWeaknessProfile` source is **untouched** ⇒ Insights byte-identical (AP-COACH-1).
- **This is a hard gate, not a preference.** Any temptation to special-case history aggregation inside a coach-local copy is REJECTED — window the array, call the shared core.

---

## Diminishing returns (cycle note)
- **Cycle 1** established the four Qs and surfaced the premise-shift (import already exists; analyses already unified) — the highest-value pass.
- **Cycle 2** re-pointed Q-A/Q-C around the unified `gameAnalyses` + existing import path; confirmed `getAllGames` is off the critical path.
- **Cycle 3** firmed the empty-history fallback (Q-B) and the AP-COACH-8 reading (Q-C) — refinements, not new structure.
- **Cycle 4** delta < 10% (only wording of the provenance line + N default). **STOP early — diminishing returns.**

## Defaults applied
The V1 spec body reflects **Q-A=both, Q-B=a (N=10 default), Q-C=a, Q-D=consume**. Flip any value here and re-fold the corresponding §2/§4 text.
