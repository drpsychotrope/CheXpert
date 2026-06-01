# Spec — `comeback` (loop-closers 3c)

**Scope:** feature · **Status:** V1 (decisions accepted) · **Date:** 2026-06-01
Split from [loop-closers-spec.md](loop-closers-spec.md) per accepted Q-A=a. The large new surface.

## Decisions baked (accepted defaults)
- Q-C grading: **outcome vs the adaptive bot** (draw/win = held = pass; loss = fail). No eval probes.
- Q-D access: reachable from the **Dashboard resilience Drill** (no new top-nav button).

## UX directive applied
One-click, in-app: the resilience Drill opens Comeback directly; positions come from **your own games**
(played in-app via `played-game-review`, or imported) — no external manipulation. Top-nav stays
uncluttered, but the Drill button is always visible and clearly labelled ("Defend & recover").

## §0 Context
`resilience` = recovery after falling behind. `resilienceScore` ([weakness.ts](../src/analysis/weakness.ts))
detects behind-episodes (player cp ≤ −200 → recovered ≥ −100) but discards the entry position. Comeback
replays those collapses vs the **adaptive** opponent (your ZPD Elo), so the drill is winnable/holdable
and instructive — not "defend −3 vs perfect play".

## §1 Baseline
`AdaptiveOpponent.pickMove(fen,movetime)` + ZPD Elo from `model.opponentTargetElo`. Play/Endgames already
implement a Board + `onMove` vs-engine loop to reuse. Comeback positions derive from stored `gameAnalyses`
on the fly (`loadAllAnalyses`) → **no IndexedDB migration**. 135 tests. AP-CHESS 40/41/43; ADR-0025.

## §2 Scope
**In:** `comebackPositions(analyses)` selector; `Comeback.svelte` view; `'comeback'` in the `View` union + App.svelte route; resilience→comeback wiring (with `drill-routing`).
**Out:** FSRS-tracking comeback positions (§11); eval-recovery grading (Q-C deferred variant).

## §3 Pre-flight gates
1. `AdaptiveOpponent.pickMove` available; `model.opponentTargetElo` readable.
2. `loadAllAnalyses()` returns `GameAnalysis[]` with per-ply White-POV cp.
3. `View` union + App.svelte routing editable without breaking nav.
4. 135 tests green.

## §4 Phase A
### `src/analysis/comeback.ts` (new selector)
- Scan **player** plies; at the first ply where `playerCp ≤ −200` (player-POV), emit
  `{ fen: ply.fenBefore, gameId, ply, playerColor, cpAtEntry }` — player to move, losing-but-playable.
- Filter out hopeless dips (`cpAtEntry ≤ −900` or forced-mate-against) so the drill is winnable (AP-CHESS-40). Dedup; most-recent first.
### `Comeback.svelte` (new view)
- On mount: `loadAllAnalyses()` → `comebackPositions` → pick a few in the player's zone.
- For each: play from the FEN vs `AdaptiveOpponent` at `model.opponentTargetElo` (**not** full strength, AP-CHESS-41), reusing the Play/Endgames Board + `onMove` loop.
- **Grade on outcome** (Q-C=a): reach a draw or win = held = pass; loss = fail. Show "you actually scored X here — hold it now." Keep the honesty framing (practice, not a proven method — AP-CHESS-43).
### Wiring
- Add `'comeback'` to the `View` union (app.svelte.ts) + a route arm in [App.svelte](../src/ui/App.svelte). Entry is the Dashboard resilience Drill (Q-D=a); no top-nav button.

## §5 Phase B — tests (`comeback.test.ts`)
- `comebackPositions` returns the correct entry FEN/ply for a synthetic analysis with a −200 dip; player-to-move only; excludes hopeless dips; empty when never behind.
- (Engine loop = manual verification.)

## §6 Verification
Manual: resilience Drill → Comeback opens; a real losing position from your games loads; playing vs the adaptive bot to a hold = pass; nav unaffected. `npm test` + `svelte-check` green.

## §7 Phase Z
ADR-0025 (comeback drills; outcome-graded vs adaptive bot). README "Train & retain" adds comeback drills (plausible-not-proven framing).

## §8 Acceptance
Comeback view loads real player-to-move losing positions (winnable band), plays them vs the **adaptive** opponent, outcome-graded; reachable in one click from the Dashboard; `'comeback'` added without breaking nav; tests green.

## §9 Anti-patterns
- **AP-CHESS-40** — position not player-to-move, or hopeless-by-design presented as failure (demoralising).
- **AP-CHESS-41** — graded vs full-strength engine instead of ZPD Elo.
- **AP-CHESS-43** — over-claiming efficacy; keep the honesty framing.

## §10 Rollback
Delete comeback.ts/Comeback.svelte, drop the `'comeback'` View arm + the resilience route (falls back to Endgames). No migration (positions derive from stored analyses).
