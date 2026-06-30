# Arbitrages — `opening-steering-symmetry` (P4)

Pre-V0 scan PASS. Drafted 2026-06-30. 4 refiner cycles run; diminishing returns noted at cycle 3.
Defaults below are **recommended**; all are reflected in `specs/opening-steering-symmetry-spec.md`.

## Decisions for ratification

| # | Question | Options | **Default** | Why |
|---|---|---|---|---|
| **Q-A** | Fill the book, add a fallback, or both? | (a) data-only · (b) fallback-only · **(both)** | **BOTH** | Data alone leaves the latent wrong-colour `OPENING_BOOK[0]` fallback bug; fallback alone keeps steering blind for the missing dims. Both = a gap can never silently no-op again. |
| **Q-B** | How many new lines? | (a) full parity 10/10 · **(b) minimal coverage = 3** | **MINIMAL (3)** | Coverage, not symmetry of count, is the goal. The ~3:1 weighting already preserves variety; padding to 10/10 dilutes it (AP-STEER-7). 3 lines close every hole: `sicilian-b` (tactics), `exchangeCaro-b` (endgameConversion), `kingsGambitAccepted-w` (resilience). |
| **Q-C** | Source the lines? | **(a) eco.json-grounded** · (b) hand-curated | **ECO-GROUNDED** | Every new prefix exists in `eco.json` (B50, B12, C30); names follow the book's "(as Black)"/family convention. Verifiable, ETL-consistent. |
| **Q-D** | FR/EN parity for new names? | **(a) extend `ECO_NAME_FR`** · (b) localize `steeringNote` separately | **EXTEND OVERLAY** | Single naming source (ADR-0053). Base names already have FR entries; only the "(as Black)"/"Exchange"/"Accepted" qualifiers are new. Avoids a second translation site. |

## Refiner cycles (summary)

- **Cycle 1 — structural.** Confirmed single concern; no multi-PR split needed. **Critical correction
  caught:** the portfolio framed the gap as Black-only, but the measured book shows it is
  **bidirectional** (White-bot also misses `resilience`). Spec scope adjusted from "fill the Black
  book" to "complete per-colour coverage (2 Black + 1 White)". No STOP.
- **Cycle 2 — defaults + arbitrages.** Settled Q-A…Q-D. Surfaced the latent wrong-colour fallback bug
  in the existing length-0 guard (`return OPENING_BOOK[0]`) and folded its fix into Q-A (both).
- **Cycle 3 — test design.** Identified the union-coverage blind spot in the existing test and made the
  **per-colour × per-dimension** assertion the regression lock (the test that would have caught the
  bug). Added non-degenerate-steering + same-colour-fallback + FR-parity assertions. Diminishing
  returns: remaining items were polish (comment wording, follow-up framing).
- **Cycle 4 — purity + docs.** Verified no `Date`/`Math.random` enters the core; confirmed no new ADR
  (extends AP-CHESS-22); confirmed `DB_VERSION` untouched and Insights byte-identity is structural
  (no consumer reads the book but `Play.svelte`). Stopped (delta < 10%).

## Locked invariants (carried into build)

- Core stays **pure**; `selectOpening`/`nextBookMove` signatures unchanged.
- **Additive-only**; no `DB_VERSION` bump (stays 4); no schema.
- **Bilingual FR/EN parity** for every new user-visible opening name.
- **Coach-agnostic**: no coach concern in the shared book (C7-friendly via `app.steerDimension`).
- **Insights byte-identical** (AP-COACH-1).
