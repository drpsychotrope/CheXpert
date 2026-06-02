# Refiner — metacognition · cycle 1 (critical premise + scope)

**Verdict: 0 critical defects.** Premise sound; additive, no-bump, opt-in. Proceed to cycle 2.

## Premise checks
- **Additive-no-bump premise holds.** Data-model contract is explicit: optional fields on
  `PuzzleAttemptRecord` need NO `DB_VERSION` bump; only a new object store bumps v4→v5, and this spec
  adds none. Spec keeps `DB_VERSION = 4` and codifies it as AP-META-7. ✔
- **Writer-site claim VERIFIED empirically.** Grep of `src` for `put('puzzleAttempts'`: the ONLY
  production writer is `Tactics.svelte:176`. `Review.svelte:139` only `getAll`s (for `buildMissesSet`);
  `Calculate.svelte` writes nothing. This is exactly what §1/§4/Q-C/AP-META-5 assert. The two "confirm
  during impl" hedges in §4 (Review) are now resolved facts → tighten in cycle 2. ✔
- **Doctrine alignment.** Descriptive-not-a-grade is the load-bearing constraint (AP-META-1), consistent
  with ADR-0007/0009/0027 and Insights' existing "Directional, not a grade" footnote. No LLM, pure core,
  no Date.now/Math.random — all honoured. ✔
- **Active-recall protection.** Opt-in master switch default-off + skippable chips + "never gate a move"
  (AP-META-4/8) directly protect the AP-CHESS-2 active-recall flow. ✔

## Scope finding
- Single concern; no sub-split (chips ⇄ readout are mutually dependent). §0.5 correct. One PR.
- **P1 (premise→precision):** the Review-writer question is settled (Review does NOT persist an attempt).
  The spec should state this as fact, not "confirm during impl," and make Review-chips-deferred the
  firm default (not conditional prose). → cycle 2 polish.
- **P2:** Calculate persisting an attempt (Q-C=a) is a *behaviour change* beyond "pure additive metadata"
  — it makes calc attempts count in Glicko/lapse-set/history for the first time. That's defensible
  (latent gap) but must be called out as a side effect in the ADR and acceptance, not smuggled in. →
  cycle 2.

## Carry to cycle 2
- Convert Review-writer hedges to asserted fact (grep-confirmed).
- Make the Calculate side-effect (attempts now logged) explicit in §8 acceptance + §7 ADR.
- Re-examine the `underconfident` verdict rule (is the `guess`-accuracy branch well-defined?).
