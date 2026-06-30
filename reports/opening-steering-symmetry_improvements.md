# Improvements (/enrich) — `opening-steering-symmetry` (P4)

3 enrich cycles, 8-axis sweep. Verdicts: **FOLD** (into this spec) · **DEFER** (good, wrong PR/premature)
· **REJECT** (violates scope/causality). **Anti-fabrication:** the candidate set did **not** grow across
cycles; cycle 2–3 only pruned/confirmed. Empty axes are reported CLEAN, not padded.

## 8-axis sweep

| Axis | Finding | Verdict | Note |
|---|---|---|---|
| **Capability gap** | Steering silently no-ops for `(bot=Black, {tactics,endgameConversion})` and `(bot=White, resilience)` — the feature's headline fails for those players. | **FOLD** | This *is* the PR's core (§2/§4.1). Bidirectional, not Black-only. |
| **Robustness** | Length-0 `selectOpening` guard returns `OPENING_BOOK[0]` regardless of requested colour → wrong-colour entry → `nextBookMove` never fires (deeper silent no-op). | **FOLD** | §4.2 same-colour fallback; AP-STEER-3. |
| **Observability** | Union-coverage test hides per-colour holes; no test asserts steering actually engages per colour. | **FOLD** | §5.1/§5.3 per-colour × per-dim + non-degenerate-steering = the regression lock; AP-STEER-2. |
| **Fidelity (i18n)** | New opening names would fall back to English (parity break, ADR-0053). | **FOLD** | §4.3 `ECO_NAME_FR` + §5.6 parity test; AP-STEER-6. |
| **Symmetry** | The whole PR is a symmetry fix (both player colours). Also: bot-as-White resilience mirrors the existing scandi-b/philidor-b rationale for the other colour. | **FOLD** | Captured; `kingsGambitAccepted-w` is the mirror. |
| **Reuse / C7-friendliness** | `app.steerDimension` (Coach C7 "play-steered") already flows into `selectOpening`; completing the book makes that coach path work for either colour with no coach code here. | **FOLD (as constraint)** | §2 "Out" + AP-STEER-5: keep the book coach-agnostic; documents the free C7 win. |
| **Extensibility** | A CI/lint assertion generated from `Dimension × {'w','b'}` would make per-colour coverage a build-time guarantee for any future dimension. | **DEFER** | §11. Real value, but its own (tiny) change; not needed to close P4 and would widen the diff. |
| **Honest framing** | `steeringNote` is **English for all lines today**, not just the new ones — localizing it is an i18n concern owned by F1, not P4. | **DEFER** | §11 + §4.3 note. Pre-stage the FR names; don't expand P4 into steeringNote i18n. |

## Cross-cut candidates (swept, not folded)

| Candidate | Verdict | Reason |
|---|---|---|
| Add a 2nd tactical Black line + 2nd endgame Black line for richer variety | **DEFER** | §11. Only if play-testing shows repetition; weighting already preserves variety. Folding now = AP-STEER-7 (over-filling). |
| Numeric 10/10 colour parity in the book | **REJECT** | Scope creep; dilutes the ~3:1 weighting; coverage (not count symmetry) is the goal (Q-B). |
| Move `Math.random()` out of `Play.svelte:167` into a seedable per-game stream | **REJECT** | Out of scope (call-site/determinism concern); the core is already pure given `pick`. Belongs to a Play-determinism PR if ever wanted. |
| Make `selectOpening` weight scale with sample-size/confidence of the weakness | **REJECT** | Changes the steering *model* (AP-CHESS-22 surface), not the coverage gap; would alter behaviour for the working colour too. Not this concern. |
| Surface the chosen opening's `targets` in the in-game UI | **DEFER** | UX add owned by Play P2 (in-game UX); not a steering-coverage fix. |

## Net effect of folds

The folded items are exactly the spec's §4.1 (data), §4.2 (fallback), §4.3 (parity), §5 (per-colour
tests), and AP-STEER-1..7. No new capability beyond "make the existing feature actually work for both
colours, safely, with parity, and lock it with a test." Set did not grow; 3 DEFER → §11, 3 REJECT
documented. **CLEAN.**
