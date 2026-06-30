# Refiner cycles — game-session-controller (F6)

4 cycles on V0 → V1. Each finding: severity, evidence, resolution (APPLIED / NOTED). Diminishing returns tracked.

---

## Cycle 1 — structural correctness (highest leverage)

**C1-1 (CRITICAL → APPLIED): the core must NOT auto-chain player-move → engine-reply.**
Evidence: `Play.svelte:265-289`. `onMove` does `game.move` + fen/lastMove, then **`if (coached && bad) { coachOpen = true; return; }`** — it returns *before* committing, and `commitPlayerMove()` (separate) presses the clock then calls `engineMove`. So the player-move and engine-reply are two distinct steps with a *clock press* and an *optional coached interposition* between them. A fused `applyPlayerMove()` that internally calls `engineReply()` would break coached mode and clock timing.
Resolution: §4 A1 already separates the two methods; made the **no-auto-chain** contract explicit + added it to acceptance/anti-patterns. Caller orchestrates: `applyPlayerMove` → (component: coached gate + clock press) → `engineReply`. Added test #9.

**C1-2 (HIGH → APPLIED): `finishGame` idempotency (`gameFinished`) + flag path are NOT in the core's scope but the core must not double-fire terminal.**
Evidence: `Play.svelte:404-405` (`gameFinished` guard) + `onFlag` (clock) and `checkEnd` can both reach `finishGame` (audit W6). The core owns `checkTerminal()`; the *fold/persist* (`finishGame`) stays in Play. Risk: if the core emits a terminal result on both the player-move and engine-reply checks, Play could fold twice.
Resolution: clarified that the core's `checkTerminal()` is a **pure query** (idempotent, no side effects) and Play keeps its `gameFinished` guard around its own `finishGame`. Flag handling (clock) stays in Play (clock is Play-only). Noted in §4 + §2 OUT.

**C1-3 (MED → APPLIED): in-check is a *derived view value*, not core state.**
Evidence: the ADR-0051 `$derived` is in the component (`fen ? game.inCheck() : false`). The core shouldn't own a reactive `inCheck`; it should expose `inCheckFor(fen)`/`game.inCheck()` and let the component keep the `$derived` anchored on `fen`.
Resolution: §4 A1 exposes `inCheckFor`; §9 AP-CTRL-3 already forbids relying on in-place mutation. Made explicit the `$derived` stays in the component.

Cycle-1 defect density: 1 critical + 1 high + 1 med = **material**. Continue.

---

## Cycle 2 — contract / API shape

**C2-1 (MED → APPLIED): pin the return-state vs event-emitter decision.**
V0 left it "decide in build (recommend return-state)". For a refactor with no component test, an ambiguous core API is a risk.
Resolution: **pin return-state** (each method returns `{ status, fen, lastMove, terminal }` snapshot) as the spec default, matching `makeBoardState`. Build may deviate only with a noted reason. Moved from "recommend" to "decided (Q-G)".

**C2-2 (MED → APPLIED): movetime provider signature.**
V0 said `movetime?: (ctx)=>number` without ctx. Play needs `botMovetime(remainingMs, ply, category)`.
Resolution: typed the provider as `movetime?: (game, side) => number` so Play closes over clock+category; siblings omit it (→ fixed 500 default, preserving behaviour). Added to §4 A0.

**C2-3 (LOW → NOTED): naming `GameSession` vs `gameSessionController`.**
Resolution: module `gameSession.ts`, export `createGameSession`/`GameSession`. Cosmetic; build picks. Noted.

Cycle-2: 0 critical, 2 med, 1 low. Continue (still > 10% delta).

---

## Cycle 3 — test sufficiency & parity provability

**C3-1 (HIGH → APPLIED): add an explicit "Play behaviour parity" assertion strategy.**
Evidence: no component test exists (baseline). The 8 unit tests prove the *core*, but the spec must say how we trust *Play* didn't regress. Options: (a) snapshot the structured outputs of a scripted game through the core and assert Play's mapping is a thin pass-through; (b) manual smoke (already in §6).
Resolution: strengthened §6 with a **scripted-game parity** note: a deterministic game (fixed seed engine) run through the core produces the same move sequence/terminal as the pre-refactor Play path; combined with the static diff (siblings unchanged) + manual smoke. Did NOT over-promise an automated component test (would be fabrication of capability not in repo); kept honest.

**C3-2 (MED → APPLIED): assert no `Math.random`/`Date`/`performance.now` in the core via a test or lint note.**
Resolution: added acceptance check #1 wording + a test note: `gameSession.test.ts` runs the loop without faking timers/random (if it needs them, the core leaked impurity). Cheap, honest guard.

**C3-3 (LOW → NOTED): 960 path coverage.**
Play uses `fenForEngine()` for the engine in 960. The core takes the engine-fen via the `bookMove`/movetime/port boundary; a 960 parity test is a nice-to-have but Play's 960 is exercised in §6 smoke.
Resolution: NOTED as smoke-covered; a 960 unit case is OPTIONAL (don't inflate the set).

Cycle-3: 0 critical, 1 high, 1 med, 1 low. Delta shrinking (~ enrich-adjacent polish emerging).

---

## Cycle 4 — diminishing returns (polish only)

**C4-1 (LOW → APPLIED): clarify coached-takeback stays in Play but the core exposes an undo-safe step.**
The core's `applyPlayerMove` must be undoable by the component (Play `game.undo()` + `playedUci.pop()`). Since the core returns a snapshot and Play owns the `game`, undo already works. Added one line to §11 (fold coached gate later, YAGNI now).

**C4-2 (LOW → APPLIED): explicit ADR cross-links list.**
Tightened §7 ADR cross-links (W12, ADR-0050/0051, P1-14/P1-17).

**C4-3 (LOW → NOTED): consider exposing `pickHumanMove` rand injection for determinism.**
`AdaptiveOpponent.pickHumanMove` calls `Math.random()` internally. The core can't make it pure, but the engine **port** can be faked in tests (returns scripted moves), so determinism is achievable at the port boundary without touching AdaptiveOpponent. NOTED — no change needed; the port abstraction already solves it.

Cycle-4: 0 critical/high, 3 low — **diminishing returns reached** (delta < 10%, polish-only). **Stop at 4 (mandated count met).**

---

## Net changes V0 → V1
- Added **no-auto-chain** contract (C1-1) + test #9 + AP coverage.
- Clarified `checkTerminal` is a pure idempotent query; fold/persist + flag stay in Play (C1-2).
- In-check `$derived` stays in component; core exposes `inCheckFor` (C1-3).
- Pinned **return-state** API (Q-G) (C2-1); typed movetime provider `(game, side)=>number` (C2-2).
- Strengthened parity strategy honestly (scripted-game + diff + smoke; no fabricated component test) (C3-1).
- Purity guard via natural (un-faked) test run (C3-2).
- Polish: undo note, ADR cross-links (C4).

## Diminishing-returns curve
Cycle 1 (1 crit/1 high/1 med) → Cycle 2 (0/0/2 med) → Cycle 3 (0/1 high/1 med) → Cycle 4 (0/0/3 low). Critical defects front-loaded; by cycle 4 only cosmetic. Correct stop.
