# Spec — Shared game-session controller (Foundation F6)

**Type**: refactor (extraction, behaviour-preserving) · **PR**: `game-session-controller` · **ADR**: ADR-0054 (to draft; see §0 numbering note)
**Spec version**: V1 · **Drafted**: 2026-06-30 · **Method**: `/draft-general` (4 cycles) → `/enrich` (3 cycles)
**Parent**: `specs/enhancements-architecture-spec.md` §2 (F6) · **Folds**: PL6

> **Doctrine**: additive, **behaviour-preserving** refactor. Observable behaviour of Play (well-exercised) and
> of Sparring/Comeback must not change. Pure cores where possible (no `Date`/`Math.random` in logic). Single
> concern: extract the triplicated move/engine/end loop into one controller. **Code before docs.**

---

## §0 Context

Three play surfaces each reimplement the same game loop:

- `src/ui/Play.svelte` (666 ln) — the **STRONG** copy: clock, `pickHumanMove`/`pickMove` by style,
  `retryEngineMove`, opening-book steering, coached takeback, Chess960, rating-pool fold + persistence.
- `src/ui/Sparring.svelte` (173 ln) — **WEAK**: untimed, `pickMove(fen, 500)` only, no retry, no persistence;
  seeds from `Scenario.fen`.
- `src/ui/Comeback.svelte` (179 ln) — **WEAK**: untimed, `pickMove(fen, 500)` only, no retry, no persistence;
  seeds from `ComebackPosition.fen`.

All three independently reimplement: `turnColor()`, the **ADR-0051** in-check `$derived` *and its 4-line comment
verbatim*, `onMove → checkEnd → engineMove → checkEnd`, the illegal-engine-move halt (P1-17), the
resign-during-think guard (`(status as string) === 'over'`, P1-14), and `resign()`. Sparring and Comeback loops
are ~90% identical to **each other** (differ only by i18n prefix, seed source, `playerSide` source, draw label).

`src/game/playSession.ts` (50 ln) is **pure helpers only** (`botMovetime`, `flagOutcome`, `applyGameResult`,
`BUDGET_BOUNDS`) — audit-v2 **W12**'s "pure home", but the stateful loop never moved out. This PR completes W12:
extract the stateful loop into a controller that *consumes* those pure helpers.

**Why now / downstream**: F6 unblocks **C3** (Coach designed-position probes) and **P3** (opponent agency). The
controller must therefore **accept a starting FEN** — already trivially satisfiable: Sparring/Comeback both seed
`new ChessGame(fen)` today, and `Scenario`/`ComebackPosition` both carry `fen` + a side field.

**ADR numbering note**: `enhancements-architecture-spec.md` reserves ADR-0054 for the architecture decomposition.
If that lands first, this PR is **ADR-0055**. Resolve at PR time (`session-wrapup`); non-blocking for the spec.

---

## §0.5 Arbitrages (resolved → applied to V1)

| Q | Question | Options | **Default (applied)** |
|---|---|---|---|
| **Q-A** | Extraction depth | (a) shared pure helpers only; (b) **controller module owning game+engine+end loop**, components keep their view | **(b)** controller owns the loop; components keep view + DOM/clock. Land incrementally. |
| **Q-B** | Do siblings gain a clock? | (a) yes; (b) **clock optional, off by default** | **(b)** clock is an optional capability; Sparring/Comeback stay clockless (behaviour preserved). |
| **Q-C** | Do siblings gain `pickHumanMove` + retry now? | (a) yes (behaviour change); (b) **preserve; expose as opt-in flags, adoption DEFERRED** | **(b)** preserve current behaviour; expose `humanMove`/`retry` as opt-in config, default off; actual adoption deferred to P3/Sparring PRs. |
| **Q-D** | Migrate all three now? | (a) all at once; (b) **extract + migrate Play (parity-tested) now; siblings fast-follow** | **(b)** Play-only migration this PR to bound blast radius; Sparring/Comeback in a fast-follow. |
| **Q-E** | Where does the module live? | (a) extend `playSession.ts`; (b) **new `src/game/gameSession.ts` sibling** | **(b)** new sibling keeps pure (`playSession`) vs stateful (`gameSession`) legible; controller imports the helpers. |
| **Q-F** | What does the core depend on? | (a) imports engine/clock directly; (b) **injected ports (engine adapter + movetime/now providers)** | **(b)** dependency-injected so the core is DOM-free and unit-testable; the Svelte component wires real engine/rAF. |
| **Q-G** | Core API shape | (a) event-emitter; (b) **return-state (each method returns a view snapshot)** | **(b)** return-state, mirroring `makeBoardState` (`board-reactivity`); the **caller orchestrates** steps (no auto-chaining player-move → engine-reply — coached mode + clock press must interpose). |

Full reasoning: `reports/game-session-controller_arbitrages.md`.

---

## §1 Baseline (measured — see `reports/game-session-controller_baseline.json`)

- **Component sizes**: Play 666 / Sparring 173 / Comeback 179 ln (1018 total).
- **Duplicated loop surface**: `turnColor`, in-check `$derived` + 4-line ADR-0051 comment (byte-identical ×3),
  `onMove`, `engineMove`, `checkEnd`, `resign`, illegal-move halt, resign-during-think guard — reimplemented in
  all three. ~55–70 ln of near-verbatim loop per WEAK sibling.
- **Capability matrix** (clock / humanMove / retry / book / coached / 960 / persistence): **Play = all true**;
  **Sparring & Comeback = all false** (each only `illegal-halt` + `resign-during-think` guard true).
- **Pure helpers** already exist (`playSession.ts`); `AdaptiveOpponent.pickHumanMove` uses `Math.random`
  (impure → injected), clock uses `performance.now` (Play only → injected/owned by component).
- **CRITICAL — no component tests**: `grep 'Play.svelte|mount(|render(' *.test.ts` → **0 matches**. The loop has
  **no** component-level behaviour test. Existing coverage: `playSession.test.ts` (pure helpers),
  `board-reactivity.test.ts` (ADR-0051 via DOM-free `makeBoardState`), `AdaptiveOpponent.test.ts`.

> **Decisive constraint**: parity **cannot** lean on existing component tests. The loop must be extracted into a
> **DOM-free, unit-testable controller core** so behaviour parity is *provable* before Play is rewired.

---

## §2 Scope (single concern)

**IN** — Extract the move/engine/end loop into one controller (`src/game/gameSession.ts`), DOM-free and
injection-based, consuming `playSession.ts` helpers + `AdaptiveOpponent`. Migrate **Play only** onto it with
behaviour parity. Add parity unit tests for the controller core. Accept a starting FEN (C3/P3 enabler). Expose
clock/humanMove/retry/book as **optional config, defaulted to preserve each caller's current behaviour**.

**OUT** —
- Migrating Sparring/Comeback (fast-follow PR; Q-D).
- *Adopting* any new capability in any component (clock for siblings, humanMove/retry for siblings) — Q-B/Q-C: capability is *exposed*, not *switched on*.
- Coached-takeback logic (Play view concern — stays in Play; the controller exposes the hook points it needs: a pre-commit eval gate + an undo).
- `<Board>` markup / `onMoveText` / a11y (that is F2 — do not add `onMoveText` to siblings here).
- i18n keys (F1 — refactor adds no strings; all result strings already routed via `t()`).
- Persistence/rating changes (Play's `finishGame` fold + its `gameFinished` idempotency guard stay Play's adapter; F5 owns reads).
- Clock flag resolution / rAF loop (Play-only; `onFlag` + the rAF tick stay in Play — clock is a Play capability, Q-B).
- Any `DB_VERSION` / schema change.

---

## §3 Pre-flight

1. `npm test` green at HEAD (capture baseline pass count).
2. `svelte-check` → 0 errors at HEAD.
3. `npm run build` green at HEAD.
4. Confirm reuse hooks (done in scan): `playSession.ts` helpers, `AdaptiveOpponent.{pickMove,pickHumanMove,applyStrength}`, `EngineClient.{evaluate,interrupt}`, `ChessGame.{move,moveUci,terminal,inCheck,dests,fen,turn,fenForEngine}`.
5. Re-confirm ADR number free (latest = ADR-0053; resolve 0054/0055 per §0 note).
6. Branch off `main`.

---

## §4 Phase A — CODE FIRST

**A0 — Define the controller core** (`src/game/gameSession.ts`, new):
- A `GameSession` (factory `createGameSession`) holding `{ game: ChessGame, status, lastMove }`-shaped state **without
  Svelte runes** — plain fields + explicit getters. **API shape = return-state (Q-G)**: each mutating method returns a
  fresh view snapshot `{ status, fen, lastMove, terminal }`; the component owns the `$state` mirror and **reassigns
  `fen`** from the snapshot to honour ADR-0050/0051. The in-check `$derived` **stays in the component** (anchored on
  `fen`); the core only exposes `inCheckFor(fen)` (C1-3).
- **No auto-chain (Q-G, C1-1)**: `applyPlayerMove` does **not** internally call `engineReply`. The caller orchestrates:
  `applyPlayerMove` → (component: coached gate + clock press) → `engineReply`. This is load-bearing — Play's coached
  takeback (`Play.svelte:277-281`) interposes between the two, and the clock press happens between them.
- **Init contract**: `createGameSession({ startFen, playerSide, engine (port), opponent, config })` where `config`
  carries the optional capabilities (Q-B/Q-C/Q-F): `{ humanMove?: boolean, retry?: boolean,
  bookMove?: (playedUci: string[]) => string | null, movetime?: (game, side) => number }`. Defaults reproduce each
  caller's current behaviour (siblings: `humanMove`/`retry` absent → `pickMove`, no retry; `movetime` absent → 500).
- **Ports (Q-F)**: engine access via a small interface (`pickMove`, `pickHumanMove`, `interrupt`) so the core never
  imports the worker; movetime via the injected provider (no `performance.now`/`Math.random` in the core).

**A1 — Move the loop into the core** (behaviour-preserving):
- `applyPlayerMove(from,to,promo)` — validate turn + `game.move`; on success return a snapshot with reassigned fen +
  lastMove; sets `terminal` if the player's move ended the game. **Does not** call `engineReply` (C1-1).
- `engineReply()` — book-move-first (if `bookMove` provided) else movetime-budgeted `pickHumanMove`/`pickMove` by the
  `humanMove` flag; illegal-move halt (**P1-17**, verbatim); resign-during-think guard (**P1-14**, verbatim); on throw
  → if `retry` enabled set an error state, else surface as today (siblings).
- `checkTerminal()` — a **pure, idempotent query** over `game.terminal()` returning structured
  `{ over, reason, winner, outcome }` — **never** a localized string (AP-CTRL-1) and **no side effects** (Play keeps
  its own `gameFinished` guard + `finishGame` fold/persist; calling `checkTerminal` twice is safe — C1-2).
- `resign()`, `turn`, `inCheckFor(fen)` helpers.

**A2 — Rewire Play onto the controller**:
- Replace Play's inline `onMove`/`engineMove`/`checkEnd`/`turnColor`/in-check `$derived` with controller calls; keep
  Play's `$state` (`fen`, `status`, `result`, `lastMove`), clock rAF loop, coached-takeback UI, 960 routing,
  `finishGame` rating fold + `putGame` persistence, and the `result` string mapping (Play passes the core's
  structured terminal result through `t()`).
- Play supplies `config`: `clock` budget via `botMovetime`, `humanMove` per `opponentStyle`, `retry: true`,
  `bookMove` via `nextBookMove`, 960 fen via `fenForEngine`. **Net observable behaviour unchanged.**

**A3 — Keep siblings as-is** (Q-D): Sparring/Comeback untouched this PR (their migration is the fast-follow). The
controller's defaults are chosen so the fast-follow is a thin swap with no behaviour change.

---

## §5 Tests

New `src/game/gameSession.test.ts` (DOM-free, mirrors `playSession.test.ts` + `board-reactivity.test.ts`):
1. **Loop parity (engine style)**: with an injected fake engine returning a scripted move, `applyPlayerMove` →
   `engineReply` advances the board exactly as the old Sparring/Comeback path did (pickMove, fixed movetime).
2. **Loop parity (human style + clock)**: with `humanMove:true` + a movetime provider, calls `pickHumanMove` with the
   budgeted movetime (reproduces Play's branch); assert the engine port receives the expected args.
3. **Illegal engine move halt** (P1-17): fake engine returns an illegal uci → status `over`, no phantom move, fen
   unchanged.
4. **Resign-during-think guard** (P1-14): resign while `engineReply` is in flight → the late move is dropped, status
   stays `over`.
5. **Terminal mapping**: checkmate (player winner / loser), draw reasons → correct `{outcome}` (no localized string in
   the core).
6. **ADR-0051 fen reassignment**: every move returns a *new* fen snapshot (the core never relies on in-place mutation
   being observed) — guards the reactivity contract Play depends on.
7. **startFen seeding** (C3 enabler): init with a non-start FEN → first turn/side correct.
8. **Retry opt-in**: `retry:true` → engine throw sets an error state (no fallback move); `retry:false` (sibling
   default) → throw surfaces as today (no retry state). Confirms behaviour preservation.
9. **No auto-chain** (C1-1): `applyPlayerMove` advances exactly one ply and does **not** trigger an engine reply on its
   own (assert the engine port is *not* called by `applyPlayerMove`); `engineReply` is a separate explicit step.
   Guards Play's coached-takeback interposition + clock-press ordering.

**Purity guard** (C3-2): `gameSession.test.ts` exercises the full loop **without faking timers or `Math.random`**. If a
test needs `vi.useFakeTimers()`/seeded random to pass, the core leaked impurity (`performance.now`/`Date`/`Math.random`)
and must be fixed — determinism comes from the faked **engine port** (scripted moves), not from patching globals.

Regression: existing `playSession.test.ts`, `board-reactivity.test.ts`, `AdaptiveOpponent.test.ts` stay green.

---

## §6 Verification

- `npm test` — all green; new `gameSession.test.ts` passing; **no drop** vs §3 baseline count.
- `svelte-check` — 0 errors (Play rewired, types intact).
- `npm run build` — green.
- **Scripted-game parity (core)** (C3-1, honest): run a deterministic game through the core with a faked engine port
  returning a scripted move sequence; assert the resulting move list + terminal `{outcome,reason,winner}` match the
  pre-refactor Play path's logic for the same script. This is the *automatable* parity evidence (there is no existing
  component test to lean on — baseline). It does **not** claim to mount Play; it proves the extracted loop is
  equivalent.
- **Manual parity smoke (Play)**: play a standard timed game (human style) to mate/resign/flag; a 960 game; trigger an
  engine error → Retry works; coached-mode takeback still pauses non-blockingly. Confirm clock, steering note, rating
  update, post-game analysis all behave as before.
- **Static parity diff**: confirm Sparring/Comeback are byte-unchanged (`git diff` empty for those files).

---

## §7 Docs (LAST)

- `decisions.md`: append **ADR-0054** (or 0055 per §0) — "Shared game-session controller: extract the triplicated
  move/engine/end loop into `src/game/gameSession.ts` (DOM-free, injected ports); Play migrated with parity; siblings
  fast-follow; capabilities exposed opt-in (clock/humanMove/retry off by default)". Cross-link W12 (pure home),
  ADR-0050/0051 (reactivity contract the core preserves), P1-14/P1-17 (guards carried over).
- Brief note in the architecture spec F6 row: status → drafted/landed (Play migrated; siblings fast-follow).
- No README/user-facing docs (internal refactor).

---

## §8 Acceptance

1. `src/game/gameSession.ts` exists; DOM-free; no `Date`/`Math.random`/`performance.now` in the core (injected).
2. Play uses the controller for the move/engine/end loop; Play's observable behaviour is unchanged (§6 scripted parity
   + smoke + diff). `applyPlayerMove` and `engineReply` are separate steps (no auto-chain); `checkTerminal` is pure.
3. `gameSession.test.ts` covers the 9 cases in §5 (incl. no-auto-chain) + the purity guard; all green; total test
   count ≥ baseline.
4. `svelte-check` 0 errors; `npm run build` green.
5. Sparring/Comeback unchanged (git diff empty).
6. Controller accepts `startFen` (C3/P3 enabler) and exposes clock/humanMove/retry/book as opt-in config defaulted to
   preserve current behaviour.
7. No `DB_VERSION`/schema change; no new i18n keys.
8. ADR appended.

---

## §9 Anti-patterns (AP-CTRL-*)

- **AP-CTRL-1** — Localized strings in the core. The controller returns structured terminal results
  (`{over,reason,winner,outcome}`); **never** a `t()` string. Labels stay in the component.
- **AP-CTRL-2** — Importing the engine worker / `performance.now` / `Math.random` into the core. Use injected ports.
- **AP-CTRL-3** — Relying on in-place `ChessGame` mutation being observed by callers (breaks ADR-0050/0051). Always
  return a fresh fen snapshot; the component reassigns `fen`.
- **AP-CTRL-4** — Silently *enabling* a capability on a caller (giving Sparring a clock, or humanMove/retry) under the
  banner of "shared controller". Capabilities are opt-in; defaults preserve behaviour (Q-B/Q-C).
- **AP-CTRL-5** — Scope creep into F2 (`onMoveText`/a11y on siblings), F5 (persistence reads), or F1 (i18n). This PR is
  the loop extraction + Play migration only.
- **AP-CTRL-6** — Migrating all three at once (Q-D) and inflating blast radius beyond Play in this PR.
- **AP-CTRL-7** — Dropping a guard in extraction: the illegal-move halt (P1-17) and resign-during-think guard (P1-14)
  must survive verbatim in the core.
- **AP-CTRL-8** — Auto-chaining `applyPlayerMove` → `engineReply` inside the core (C1-1). The caller orchestrates the
  two steps so coached-takeback and the clock press can interpose; fusing them silently breaks Play's coached mode.
- **AP-CTRL-9** — Side effects in `checkTerminal` (rating fold, persistence, flag handling). It is a pure idempotent
  query; the fold/persist stays in Play behind its `gameFinished` guard.

---

## §10 Rollback

Single-module + single-component change. Rollback = revert the PR commit: `gameSession.ts` is deleted and Play returns
to its inline loop. No data/schema migration to unwind (pure refactor). Siblings never changed, so they are unaffected
either way. The controller is behind no flag, but because siblings are not migrated, a defect is contained to Play and
revert is clean.

---

## §11 Follow-up

- **Fast-follow PR** (`game-session-controller-siblings`): migrate Sparring + Comeback onto the controller (Q-D) —
  thin swap, defaults preserve behaviour; the two WEAK copies collapse into config of the same core.
- **P3** (opponent agency): adopt humanMove/retry/clock options on the relevant surfaces (the opt-in flags this PR
  exposes).
- **C3** (Coach designed-position probes): consume the controller with a seeded `startFen` for conversion/resilience
  probes.
- Consider folding Play's coached-takeback into the controller as an optional pre-commit gate once a second caller
  needs it (YAGNI until then — kept in Play now).
