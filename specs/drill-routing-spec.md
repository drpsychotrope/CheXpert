# Spec — `drill-routing` (loop-closers 3b)

**Scope:** feature · **Status:** V1 (decisions accepted) · **Date:** 2026-06-01
Split from [loop-closers-spec.md](loop-closers-spec.md) per accepted Q-A=a.

## UX directive applied
Every radar dimension gets a **one-click, in-app** Drill button to the right view — no external steps.

## §0 Context
[Dashboard.svelte](../src/ui/Dashboard.svelte) routes **all** weak dimensions to Tactics (opening/endgame
mis-routed via theme filters), and `timeManagement`/`resilience` render **no** button (`dimThemes[d].length===0`).
Fix: per-dimension targets; a button on every dimension.

## §1 Baseline
`drill()` sets `app.tacticsFilterThemes` then `go('tactics')`; `app.go(view)` is param-less; context
passes via app-state fields. 135 tests. AP-CHESS 42/39; ADR-0024.

## §2 Scope
**In:** dimension→target map; Drill button on every dimension; `app.tacticsTimed` state; timed Tactics mode.
**Out:** the `comeback` view itself (that's the `comeback` spec; here `resilience` routes to it, with an Endgames fallback if comeback isn't shipped yet).

## §3 Pre-flight gates
1. `tacticsFilterThemes` pattern intact; `View` union editable.
2. Repertoire + Endgames views exist and load standalone.
3. Tactics.svelte `finish()`/FSRS path unchanged.
4. 135 tests green.

## §4 Phase A
### Dashboard.svelte + app.svelte.ts
Replace `dimThemes`/`drill()` with a target map:
| Dimension | Action |
|---|---|
| `tactics` | `tacticsFilterThemes = [...]; go('tactics')` (richer once `motif-detectors` lands) |
| `openingAccuracy` | `go('repertoire')` |
| `endgameConversion` | `go('endgames')` |
| `timeManagement` | `tacticsTimed = true; go('tactics')` |
| `resilience` | `go('comeback')` (fallback `go('endgames')` if comeback not shipped) |
- New state: `app.tacticsTimed = $state(false)`. Render a Drill button on **every** dimension row (drop the `length>0` gate); label it clearly (e.g. "Drill", resilience → "Defend & recover").
### Tactics.svelte (timed mode)
- When `app.tacticsTimed`, run a per-puzzle countdown; timeout = `wrong`/fail (grade as a miss via the existing `finish(false)` — no double-grade, AP-CHESS-39). Stop the timer on solve/leave.
- `clearDrill()` also resets `app.tacticsTimed = false` (mirror `tacticsFilterThemes`) so timed mode never leaks into normal play.

## §5 Phase B — tests
- Pure `drillTarget(dim)` map function unit-tested: opening→repertoire, endgame→endgames, time→tactics+timed, tactics→tactics, resilience→comeback.
- Timer logic (countdown → fail) covered by a small unit on the helper; component manual.

## §6 Verification
Manual: each dimension shows a Drill button landing on the correct view; time drill counts down and fails on timeout; "clear" resets timed mode. `npm test` + `svelte-check` green.

## §7 Phase Z
ADR-0024 (per-dimension drill routing; fixes all-to-Tactics). README "weakness dashboard": every dimension is one-click drillable.

## §8 Acceptance
Every dimension drillable to the right view in one click; timed Tactics fails on timeout and resets on clear; routing no longer dumps opening/endgame into Tactics; tests green.

## §9 Anti-patterns
- **AP-CHESS-42** — routing opening/endgame back into Tactics (the bug this fixes).
- **AP-CHESS-39** — `tacticsTimed` left stuck on; must reset on clear and not double-grade with FSRS `finish()`.

## §10 Rollback
Revert Dashboard.svelte + the `tacticsTimed` field + Tactics timer block; routing reverts to all-Tactics.
