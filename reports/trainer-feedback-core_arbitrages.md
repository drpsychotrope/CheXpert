# trainer-feedback-core (T1) — Arbitrages + Refiner log

**Method**: `/draft-general` 4 refiner cycles. Defaults applied → V1. Diminishing-returns stop noted.
**Pre-V0 verdict**: PROCEED (5 premise corrections, none blocking — see `_collision.json`).

---

## Arbitrages (user ratifies; defaults are what V1 is written against)

| # | Question | Options | **Default (V1)** | Effort | Why |
|---|---|---|---|---|---|
| **Q-A** | Judge "equally/clearly winning" alt | (a) within X cp of mainline · (b) absolute winning floor · (c) both | **(c) both: mate OR (within 50cp of best AND ≥ +200cp for solver)**; flag `acceptAltWinning` default ON | MED | relative-only accepts "less bad" losing moves; absolute-only rejects quiet +0.3 tactics. Both = honest. Tunable in pure core. |
| **Q-B** | Second-try budget (TR6) | (a) 0 · (b) 1 · (c) configurable | **(b) 1, wrong move left visible, miss still recorded** | LOW | one forgiving look without gaming the rating; `mistakes≥1` ⇒ miss. |
| **Q-C** | Self-tag→actions | the 3, or more | **exactly 3** (`unfamiliar-pattern`→card, `rushed`→timed, `guess`/`unsure`+solved→grade≤Good) | LOW-MED | each maps 1:1 to an existing hook; others lack a clean single action → T3/defer. |
| **Q-D** | Reveal trigger | (a) auto · (b) opt-in toggle | **(b) opt-in** (inherits F4 Q-D) | LOW | auto would spoil the second try + Retry. |
| **Q-E** | Grade-clamp placement | (a) in gradeCard · (b) call-site wrap · (c) param on resultToGrade | **(b) pure `clampForConfidence(grade,confidence)`** | LOW | keeps gradeCard/resultToGrade single-purpose; composes with ADR-0033 first-exposure clamp. |
| **Q-F** | New ADR? | yes/no | **No** (reuse 0037/0010/0033/0040/0052/0053); allocate **0058** only if alt-move ratified architectural | — | feature-PR doctrine; alt-move semantics ("what counts as solving") is the one candidate — flag, don't pre-spend (0054-0057 reserved). |
| **Q-G** | i18n keys | — | new bilingual `tactics.*` (secondTry/altAccepted/checkingAlt/tryTimed/offerTimed/reactUnfamiliar) + `review.secondTry`; **reuse** F4 `reveal.*` + `tactics.learnPattern`/`openInLibrary` | LOW | one catalogue, per-locale complete (ADR-0052). |
| **Q-H** | Provenance flag on alt-accept | (a) no field · (b) additive `altAccepted?` | **(a) no field** (records `solved:true`); revisit in T3 if telemetry wants it | LOW | additive-optional doctrine; an alt is genuinely a solve. |

---

## Refiner cycles

### Cycle 1 — structural (load-bearing)
- **D1 (critical-adjacent):** PC-1 surfaced — `selfTag`/`confidence` are already captured+stored; TR3 is *react only*, not store. **Applied**: reframed §0/§2 to "react", removed any storage/capture work. Prevents re-building F3 work.
- **D2:** PC-3 — Review has no metacog UI. **Applied**: split scope (TR1+TR6 both surfaces; TR3 Tactics-only); added §2 OUT note; FOLD-3.
- **D3:** PC-5 — engine is async/serialized/throttle-prone; cannot replace `sameMove` synchronously. **Applied**: alt-accept is an async component step behind a **pure** decision; `TacticalTrainer` stays engine-free via `acceptUserMove`. AP-TFEED-6.
- Arbitrages crystallized: Q-A, Q-B, Q-D. (Highest leverage.)

### Cycle 2 — correctness + boundaries
- **D4:** PC-2 — `'guess'` is a `Confidence`, not a `selfTag`. **Applied**: clamp predicate = `confidence ∈ {guess, unsure}`; wording fixed across §0/§0.5/§2/§4.
- **D5 (engine sign/POV bug risk):** the alt-eval evaluates the position *after* the played move (opponent to move). Must compare **solver-POV** values and pass **`fullStrength:true`**. **Applied**: A4 made explicit (best line on the pre-move position, played line on the post-move position, sign-correct for Black); `acceptAltMove` takes White-POV numbers + `solver`; FOLD-6, AP-TFEED-3.
- **D6:** clamp placement — Q-E settled on a pure wrapper to avoid churning `gradeCard`/`resultToGrade`. **Applied** A1.
- Arbitrages: Q-C, Q-E, Q-G.

### Cycle 3 — purity, deps, schema (smaller)
- **D7 (dependency hygiene):** importing `Confidence` from `metacog` into `fsrs.ts` adds an `srs→metacog` edge. Verified **no cycle** (metacog→i18n only), but to keep `srs/` dependency-free, **`clampForConfidence` takes an inline `'sure'|'unsure'|'guess'` union** (mirrors `db.ts:47`'s inline union), not a `metacog` import. **Applied** A1 note.
- **D8 (schema):** confirmed Q-H — no new persisted field; alt-accept records `solved:true`; clamp is computed. **No `DB_VERSION`/`schemaRev`**. **Applied** §3, AP-TFEED-9.
- **D9 (ChessGame semantics):** `moveUci` mutates in place; alt-eval must clone (`new ChessGame(fenBefore).moveUci(uci)`), mirroring `finish`'s snapshot discipline. **Applied** A4.
- Arbitrages: Q-F (ADR), Q-H (flag). Genuine but smaller.

### Cycle 4 — wording/polish (returns < 10% → STOP)
- Tightened §4 ordering, §5 test list, §10 per-fold rollback. Confirmed retry budget is reversible via the constructor default (`retriesLeft:0` = today). No new arbitrage. **Refiner note: diminishing returns — stop at cycle 4.**

---

## Diminishing-returns note
Cycles 1-2 produced all load-bearing arbitrages (Q-A/B/C/D/E) + the two correctness fixes (POV sign, clamp predicate). Cycle 3 added dependency/schema hygiene (Q-F/H). Cycle 4 was wording only → stop.

## Open decisions for the user (ratify before build)
1. **Q-A constants** — accept `withinCp=50`, `winningFloorCp=200`? And `acceptAltWinning` default **ON**?
2. **Q-B** — second-try budget = **1** (vs 0/configurable)?
3. **Q-F** — keep **no new ADR** (note only), or pre-allocate **ADR-0058** for the alt-move "what counts as solving" decision?
4. **Build-order** — confirm **F4 + F3 are merged before T1 build** (drafting is unblocked; building is gated — §3 STOP gate).
5. **Engine budget** — `movetime` for the alt-check (latency vs accuracy); recommend a short fixed `movetime` with honest fall-through to miss on timeout.
