# Enrichments — board-input-a11y (F2)

**Drafted**: 2026-06-30 · `/enrich` 3 cycles over 8 axes. Companion to `specs/board-input-a11y-spec.md`.
**Anti-fabrication**: empty axes are reported CLEAN (no invented enrichment). The FOLD set did **not grow**
across cycles (3 at cycle 1 → 3 at cycle 2 → 3 at cycle 3 = converged).

## Axis sweep (cycle 1 — full)

| Axis | Finding | Verdict |
|---|---|---|
| **A1 capability gap** | After a typed move applies, focus is not returned to the move input — a keyboard user must re-tab to play the next move. In-scope (a11y), low-cost, single source. | **FOLD** |
| **A2 observability** | a11y wiring has no metric/telemetry surface; pure UI. Inventing analytics would be fabrication. | **CLEAN** |
| **A3 render/output fidelity** | The error path speaks (`role=alert`), but a *successful* typed move gives AT users no announcement (board updates only visually). A polite live region in the single source completes feedback symmetry. | **FOLD** (constrained — see prune) |
| **A4 robustness / degenerate guards** | Empty/whitespace + nonsense input already guarded (`submitKbMove` + `resolveMove`→null→error). Wrong-turn covered by AP-A11Y-2. The B2 static wiring test is itself the regression guard. No new gap. | **CLEAN** |
| **A5 reuse / consolidation** | The 11 callbacks are near-identical 5-liners; a shared helper was considered. Rejected: each needs a distinct game var + guard + handler, and the 3 existing wirings are inline — a helper would diverge from the established pattern for ~5 lines and add indirection. | **REJECT** (consistency wins) |
| **A6 extensibility** | Future consumers inherit aria automatically (single source). Keyboard entry can't be auto-defaulted — `Board` holds no game, so the per-consumer callback is structurally required. The B2 static test forces new interactive consumers to wire it. | **CLEAN** (handled by B2) |
| **A7 symmetry / family-completeness** | All interactive boards covered (11 + 3 already-wired); view-only/`onSelect` excluded with reasons; the `label`/`labelView` split gives interactive-vs-view-only symmetry. Family complete. | **CLEAN** |
| **A8 honest framing** | Spec already records the premise correction, the under-promotion limitation (D6), the no-test-harness constraint, and the ARIA-grid deferral. One gap: B2 asserts wiring *presence*, not behavioural correctness (can't catch a wrong guard) — state that so it isn't over-trusted. | **FOLD** |

## Cycle 2 (prune)

Re-examined the 3 FOLDs; no new items invented (anti-fabrication holds).
- **A1** focus-return — kept as-is (clear win, single source).
- **A3** success announcement — **constrained** to a single visually-hidden `aria-live="polite"` status
  in `Board.svelte`, set on a successful `onMoveText`. Explicitly *not* a general status-message system
  (that would be scope creep). Bounded → kept.
- **A8** honesty note — kept (one sentence in §5).
- A2/A4/A5/A6/A7 re-confirmed CLEAN/REJECT. **FOLD set = 3 (unchanged).**

## Cycle 3 (conditional / convergence)

- A1 + A3 together complete the keyboard *feedback loop* (input → apply → announce → focus back), which
  is the A7 symmetry lens reinforcing the same two items — **no new item** emerges.
- No axis flips. **FOLD set frozen at 3. Converged.**

## FOLD set (applied to the spec)

1. **(A1) Focus return** — after a successful typed move, return focus to the move input so consecutive
   keyboard moves need no re-tab. Single source (`Board.svelte` `submitKbMove`). → folded into §4 A1 + §6 C2.
2. **(A3) Polite success announcement** — one visually-hidden `aria-live="polite"` status in `Board.svelte`,
   announced on a successful `onMoveText` (e.g. "move played"); bounded, not a status-message system.
   Needs a bilingual key `board.movePlayed`. → folded into §2, §4 A1/A2, §6 C3, §8.
3. **(A8) B2 test-limitation note** — state that the static wiring test guards *presence* of `onMoveText`,
   not the correctness of each consumer's guard (behavioural correctness is verified manually in C2). →
   folded into §5 B2.

## DEFER / REJECT (recorded, not folded)

- **REJECT** — shared callback helper (A5): diverges from the established inline pattern for marginal gain.
- **DEFER** (already in spec §11): ARIA-grid navigation (D1), ply navigation (D2), Svelte component-test
  harness (D3), `onSelect`-drill square a11y (D4), typed-under-promotion dialog (D6).
