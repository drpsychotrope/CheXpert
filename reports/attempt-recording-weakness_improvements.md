# Enrichment sweep — `attempt-recording-weakness` (F3)

`/enrich` 3 cycles. 8 axes. Verdict per finding: **FOLD** (into spec) / **DEFER** (good, wrong PR) /
**REJECT** (violates scope/causality). **Anti-fabrication: an empty axis is reported CLEAN; the FOLD set
does not grow across cycles.**

## Axis sweep

| Axis | Finding | Verdict | Note |
|---|---|---|---|
| **A1 Capability** | Record coach probes through the EXISTING path (not a new ad-hoc write) so they land in Review/FSRS like any solve. | **FOLD** | This is the core of CF1 — already in §4 A2. Reusing `recordTacticsAttempt` (not a parallel writer) is the capability win. |
| **A1 Capability** | `minCount` threshold so a single miss doesn't hijack the queue. | **FOLD** | §4 A1 (`minCount` default 2) + AP-ATTEMPT-4. Turns a raw counter into a usable signal. |
| **A2 Observability** | `coachProbe?: true` provenance flag on the attempt row so probe attempts are *distinguishable* from real solves in any later analysis/audit. | **FOLD** | §4 A2 + Q-E. Cheap, additive, prevents probe attempts from being silently miscounted as graded tactics later. |
| **A3 Fidelity** | Probe attempts carry honest `ratingBefore = ratingAfter = baseline` (no fake graded delta) so the attempt log doesn't imply a rating movement that didn't happen. | **FOLD** | §4 A2. Directional-honesty doctrine; avoids a misleading delta in the log. |
| **A4 Robustness** | Guaranteed fall-through when the biased `next()` returns null (biased theme exhausted in-zone) — never dead-end the loop. | **FOLD** | §4 A3 + AP-ATTEMPT-3. The selection read must degrade to plain curated. |
| **A4 Robustness** | Double-count guard: probe writes model in the atomic tx AND `commit()` reloads — assert the increment is counted once. | **FOLD** | §9 AP-ATTEMPT-6 + §5 test. Interaction with the existing I-1 reload dance. |
| **A5 Reuse** | Extract a PURE `weaknessSelect.ts` core (testable without IndexedDB/Svelte), mirroring `studyPlan.ts`/`fingerprint.ts` purity. | **FOLD** | §4 A1. Makes the bias unit-testable and reusable by T2 later. |
| **A6 Extensibility** | Keep the steer behind a `WeaknessSteer` shape (`themes`,`topTheme`,`k`) so T2 can extend k / surface the topTheme without reworking the core. | **FOLD** | §4 A1 signature. Forward seam for T2, no extra code now. |
| **A7 Symmetry** | Coach probe recording mirrors Tactics/Review exactly (same repo call, same weakness-increment-on-miss) — one recording contract across ALL solve surfaces. | **FOLD** | §0/§2/§4. The symmetry IS the foundation value: after F3, every puzzle-solving surface records identically. |
| **A8 Honest framing** | Fix the false `runAnalysis.ts:67-68` comment so the codebase stops asserting a read that doesn't exist. | **FOLD** | §4 A4. Doctrine: code comments must be empirically true. |
| **A2 Observability** | Surface `weaknessCounters` in a dashboard/insights panel. | **DEFER → T2** | F3 makes it *steer*, not *display*. A display surface is a user-facing feature (T2), needs i18n + layout. |
| **A1 Capability** | Self-tag→action: clamp FSRS grade on a self-diagnosed cause. | **DEFER → T1** | TR3, explicitly out of F3 single concern. |
| **A3 Fidelity** | Decay/recency weighting so stale misses fade from the steer. | **DEFER** | Needs a per-theme timestamp (schema/shape change). F3 keeps the plain counter; noted in §11. |
| **A4 Robustness** | Record probes for the endgame ladder phase as a distinct sub-type. | **DEFER → C2** | C2 owns endgame sub-types. F3 records `endgame` like today. |
| **A6 Extensibility** | Make the soft-bias weighting fully probabilistic (temperature-sampled) over all weak themes. | **REJECT (for F3)** | Probabilistic sampling needs an RNG seam (purity/testability cost) for marginal gain over top-k. Revisit only if T2 shows top-1 is too narrow. |
| **A5 Reuse** | Route coach probes through `runAnalysis` instead of `recordTacticsAttempt`. | **REJECT** | `runAnalysis` is a PGN→batch-analyse→generate-puzzles pipeline; a single probe is a solve, not a game. Wrong abstraction; would entangle probe recording with puzzle generation. |
| **A8 Honest framing** | Present steered selection to the user as "focusing on your weak spots". | **REJECT (for F3)** | Any user-facing copy is T2's surface; adding a string here breaks the "no new string" property and the single concern. |

## FOLD set (10 — all already reflected in spec V1)

1. (A1) Record probes via the **existing** `recordTacticsAttempt` path. — *capability/reuse*
2. (A1) `minCount ≥ 2` noise floor on the steer. — *capability*
3. (A2) `coachProbe?: true` provenance flag (additive, no schema bump). — *observability*
4. (A3) Honest `ratingBefore = ratingAfter = baseline` on probe rows. — *fidelity*
5. (A4) Guaranteed fall-through to plain curated when biased `next()` is null. — *robustness*
6. (A4) Double-count guard vs the `commit()` reload. — *robustness*
7. (A5) Pure `weaknessSelect.ts` core. — *reuse*
8. (A6) `WeaknessSteer` shape as a forward seam for T2. — *extensibility*
9. (A7) Symmetric recording contract across Coach/Tactics/Review. — *symmetry*
10. (A8) Fix the false `runAnalysis.ts` comment. — *honest framing*

## Cycle notes (anti-fabrication)

- **Cycle 1** — full 8-axis sweep produced the 10 FOLDs above + the DEFER/REJECT set. A2-display,
  A1-selftag, A6-probabilistic identified and parked.
- **Cycle 2** — re-swept; **no new FOLD** surfaced (FOLD set held at 10). Sharpened A4 (the double-count
  interaction with the I-1 reload) and A3 (honest non-delta) wording — refinements of existing FOLDs,
  not additions.
- **Cycle 3** — **no new FOLD**; axes A2(beyond provenance), A8(beyond comment fix) reported **CLEAN**
  for F3 (their further ideas are T2 surfaces). Confirmed the FOLD set did not grow → stop.

**Net**: enrichment did not expand scope; it hardened the recording contract (provenance, honesty,
double-count, fall-through) and locked the pure-core/seam discipline. The biggest single win is **A7
symmetry** — F3's whole reason to exist is one recording contract for every solve surface.
