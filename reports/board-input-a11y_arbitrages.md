# Arbitrages — board-input-a11y (F2)

**Drafted**: 2026-06-30 · Status: **RESOLVED — recommended defaults applied to reach V1.** Flip any to re-fold.
Companion to `specs/board-input-a11y-spec.md`. Refiner: 4 cycles (converged at cycle 3; cycle 4 nil).

## Pre-V0 scope corrections (the load-bearing context for every arbitrage below)

The PR's stated premise — "boards are mouse-only and lack aria app-wide" — is **partially false**. The
scan (`reports/board-input-a11y_target_exists.json`) found keyboard/text move entry **already shipped**
in `Board.svelte` + `ChessGame.resolveMove` (audit v2 P0-04), and **already wired** in Tactics, Review,
Play. So F2 is *finish the rollout + label the region*, not *build the feature*. Two real gaps remain:
(1) the board region has no `role`/`aria-label`; (2) **11 interactive board instances across 9 files**
never pass `onMoveText`. Every arbitrage is scoped to that corrected, narrower reality. This was **not a
STOP** — the F2 goal ("across ALL consumers") is genuinely unmet — but it is the single most important
finding and it shrank the PR substantially.

## Decisions

| Q | Question | Options | **Default (applied)** | Why |
|---|---|---|---|---|
| **Q-A** | a11y depth now | (a) text entry + `aria-label` now, ARIA-grid later · (b) full `role="grid"` + per-square keyboard nav now | **(a)** | Move-text input is a complete no-mouse path (WCAG 2.1.1) and exists already; a labelled region adds orientation (1.3.1/4.1.2) at ~zero cost. The grid pattern is a big, separate focus model — and announcing a grid with no arrow nav is *worse* than `role="group"` (AP-A11Y-4). Grid → §11 D1. |
| **Q-B** | ←/→ ply MOVE NAVIGATION | (a) include in F2 · (b) DEFER to feature PRs | **DEFER** | Distinct concern; needs a ply cursor that exists nowhere today. Belongs to the PRs that own a move list (P2 in-game UX; analysis). §11 D2. |
| **Q-C** | consolidate where | (a) aria in `Board.svelte` single source; thin per-consumer `onMoveText` callback · (b) per-consumer everything | **(a)** | Region label is identical for all → single source so every consumer inherits (incl. future ones). Only the callback must be per-consumer (it needs that consumer's game + turn guard). Matches the "single source of truth" doctrine. |
| **Q-D** | new ADR? | (a) no new ADR, extend ADR-0052 a11y line · (b) claim a new ADR | **(a) no new ADR** | F1 set the precedent ("display-only follow-up → no new ADR"). The portfolio spec already reserves **ADR-0054** for itself → claiming 0054 would collide. If an ADR is later wanted, it takes the first free number *after* 0054 (§11 D5). |
| **Q-E** | which consumers wired | (a) whitelist the 11 *interactive* instances · (b) all 23 Board usages | **(a) whitelist** | `onSelect` calc/vision drills and `viewOnly` boards are gated out by the existing `{#if onMoveText && !viewOnly}` — wiring them is a no-op or semantically wrong (a square-tap drill has no from→to move). §1 enumerates in/out. |

## Refiner cycle log (honest)

- **Cycle 1 (premise):** biggest risk already neutralised in pre-V0. New defect found + fixed —
  `Repertoire.svelte` has **no persistent `ChessGame`** (it builds `new ChessGame(drill.fen())` ad hoc),
  so the §4 wiring row was corrected from a non-existent "drill game var" to the scratch-construct it
  actually uses (avoided shipping a false hook).
- **Cycle 2 (cross-axis):** two integration findings. (i) Typed under-promotion without a promo letter
  (`e7e8`) auto-queens via `?? 'q'` — but this *matches* the existing Tactics/Play/Review wiring, so F2
  keeps it for parity (recorded honestly, §11 D6, not a blocker). (ii) The single `board.label` would
  over-promise "type below" on view-only boards → split into `board.label` (interactive) +
  `board.labelView` (positional). Fixed in §2/§4/§8.
- **Cycle 3 (polish):** folded the cycle-2 label split through all references (§1/§4/§8/B3); confirmed AP
  count = 7 (in band), arbitrages all have applied defaults. Marginal yield.
- **Cycle 4:** no new defects — **converged**. Diminishing returns reached at cycle 3, as is typical.

## What the user must ratify

All five defaults are applied in the V1 spec. Ratify as-is, or flip a letter to re-open:
- Flip **Q-A→b** only if full ARIA-grid keyboard navigation is wanted *in this PR* (much larger scope).
- Flip **Q-B→a** to pull ply-navigation into F2 (breaks single-concern; needs a ply cursor first).
- Flip **Q-E→b** only if you want input rendered on view-only/drill boards (not recommended — no-op/wrong).
- **Q-C** and **Q-D** are low-controversy (single-source + no-ADR); flip only on a naming/architecture preference.
