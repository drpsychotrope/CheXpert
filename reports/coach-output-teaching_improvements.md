# Améliorations: coach-output-teaching (C6)

> Run AFTER `/draft-general` (4 cycles, arbitrages ratified-as-default). Constructive sweep for NOTABLE additions, under anti-fabrication discipline: an empty axis is reported **CLEAN**, never padded. Invariant: the FOLD set must **shrink or stabilize** across cycles, never grow.

## Cycles
- **Cycle 1 — Sweep (8 axes)**: 9 candidates surfaced (provisional FOLD 6 / DEFER 3 / REJECT 0).
- **Cycle 2 — Adversarial gate re-check (pruning)**: 1 re-classified (FOLD→DEFER: "trend vs prev profile" belongs to C1). FOLD 6 → **5**. No FOLD promoted (correct — cycle 2 degrades, never produces).
- **Cycle 3 — CONDITIONAL**: RAN (cycle 2 re-classified ≥1 finding). Checked FOLD↔FOLD interactions (A3 side-attribution ↔ A8 honest framing — compatible; A5 reuse ↔ A6 forward-compat — compatible). **0 further re-classification.** FOLD set stable at **5** → ship.

## Sweep axes (A1-A8)

| Axe | Finding | Verdict | Raison |
|---|---|---|---|
| **A1 Capability** | The narrative should degrade gracefully on a **puzzle-only** assessment (no game) — state it's directional/puzzle-only rather than implying a full-game read. | **FOLD-A8** (see A8) | Real, frequent case (game is optional); cheap; in-intent. Folded into the honest-framing finding. |
| **A1 Capability** | Surface a card for **every** weak motif, not just the top one. | **DEFER** | Scope-creep (Q-B chose one card for focus); more cards = noise. Own follow-up if ever wanted. |
| **A2 Observability** | Expose the **leverage rank** (severity×frequency) as the ordering behind "start here", so the user sees *why* this focus is first. | **FOLD-A2** | Cheap, descriptive, makes the verdict honest/interpretable (the rank is already computed for CO9). Report-all, not a hidden selector. |
| **A3 Render fidelity** | Turning-points list must distinguish **player** vs **opponent** swings (a swing the opponent caused isn't the player's blunder). | **FOLD-A3** | The existing render would mislead ("you blundered" when the opponent did). Reuse EvalGraph's `side` semantics — quasi-free. |
| **A4 Robustness** | Handle empty `criticalMoments` (clean game), `null bestUci`, empty `motifs`/`dimensions` without an empty heading or a throw. | **FOLD-A4** | Degenerate inputs are real (short/clean coach game). Cheap guards (`coachReview.noSwings`, `moves=[]` per F4 FOLD-3, maintenance-line fallback). |
| **A5 Reuse** | Pass the `explainPly`-derived "why" through F4 `SolutionReveal`'s **existing `why?` prop** — a thin local `explainLine` adapter, NOT a fork. | **FOLD-A5** | Consumes F4 FOLD-4 contract; prevents the classic "fork the component for a richer why" regression. Reuse over reimplement. |
| **A6 Extensibility** | Keep `RankedFocus` (and the `why` adapter) shaped so C7 efficacy / C1 trend can extend the narrative additively later. | **FOLD-A6** | Additive, cheap; the next coach PRs (C1 trend, C7 efficacy) are evident. Frozen-shape `RankedFocus` avoids a breaking change. **Guard**: do NOT pre-build C1/C7 fields now (no speculative futures) — only keep the seam clean. |
| **A7 Symmetry** | Narrate **strengths** with the same weight as weaknesses (the brief: "solid on forks; pins & resilience need work"). | **FOLD-A7** | The natural pair of "focus on" is "you're solid on" — quasi-free, and `profile.strengths` already exists. Avoids a one-sided (only-negative) narrative. Folded into A4/A1 narrative templates (`coachReview.narrStrength`). |
| **A8 Honest framing** | The narrative must read as **directional**, never a grade/precise prediction; on puzzle-only or thin data, say so explicitly. | **FOLD-A8** | A generated prose summary is exactly where over-claiming creeps in. Reuse the `coach.directional` tone; AP-CTEACH-2/3. This is report framing, not edge measurement. |
| **A2/edge** | Compute a **predicted rating/% gain** for the "start here" focus. | **DEFER (REJECT-as-edge)** | No validated model — would be an invented edge number (AP-CTEACH-3 / G-no-edge-peek). Qualitative payoff only. Permanently out unless a real efficacy model lands (C7). |
| **A1/scope** | Show a **trend** narrative vs `coachProfilePrev` ("pins improved since last time"). | **DEFER → C1** | C1 owns profile-trend/`coachProfilePrev` surfacing (portfolio §3). Folding it here = cross-PR scope creep. |

## FOLD — à intégrer (ratification user) — already folded into the spec

### FOLD-A2 — Expose the leverage rank behind "start here"
- **Axe**: A2 · **Gates**: all PASS (descriptive, report-all, cheap, no look-ahead) · **Coût**: free (rank computed for CO9).
- **Adds**: `rankByLeverage(profile): RankedFocus[]` (severity×frequency, sample-gated) drives the "start here" ordering and is unit-testable. §4 A1, §5.
- **Reco**: FOLD.

### FOLD-A3 — Distinguish player vs opponent turning points
- **Axe**: A3 · **Gates**: all PASS · **Coût**: quasi-free (reuse EvalGraph `side`).
- **Adds**: the turning-points list and replay "why" label the side; never frames an opponent swing as the player's blunder. §4 A6, AP-CTEACH-9.
- **Reco**: FOLD.

### FOLD-A4 — Degenerate-input robustness
- **Axe**: A4 · **Gates**: all PASS · **Coût**: cheap guards.
- **Adds**: empty `criticalMoments` → `coachReview.noSwings`; `null bestUci` → `moves=[]` (F4 FOLD-3); empty `motifs`/`dims` → single honest maintenance line; never throws. §4 A1/A6.
- **Reco**: FOLD.

### FOLD-A5 — `explainPly` "why" through F4's `why?` prop (no fork)
- **Axe**: A5 · **Gates**: all PASS · **Coût**: thin `explainLine` adapter.
- **Adds**: consumes F4 FOLD-4; `SolutionReveal` is not forked for the Coach's richer (engine-backed) why. §4 A6, AP-CTEACH-1.
- **Reco**: FOLD.

### FOLD-A8 (+A1, +A7) — Honest directional framing, both sides
- **Axe**: A8 (with A1 puzzle-only + A7 strengths) · **Gates**: all PASS · **Coût**: template wording.
- **Adds**: the narrative names strengths AND weaknesses, carries a directional/puzzle-only caveat when no game/thin data, and never implies a grade. `coachReview.narrStrength/narrWeak/narrPuzzleOnly`; AP-CTEACH-2/3; §4 A1/A2. Test asserts no digit-payoff + caveat on `source.game=false`.
- **Reco**: FOLD.

### FOLD-A6 — Clean extensibility seam for C1/C7
- **Axe**: A6 · **Gates**: all PASS (additive, no speculative fields built now) · **Coût**: shape discipline only.
- **Adds**: `RankedFocus` frozen-shaped so C1 (trend) / C7 (efficacy) extend additively. §4 A1, §11.
- **Reco**: FOLD (seam only — no premature fields).

## DEFER — bonnes idées, autre PR / prématuré
- **Cards for every weak motif** — DEFER (own follow-up; Q-B chose focus-on-one).
- **Predicted rating/% gain for "start here"** — DEFER/REJECT-as-edge (no validated model; AP-CTEACH-3). Permanently out absent a real efficacy model (C7).
- **Trend narrative vs `coachProfilePrev`** — DEFER → **C1** (owns profile-trend; cross-PR scope).
- **Historical-game review on the result/Dashboard** — DEFER (needs F5 games-store reads; §11).
- **Reveal/card usage telemetry** — DEFER (no telemetry layer; mirrors F4 T3).

## REJECT — écartées (documentées pour ne pas ressurgir)
- *(none promoted to a hard REJECT)* — the only edge-shaped candidate (predicted gain) is recorded as DEFER/REJECT-as-edge above so it doesn't resurface naïvely as an "enrichment". Forking `SolutionReveal`/`EvalGraph` for a richer Coach view is implicitly rejected by FOLD-A5/AP-CTEACH-1.

## Verdict
- Axes balayés: **8/8** · Cycles: **3** (cycle 3 RAN — re-classification ≥1).
- **FOLD: 5** (A2, A3, A4, A5, A8[+A1+A7+A6 folded in]) · **DEFER: 5** · **REJECT: 0 hard** · **CLEAN: 0 axes empty** (every axis yielded a real, in-scope finding — none fabricated; the DEFERs are the anti-creep discipline working).
- FOLD set: cycle 1 **6** → cycle 2 **5** → cycle 3 **5** (shrank then stable — healthy, no fabrication).
- All 5 FOLD are **already folded** into `specs/coach-output-teaching-spec.md` (§2.6, §4 A1/A6, §5, §9 AP-CTEACH-, §11) — this PR's spec is the V1 with the enrich pass applied.

## Next steps
1. Read the 5 FOLD above (all already in the spec).
2. Ratify or override (e.g. "A6: defer").
3. **Build gate: F4 must be merged first** (hard dependency).
4. Build via cadence Phase A→Z (code first, docs last).
