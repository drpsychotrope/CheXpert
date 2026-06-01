# Spec — `loop-closers`: missed-win puzzles + drill-every-dimension + comeback drills

**Scope:** feature (bundled — **recommend split into 3a/3b/3c**) · **Status:** V1 (V0 → cycles 1–4) · **Date:** 2026-06-01
**Spec 3 of 3.** Siblings: `motif-detectors`, `eval-graph`.

> **⚠️ SPLIT (user accepted Q-A=a, 2026-06-01).** This meta-spec is now the shared-context reference;
> execute the 3 sub-specs instead: [`missed-win`](missed-win-spec.md) (3a, ADR-0023) →
> [`drill-routing`](drill-routing-spec.md) (3b, ADR-0024) → [`comeback`](comeback-spec.md) (3c, ADR-0025).
> Other accepted defaults: Q-B `mate OR bestCp≥500, wpl≥3, cap 3`; Q-C outcome-graded vs adaptive bot;
> Q-D Dashboard-Drill access (no top-nav). Comeback positions come from your own games (played in-app
> via `played-game-review`, or imported) — one-click, no external manipulation.

> Changelog: V0 from locked brainstorm (feature 2: missed-win mining + drill every radar dimension,
> resilience → comeback drills vs the adaptive opponent, graded on recovery). **Cycle 1 flagged a
> scope-decomposition arbitrage** (3 concerns in one spec). Cycles 2–4 hardened the missed-win
> trigger (flood control), the routing model, and the comeback grading. 4 cycles by user request.

---

## §0 Context
The repo's thesis is a closed loop; two seams are still open. (1) [generatePuzzles.ts](../src/analysis/generatePuzzles.ts)
only mines **player mistakes/blunders**, so a *missed forced win while already ahead* (which costs
little win% yet is the most rating-relevant skill — converting won games) never becomes a puzzle.
(2) [Dashboard.svelte](../src/ui/Dashboard.svelte) routes **every** weak dimension to Tactics, and
`timeManagement`/`resilience` get **no drill button at all** — so two of the five radar dimensions
are diagnostic-only. This spec closes both: **missed-win puzzle mining** (3a), **per-dimension drill
routing** (3b), and **comeback drills** for resilience (3c) — replaying your own collapses against the
*adaptive* opponent (battable, in your ZPD), graded on **recovery**, not on beating perfect play.

## §0.5 Arbitrages flagged (scope)
This bundles three separable concerns. **Q-A recommends shipping as 3 PRs** (3a → 3b → 3c). The
sections below are written so each sub-scope is independently extractable.

## §1 Empirical baseline
- `PlyAnalysis` already carries `mate?`, `bestWhiteCp`, `cpLoss`, `winProbLoss` → missed-win pre-filter is free (no extra eval); the existing MultiPV uniqueness gate is reused as-is.
- Dashboard `drill()` sets `app.tacticsFilterThemes` then `go('tactics')`; `app.go(view)` takes **no params**; `tactics`/`resilience` rows render no button (`dimThemes[...] .length === 0`).
- `resilienceScore` (weakness.ts) detects behind-episodes (player cp ≤ −200 → recovered ≥ −100) but **discards** the entry position; 3c needs that FEN.
- `AdaptiveOpponent`: `pickMove(fen, movetime)→bestmove`, strength via `UCI_Elo` at the player's ZPD. Tactics/Play already implement a Board + `onMove` vs-engine loop to reuse.
- 135 tests baseline, `svelte-check` clean. AP-CHESS alloc 38–44; ADR-0022 (or 0022/0023/0024 if split).

## §2 Scope
**In (3a):** widen missed-win candidates + tag; reuse uniqueness gate; per-game cap.
**In (3b):** per-dimension drill targets (opening→Repertoire, endgame→Endgames, time→timed Tactics, tactics→Tactics); a Drill button on every dimension; minimal new state.
**In (3c):** `comeback.ts` selector (entry FENs), `Comeback.svelte` view, `'comeback'` in the View union + App.svelte route, resilience→comeback routing.
**Deferred:** FSRS-tracking comeback positions (§11); endgame/repertoire "focus" deep-links (navigate only); Maia-style sparring (ADR-0003).

## §3 Pre-flight gates
1. `generatePuzzlesFromAnalysis` signature + `LineEvaluator`/MultiPV gate unchanged.
2. `Puzzle.meta` is a freeform record (can hold `kind`); `PuzzleRepo.next` theme/source filters unchanged.
3. `app.go` + `tacticsFilterThemes` pattern intact; `View` union editable.
4. `AdaptiveOpponent.pickMove` available; player ZPD Elo reachable from the model.
5. 135 tests green; `svelte-check` clean.

## §4 Phase A — code

### §4.1 (3a) Missed-win mining — `generatePuzzles.ts`
Extend the candidate filter beyond `severity ∈ {mistake,blunder}`:
```
isMissedWin(p) =
  p.color === playerColor &&
  p.cpLoss > 0 &&                                  // you didn't play best
  ( (p.mate != null && p.mate > 0) ||              // a forced mate was on
    moverPOV(p.bestWhiteCp) >= DECISIVE_CP ) &&     // or a decisive material/eval win
  p.winProbLoss >= MISSED_WIN_MIN_WPL              // the miss actually mattered (flood control)
```
`moverPOV(whiteCp) = color==='w' ? whiteCp : -whiteCp`. Candidates = existing mistakes/blunders ∪
missed-wins (dedup by `fenBefore`/`seen`). Run the **same** MultiPV uniqueness re-check (it already
treats "only best is a mate" as unique). For a missed-win puzzle set `meta.kind = 'missed-win'`
(default `'mistake'`); **do not** invent a non-Lichess theme string (AP-CHESS-29 from spec 1). Cap at
`MAX_MISSED_WIN_PER_GAME` (default 3, AP-CHESS-38). Thresholds → **Q-B**.

### §4.2 (3b) Per-dimension drill routing — `Dashboard.svelte` + `app.svelte.ts`
Replace the themes-only map with a target map:
| Dimension | Target |
|---|---|
| `tactics` | `go('tactics')` + `tacticsFilterThemes` (as today; richer once spec 1 lands) |
| `openingAccuracy` | `go('repertoire')` |
| `endgameConversion` | `go('endgames')` |
| `timeManagement` | `go('tactics')` + `app.tacticsTimed = true` |
| `resilience` | `go('comeback')` (3c) — fallback `go('endgames')` if 3c not shipped |
- New state: `app.tacticsTimed = $state(false)` (+ optional `tacticsTimeLimitMs`). Render a Drill button on **every** dimension (drop the `length>0` gate).
- Timed Tactics: when `tacticsTimed`, Tactics.svelte runs a per-puzzle countdown; timeout = fail (graded as a miss). Clearing the drill resets `tacticsTimed` (mirror `clearDrill`). (AP-CHESS-39: don't leave timed mode stuck on.)

### §4.3 (3c) Comeback drills — new `comeback.ts` + `Comeback.svelte`
- `comebackPositions(analyses)` (new selector, or exported from weakness.ts reusing its episode logic): scan **player** plies; at the first ply where `playerCp ≤ −200`, emit `{ fen: ply.fenBefore, gameId, ply, playerColor, cpAtEntry }` (player to move, losing-but-playable). Dedup; most-recent first. (AP-CHESS-40: must be a player-to-move position.)
- `Comeback.svelte` (new view): on mount `loadAllAnalyses()` → `comebackPositions` → pick a few; for each, play from the FEN vs `AdaptiveOpponent` at the player's ZPD Elo, reusing the Board + `onMove` loop (Play/Endgames pattern). **Grade on recovery** (Q-C): default = game outcome vs the adaptive bot (draw/win = held → pass; loss = fail) so no extra eval probes are needed. Show "you actually scored X here; hold it now."
- Wire-up: add `'comeback'` to the `View` union (app.svelte.ts) and a route branch in [App.svelte](../src/ui/App.svelte). Reachable from the Dashboard resilience Drill (top-nav entry optional → Q-D).

## §5 Phase B — tests
- **3a:** `generatePuzzles.test.ts` — a missed forced mate while already winning becomes a puzzle tagged `meta.kind:'missed-win'`; a trivial "still winning, tiny wpl" position does NOT (flood control); per-game cap respected; existing mistake/blunder puzzles unchanged.
- **3b:** unit-test the dimension→target map (pure function `drillTarget(dim)`); assert opening→repertoire, endgame→endgames, time→tactics+timed, resilience→comeback.
- **3c:** `comeback.test.ts` — `comebackPositions` returns the correct entry FEN/ply for a synthetic analysis with a −200 dip; player-to-move only; empty when never behind. (Engine loop covered by manual verification.)

## §6 Phase C — verification
- `npm test` green incl. new tests; `npm run check` clean.
- Manual 3a: analyse a game where you were winning and missed a mate → a `missed-win` puzzle appears in Tactics.
- Manual 3b: each radar dimension shows a Drill button landing on the right view; time drill runs a countdown; clearing resets timed mode.
- Manual 3c: resilience Drill opens Comeback; a real losing position from your games loads; playing vs the adaptive bot to a hold = pass.
- Grep diff: 3a adds **no** new engine eval pass (only reuses `lines.evaluateLines` already in the loop).

## §7 Phase Z — docs
- Append **ADR-0022 — "Loop closers: missed-win mining + per-dimension drill routing + comeback drills"** (or split ADR-0022/0023/0024 per Q-A) to [decisions.md](../decisions.md). Record Q-A..Q-D, cross-link ADR-0007/0009 and the "personalised is plausible-not-proven" honesty note. Append-only.
- README "The differentiating loop" / "Train & retain": add missed-win puzzles, every-dimension drilling, comeback drills (keep the honesty framing).

## §8 Acceptance criteria
1. 135 baseline + new tests pass; `svelte-check` clean.
2. (3a) Missed forced wins become puzzles, tagged `meta.kind:'missed-win'`, capped per game, deduped; no new Lichess-theme strings invented; no extra engine eval pass.
3. (3b) Every radar dimension has a working Drill button to the correct view; timed Tactics fails on timeout and resets on clear.
4. (3c) Comeback view loads real player-to-move losing positions and plays them vs the adaptive opponent with recovery-based grading.
5. `'comeback'` added to the View union + App.svelte route without breaking existing nav.
6. ADR + README updated; honesty framing preserved (no over-claim).

## §9 Anti-patterns
- **AP-CHESS-38** — Missed-win flood: tagging every "still winning" position; must gate on `winProbLoss`/mate + per-game cap.
- **AP-CHESS-39** — `tacticsTimed` left stuck on after a time drill (must reset on clear, like `tacticsFilterThemes`).
- **AP-CHESS-40** — Comeback position not player-to-move, or unwinnable-by-design (perfect-play lost) presented as failure → demoralising; pick playable dips and grade vs the *adaptive* bot.
- **AP-CHESS-41** — Comeback graded vs full-strength engine instead of the player's ZPD Elo (defeats the purpose).
- **AP-CHESS-42** — Routing opening/endgame drills back into Tactics (the current bug this PR fixes).
- **AP-CHESS-43** — Over-claiming ("comeback training proven to work"); keep the plausible-not-proven framing.
- **AP-CHESS-44** — `meta.kind` collides with an existing meta field or breaks `PuzzleRepo` filters.

## §10 Rollback
- 3a: revert generatePuzzles.ts (puzzles regenerate next analysis; `meta.kind` is additive/ignored by old code).
- 3b: revert Dashboard.svelte + the app-state field; routing reverts to all-Tactics.
- 3c: delete comeback.ts/Comeback.svelte, drop the `'comeback'` View arm. No IndexedDB schema change (comeback positions derive from stored analyses on the fly), so no migration to undo.

## §11 Follow-up
- FSRS-track comeback positions so collapses resurface for spaced practice (the `srs/` layer is generic).
- Endgame/Repertoire deep-link focus (e.g., open the specific weak line) instead of plain navigation.
- "Missed-win" badge + filter in Tactics; a missed-win-only drill mode.
