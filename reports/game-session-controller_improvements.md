# Enrichment sweep — game-session-controller (F6)

`/enrich` — 3 cycles, 8 axes. Verdicts: **FOLD** (into this PR), **DEFER** (good, wrong PR / premature), **REJECT**
(violates scope/causality/doctrine). **Anti-fabrication**: an axis with nothing real is marked **CLEAN** — the set is
not padded. This is a behaviour-preserving refactor, so most "capability" ideas are correctly DEFER (adding capability
≠ preserving behaviour).

Precedents cited are **this repo's** (audit-v2 W12 pure-home, ADR-0050/0051 reactivity, P1-14/P1-17 guards,
`board-reactivity` DOM-free harness, `playSession.ts` injection pattern).

---

## Cycle 1 — broad 8-axis sweep

### Axis 1 — Capability gap
- **E1 (DEFER)**: siblings could gain clock / humanMove / retry. — Exactly Q-B/Q-C; deferred to P3 + siblings
  fast-follow by design. Not folded (would be a behaviour change).
- **E2 (FOLD)**: the controller should accept a **`startFen`** in its init contract as a first-class parameter (C3/P3
  enabler), not an afterthought. *Already in §2/§4 but make it an explicit acceptance criterion + a dedicated test.*
  → folded (acceptance #6 + test #7 already present; confirmed kept).

### Axis 2 — Observability
- **E3 (DEFER)**: structured game-event log / move telemetry from the controller. — Useful for Coach analytics later,
  but no consumer exists in this PR and it would add surface beyond the refactor. Defer to C-stack.
- **CLEAN otherwise** — a refactor adds no new user-visible state to observe; existing `result`/`status` are preserved.

### Axis 3 — Render fidelity
- **E4 (FOLD)**: the ADR-0050/0051 reactivity contract (reassign `fen`; `$derived` stays in component) is the one
  rendering correctness risk of this refactor. *Make it a named acceptance + test (#6) rather than only an
  anti-pattern.* → folded (test #6 + AP-CTRL-3 present; promoted to acceptance wording).

### Axis 4 — Robustness
- **E5 (FOLD)**: carry the **P1-17** illegal-move halt and **P1-14** resign-during-think guard into the core
  *verbatim*, with explicit tests (#3, #4) — these are the silent-regression traps of an extraction. → folded
  (AP-CTRL-7 + tests #3/#4).
- **E6 (FOLD)**: `checkTerminal` must be **idempotent / side-effect-free** so Play's double-fire path (W6
  `gameFinished`) can't fold twice through the new code. → folded (C1-2 → AP-CTRL-9 + §4 wording).

### Axis 5 — Reuse
- **E7 (FOLD)**: the core must *consume* `playSession.ts` helpers (`botMovetime`/`flagOutcome`/`applyGameResult`) and
  `AdaptiveOpponent`, not re-implement them. → folded (§4 A0/A1 reference them explicitly; AP against re-impl implicit
  in single-concern scope).
- **E8 (DEFER)**: extract a shared `<GameBoard>` view wrapper too (the three `<Board>` blocks are similar). — That is a
  *view* dedup, a different concern from the *loop* dedup, and overlaps F2 (board input/a11y). Defer; flag the F2
  sequencing (already in collision report).

### Axis 6 — Extensibility
- **E9 (FOLD)**: expose capabilities as **opt-in config** (`humanMove`/`retry`/`bookMove`/`movetime`) with
  behaviour-preserving defaults, so P3/C3/siblings extend without forking the core. → folded (Q-C/Q-F, §4 A0 config).
- **E10 (DEFER)**: a generic "result grading" hook (Sparring `resultKind` good/bad, Comeback heldDraw) unified in the
  core. — The core already returns structured `{outcome,reason}`; the *grading→label* is a view concern. Unifying it
  is a sibling-migration nicety, not this PR. Defer to fast-follow.

### Axis 7 — Symmetry
- **E11 (DEFER)**: while extracting, also unify the two WEAK siblings (they are ~90% identical to each other). — That
  *is* the fast-follow (Q-D); doing it here breaks the Play-only blast-radius bound. Defer.
- **E12 (CLEAN)**: no asymmetry introduced by the refactor itself (Play keeps all its capabilities).

### Axis 8 — Honest framing
- **E13 (FOLD)**: the spec must **not** claim a Play component test it doesn't have. State plainly that parity is
  proven by (core unit tests + scripted-game equivalence + static sibling diff + manual smoke), because the baseline
  has **zero** component tests. → folded (§1 CRITICAL note + §6 scripted-parity "honest" wording + C3-1).
- **E14 (FOLD)**: name the ADR-numbering ambiguity (0054 vs 0055) honestly rather than asserting 0054. → folded (§0
  note).

Cycle-1 yield: **8 FOLD, 5 DEFER, 1 CLEAN** (across overlapping items). Most FOLDs were *promotions* of existing spec
content to named acceptance/tests (the right enrich move for a refactor — harden, don't expand).

---

## Cycle 2 — prune & de-duplicate (anti-fabrication pass)

Re-examined cycle-1 FOLDs for double-counting and fabrication:
- E2/E4/E5/E6/E7/E9/E13/E14 are **genuine** and now reflected in the spec. Several were *already present* in V1 (from
  the refiner) — enrich's contribution is promoting them to **named acceptance criteria + tests**, not inventing new
  scope. Net new spec scope from enrich = **0 new features** (correct for a refactor).
- **Rejected fabrications** (things an enrich pass might invent but must NOT):
  - **R1 (REJECT)**: "add a draw-offer / bot-resign hook to the controller now" — that's PL9/P3 capability, not the
    loop extraction. Causality/scope violation.
  - **R2 (REJECT)**: "make the core emit i18n-ready labels" — violates AP-CTRL-1 (labels stay in the component).
  - **R3 (REJECT)**: "bump observability with a persisted move log" — adds schema; violates the no-`DB_VERSION` doctrine.
  - **R4 (REJECT)**: "migrate siblings too, it's almost free" — violates Q-D blast-radius bound; the *absence* of
    component tests is exactly why we don't.
- DEFER set confirmed (E1, E3, E8, E10, E11) — all are real, all correctly belong to P3 / siblings fast-follow / C-stack.

Cycle-2 yield: **0 new FOLD**, 4 REJECT logged, DEFER set stable. Anti-fabrication holds — **the FOLD set did not grow**.

---

## Cycle 3 — conditional / final fold check

- Confirmed every FOLD is now in V1 (acceptance §8 #2/#3/#6, tests §5 #3/#4/#6/#7/#9 + purity guard, AP-CTRL-1/3/7/8/9,
  §0 ADR note, §1+§6 honesty). No orphan FOLD.
- No axis flipped from CLEAN to dirty on second look. Diminishing returns reached.
- **Final**: the enrich pass *hardened* the refactor (named the silent-regression traps, the reactivity contract, and
  the honesty about missing component tests) without adding feature scope — the correct outcome for a behaviour-
  preserving extraction.

---

## FOLD set (folded into V1) — count: 8
| # | Axis | One-line | Where folded |
|---|---|---|---|
| E2 | Capability gap | `startFen` is a first-class init param (C3/P3 enabler) | §8 #6, test §5 #7 |
| E4 | Render fidelity | ADR-0050/0051 reactivity contract as named acceptance + test | §5 #6, §8 #2, AP-CTRL-3 |
| E5 | Robustness | P1-17 illegal-halt + P1-14 resign-guard carried verbatim + tested | §5 #3/#4, AP-CTRL-7 |
| E6 | Robustness | `checkTerminal` pure/idempotent (no double-fold via W6 path) | §4, AP-CTRL-9 |
| E7 | Reuse | core consumes `playSession.ts` helpers + `AdaptiveOpponent` (no re-impl) | §4 A0/A1 |
| E9 | Extensibility | capabilities opt-in config, behaviour-preserving defaults | §0.5 Q-C/Q-F, §4 A0 |
| E13 | Honest framing | no fabricated component test; state real parity strategy | §1 CRITICAL, §6 |
| E14 | Honest framing | ADR 0054/0055 ambiguity named, not asserted | §0 note |

## DEFER set — count: 5
E1 (siblings clock/humanMove/retry → P3 + fast-follow) · E3 (controller telemetry → C-stack) · E8 (shared `<GameBoard>`
view wrapper → overlaps F2) · E10 (unified result-grading hook → siblings fast-follow) · E11 (unify the two WEAK
siblings → that *is* the Q-D fast-follow).

## REJECT set — count: 4
R1 (draw-offer/bot-resign hook → PL9/P3) · R2 (i18n labels in core → AP-CTRL-1) · R3 (persisted move log → `DB_VERSION`
doctrine) · R4 (migrate siblings now → Q-D blast-radius / no component tests).

## CLEAN axes
Observability (beyond deferred telemetry) and Symmetry-introduced are CLEAN — the refactor introduces no new
user-visible state and no new asymmetry. Not padded.

**Net**: enrich added **0 new feature scope** and **8 hardening folds** (mostly promotions to named acceptance/tests),
consistent with a behaviour-preserving refactor.
