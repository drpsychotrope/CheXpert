# Enrichments — teach-explain-surfacing (F4)

`/enrich` discipline: 3 cycles, 8-axis sweep, verdict per finding (**FOLD** = integrate into spec now · **DEFER** = good idea, wrong PR / premature · **REJECT** = violates scope/causality/doctrine). **Anti-fabrication:** an axis with nothing real is marked **CLEAN** (no invented finding); the FOLD set is fixed after cycle 1 and **must not grow** in cycles 2–3 (cycles 2–3 only prune/confirm).

Axes: (1) capability gap · (2) observability · (3) render fidelity · (4) robustness · (5) reuse · (6) extensibility · (7) symmetry · (8) honest framing.

---

## Cycle 1 — sweep (the only cycle that may add FOLDs)

| Axis | Finding | Verdict | Disposition |
|---|---|---|---|
| **1 Capability gap** | Trainer miss never shows the solution; the reveal capability is trapped in Calculate. | **(already core)** | This *is* the PR; not a new fold. |
| **1 Capability gap** | A miss could also offer a "replay slower / step" control. | **DEFER → T1** | T1 owns trainer feedback depth; F4 ships the autoplay surface only. |
| **2 Observability** | No event/telemetry when a user reveals a solution (would inform whether the surface helps learning). | **DEFER → T3** | The app has no telemetry layer in scope; retention/usage signals are T3's remit. Adding here = scope creep. |
| **3 Render fidelity** | `SolutionReveal` should highlight the **key move** (lastMove) per step, matching Calculate's reveal and ConceptCard's keyMove highlight. | **FOLD-1** | Already implied by extracting `revealSolution` (it sets `lastMove`); make it **explicit in §4 A2** so the extraction can't silently drop it. Render-fidelity parity with the baseline reveal. |
| **3 Render fidelity** | Respect reduced-motion / allow instant (no-animation) reveal. | **FOLD-2** | Cheap, honest a11y win: `stepMs` prop already exists; honor `prefers-reduced-motion` by collapsing to an instant final-position render (or `stepMs=0`). Folds into A2 as a documented behavior. |
| **4 Robustness** | Empty/short `moves` (e.g. 1-ply line) or an illegal UCI mid-line must not crash the stepper. | **FOLD-3** | `moveUci` already returns `?? m` fallback in Calculate; make `SolutionReveal` **tolerate empty/short lines** (render whatever SAN it can, stop cleanly) and pin it in the component test. Robustness of the extracted surface. |
| **4 Robustness** | Timer leak if the component unmounts mid-playback. | **(already core)** | §4 A2 already mandates `onDestroy` clear (mirrors Calculate). Not a new fold. |
| **5 Reuse** | `formatSanLine`, `calc.solution`, view-only `<Board>` reused rather than reinvented. | **(already core / AP-TEACH-1)** | Confirms the design; no new fold. |
| **5 Reuse** | The theme→idiom mapping should reuse `CARD_PRECEDENCE`/`familyKey` rather than a new precedence list. | **(folded in Q-G)** | Already the default. |
| **6 Extensibility** | Coach game-review needs to play an arbitrary (non-puzzle) line. | **DEFER → C6** | `moves`/`fen` props are already arbitrary (§11). No F4 change needed; explicitly a C6 consumer. |
| **6 Extensibility** | Parameterize the "why" so Coach can pass an `explainPly`-derived line through the same component. | **FOLD-4** | The `why?: string|null` prop is **already source-agnostic** — make §4 A2 state that Coach (C6) passes an `explainPly` line through the *same* prop (trainer passes `missWhy`). Zero code delta now; locks the reuse contract so C6 doesn't fork the component. |
| **7 Symmetry** | Tactics and Review must get the **same** treatment (not just Tactics). | **(folded in Q-C)** | Both wired; already core. |
| **7 Symmetry** | Calculate's existing auto-reveal vs Trainer's opt-in toggle is an asymmetry. | **REJECT (as a defect)** | Intentional: Calculate has no Retry, Trainer does (Q-D). Documented, not a flaw. |
| **8 Honest framing** | "Why" must not assert a reason it didn't derive. | **(already core / AP-TEACH-2)** | Confirms; no new fold. |
| **8 Honest framing** | The trainer "why" should be visibly *lighter* than the Coach's (no engine eval), so users don't read it as a full analysis. | **FOLD-5** | Frame the trainer line as a **pattern hint** (theme idiom), distinct from the Coach's engine-backed review. One i18n nuance (`reveal.themeWhy` phrasing as a pattern cue, not a verdict). Honesty/expectation-setting. |

**Cycle-1 FOLD set (frozen): FOLD-1 … FOLD-5.** 5 folds. DEFER ×4 (T1, T3, C6 ×2-as-one-area), REJECT ×1.

---

## Cycle 2 — prune / confirm (no growth)

Re-examined each axis for over-folding or fabrication:
- **FOLD-1 (key-move highlight):** confirm — it's a baseline-parity behavior, not gold-plating. **KEEP.**
- **FOLD-2 (reduced-motion):** challenged as possible scope creep → it's a one-prop/one-media-query honesty win, no new surface. **KEEP** (smallest a11y fold; consistent with F2's a11y theme but not dependent on it).
- **FOLD-3 (short/illegal line tolerance):** confirm — pure robustness, testable. **KEEP.**
- **FOLD-4 (source-agnostic `why`):** confirm — it's a **contract clarification with zero code now**; prevents C6 forking the component. **KEEP.**
- **FOLD-5 (pattern-hint framing):** challenged hardest (is it just wording?) → kept because it's an **honesty guardrail** (stops the theme line being misread as full analysis), realized as one bilingual string nuance. **KEEP.**
- Axes with nothing further: (1) capability, (2) observability, (5) reuse, (7) symmetry, (8) beyond FOLD-5 → **CLEAN** (no fabricated additions).

**FOLD set unchanged: 5.** No growth. ✔

---

## Cycle 3 — conditional / final (no growth)

- Looked for any *conditional* fold that only matters under a flag/edge: none real. Marking **CLEAN** rather than inventing one (anti-fabrication).
- DEFER set re-validated against the architecture DAG: T1 (feedback depth, replay controls), T3 (usage telemetry), C6 (arbitrary-line replay, `explainPly` narrative, EvalGraph/turning points). All correctly downstream.
- REJECT re-validated: the Calculate/Trainer reveal-trigger asymmetry is by design (Q-D), not a defect.

**Final FOLD set: 5 (FOLD-1…5). Stable across cycles 2–3.**

---

## FOLD → spec integration (applied to V1)

| Fold | One-line | Axis | Where folded |
|---|---|---|---|
| **FOLD-1** | Reveal highlights the key move (lastMove) each step, matching the baseline reveal. | render fidelity | §4 A2 |
| **FOLD-2** | Honor `prefers-reduced-motion` → instant (no-animation) reveal option via `stepMs`. | render fidelity / a11y | §4 A2, §5 component test |
| **FOLD-3** | Tolerate empty/short/illegal `moves` lines without crashing; pin in test. | robustness | §4 A2, §5 |
| **FOLD-4** | `why?` prop is source-agnostic: trainer passes `missWhy`, Coach (C6) passes an `explainPly` line through the *same* component — no fork. | reuse / extensibility | §4 A2, §11 |
| **FOLD-5** | Frame the trainer "why" as a **pattern hint** (not a verdict/full analysis); one bilingual nuance. | honest framing | §0.5 Q-F, §4 A6, §9 AP-TEACH-2 |

**Net:** 5 FOLD integrated; 4 DEFER (downstream PRs); 1 REJECT (intentional asymmetry). No fabricated findings; FOLD set frozen after cycle 1 and unchanged thereafter.
