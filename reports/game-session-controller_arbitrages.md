# Arbitrages — game-session-controller (F6)

User-facing decisions bundle. Each has a **recommended default (already applied to V1)**; flag any you want changed.

---

## Q-A — Extraction depth
**Options**: (a) shared pure helpers only; (b) a controller module owning the game+engine+end loop, components keep their view.
**Default (applied): (b)** — a `gameSession` controller owns the loop; components keep their `<Board>` view + DOM/clock. Land incrementally (Play now).
**Why**: pure-helpers-only (a) leaves the triplication intact (the loop *orchestration* is what's duplicated, not the helpers — those already live in `playSession.ts`). (b) is the only option that removes the duplication PL6 targets.

## Q-B — Do Sparring/Comeback gain a clock?
**Options**: (a) yes (inherit clock); (b) clock optional, off by default.
**Default (applied): (b)** — clock stays a Play-only capability; siblings remain clockless. The rAF/flag loop stays in Play (not in the core).
**Why doctrine**: behaviour-preserving refactor — giving siblings a clock is a behaviour change, out of scope. Exposed as opt-in for later.

## Q-C — Do siblings gain human-move sampling + retry now?
**Options**: (a) yes now (behaviour change / arguable improvement); (b) preserve behaviour, expose as opt-in flags, adoption deferred.
**Default (applied): (b)** — `humanMove`/`retry` are config flags defaulted off; siblings keep `pickMove(fen,500)` + no retry. Adoption deferred to P3 / the siblings fast-follow.
**Why**: keeps this PR a pure refactor; the capability becomes available without changing observable play.

## Q-D — Migrate all three at once, or Play first?
**Options**: (a) all three this PR; (b) extract + migrate Play (parity-tested) now; Sparring/Comeback fast-follow.
**Default (applied): (b)** — Play-only migration bounds blast radius. Siblings are byte-unchanged this PR; their migration is a thin follow-up.
**Why**: Play is the strong superset and the riskiest; proving the core against Play first de-risks the (trivial) sibling swap. Critical given **there is no component test** to catch a sibling regression.

## Q-E — Module location
**Options**: (a) extend `playSession.ts`; (b) new `src/game/gameSession.ts` sibling.
**Default (applied): (b)** — new sibling. `playSession.ts` stays the *pure-helper* home (W12); `gameSession.ts` is the *stateful* controller and imports the helpers.
**Why**: keeps the pure/stateful boundary legible; avoids bloating the pure module that other code imports.

## Q-F — What does the core depend on?
**Options**: (a) imports the engine worker / clock directly; (b) injected ports (engine adapter + movetime provider).
**Default (applied): (b)** — injected ports; the core never imports the worker, `performance.now`, or `Math.random`.
**Why**: makes the core DOM-free and unit-testable (the only way to get *provable* parity given no component tests). Determinism in tests comes from a faked engine port, not patched globals.

## Q-G — Core API shape  *(added in refiner cycle 2)*
**Options**: (a) event-emitter; (b) return-state (each method returns a view snapshot), caller orchestrates.
**Default (applied): (b)** — return-state mirroring `makeBoardState`; the caller orchestrates steps. Crucially, **`applyPlayerMove` does NOT auto-call `engineReply`** — Play's coached takeback + the clock press interpose between them.
**Why**: matches the existing tested reactivity pattern; the no-auto-chain rule is load-bearing for Play's coached mode and clock timing (discovered reading `Play.svelte:265-289`).

---

## Cross-cutting decisions baked in
- **ADR number**: ADR-0054, *unless* the architecture spec's ADR-0054 lands first → then ADR-0055. Resolve at PR time.
- **No `DB_VERSION` / schema / i18n change** — pure refactor; all result strings already routed via `t()`.
- **Guards carried verbatim**: illegal-engine-move halt (P1-17) + resign-during-think (P1-14) live in the core.
- **`checkTerminal` is pure/idempotent**; Play keeps its `gameFinished` fold guard + `finishGame` persistence.

## What to ratify
If you accept all defaults (a→b across the board), the PR is: *extract `gameSession.ts` (DOM-free, return-state,
injected ports), migrate Play with parity tests, expose clock/humanMove/retry/book opt-in (off), defer siblings.*
The only judgement calls worth a second look are **Q-D** (Play-first vs all-three — affects fast-follow count) and
**Q-C** (whether you'd rather siblings adopt humanMove now as an improvement — but that breaks the refactor's
behaviour-preservation doctrine, so it's recommended as a separate feature decision in P3).
