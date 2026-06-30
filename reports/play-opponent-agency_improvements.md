# play-opponent-agency — /enrich (3 cycles, 8-axis sweep)

**PR**: P3 opponent agency & realism · **Method**: `/enrich` constructive sweep · **Date**: 2026-06-30
Input: `specs/play-opponent-agency-spec.md` V1. Discipline: **FOLD** (integrate now) / **DEFER** (good, wrong PR or premature) / **REJECT** (violates scope/causality/honesty). **Anti-fabrication: empty axis = CLEAN; the FOLD set must NOT grow across cycles** (later cycles may only confirm, re-verify, or downgrade — not invent).

8 axes: capability gap · observability · render fidelity · robustness · reuse · extensibility · symmetry · honest framing.

---

## Cycle 1 — sweep (find notable enrichments)

| # | Axis | Finding | Verdict | Rationale |
|---|---|---|---|---|
| E1 | **render fidelity / honesty** | `ratingLine` (Play.svelte:509) shows bot Elo from `poolOpponent(...).targetElo` — the **pool's adaptive** value. During a Fixed/Easier/Harder override the bot actually plays at `difficultyTargetElo(...)`, so the displayed "bot ≈ X Elo" **lies**. | **FOLD** | Directly undercuts the feature's honesty (Q-E). Cheap: show the *effective* bot Elo (and a small mode tag) when an override is active. |
| E2 | **observability** | While a draw offer is pending there's no persistent on-board affordance — the player can't tell the offer is outstanding until the bot's next reply. | **FOLD** | Small, real UX gap for the new draw flow; a pending-offer indicator (reuse the `result`/feedback slot + a flag) makes the new capability legible. |
| E3 | **robustness** | The full-strength resign/draw eval is one more serialized worker round-trip per bot decision; if it **throws** (worker crash), the bot must still move — a failed eval must never block or fabricate a resign. | **FOLD** | Mirrors `coachEvalBad`'s `catch → false`. Make explicit: eval failure ⇒ no resign / no auto-accept (play on). Guards the hot path. |
| E4 | **capability gap** | When `Fixed` is chosen with no entered Elo, the seed is ambiguous. | **FOLD** | Tiny: default the Fixed input to the current pool/adaptive Elo so the field is never empty/NaN (mirrors the 960 SP-ID "blank = sensible default" pattern). |
| E5 | **honest framing** | An override game's `GameRecord` is flagged, but post-game analysis / weakness steering should not over-weight a deliberately-easy win. | **DEFER** | Real, but the consumer is F5 game-reads / analysis weighting — **not this PR**. P3 only needs to *flag* the record (already in scope); how downstream reads it is F5/C4. Note in §11. |
| E6 | **symmetry** | Sparring/Comeback get no resign/draw/difficulty. | **DEFER** | Already §11 (siblings adopt after F6 migrates them). Confirm, don't fold (would blow P3's single concern + blast radius). |
| E7 | **extensibility** | Bot-initiated draw offers. | **DEFER** | Already Q-C deferred + §11. Confirm. |
| E8 | **capability gap** | A "the bot is offering a draw / you may claim a draw" claimable-draw (threefold/50-move) surfacing. | **REJECT** | Claimable-draw UI is a rules/UX concern adjacent to P2's in-game UX, not opponent *agency*; folding it expands scope (AP-OPPAGENCY-7). Out. |
| E9 | **observability** | Telemetry/counter of how often the bot resigns/draws, for tuning. | **REJECT (→note)** | No telemetry sink exists pre-F5; building one is out of a feature PR. The tunables are already centralized for manual tuning (§11). Not folded. |
| E10 | **honest framing** | Resign should never trigger from a position the bot can hold (fortress) even if eval is momentarily low. | **CONFIRM (already covered)** | AP-OPPAGENCY-2 (sustained ≥N plies, never on a swing) already encodes this. No new fold. |

**Cycle-1 FOLD set: {E1, E2, E3, E4} (4).** DEFER {E5,E6,E7}. REJECT {E8,E9}. Confirmed-existing {E10}.

---

## Cycle 2 — prune + re-verify (set must not grow)

Re-examined each FOLD for real value vs scope cost; swept the axes again for anything missed.

- **E1** — verified against code: `ratingLine` truly reads pool Elo, not game Elo → the lie is real. **KEEP FOLD.**
- **E2** — confirmed the draw flow has no pending indicator in V1. **KEEP FOLD** (minimal: a `drawOffered` flag + feedback text).
- **E3** — confirmed the eval is a real worker round-trip that can throw. **KEEP FOLD** (catch ⇒ play on).
- **E4** — confirmed Fixed-input default is unspecified in V1. **KEEP FOLD** (seed from pool Elo).
- New-axis pass: **no new notable findings.** Capability/observability/fidelity/robustness/reuse/extensibility/symmetry/honesty all either folded, deferred, or clean. Anti-fabrication holds — **set did not grow** (still {E1,E2,E3,E4}).
- Downgrade check: none of the 4 are actually trivial-inline-only or out-of-scope; all 4 stay FOLD.

**Cycle-2 FOLD set: {E1, E2, E3, E4} (4) — unchanged.**

---

## Cycle 3 — conditional / final consistency

- Cross-checked the 4 FOLDs against the anti-patterns: none violate AP-OPPAGENCY-* (E1/E2 are observability/fidelity, E3 robustness, E4 a default — all within "opponent agency + realism"). No localized strings leak into the core (E1's effective-Elo display + E2's indicator are Play-side; E3/E4 are component/edge).
- Cross-checked against F6 contract: E3's eval-failure handling respects no-auto-chain (the bot still moves via the normal `engineReply`); E1/E2/E4 are pure Play view concerns. No F6 contract conflict.
- Honesty re-check: E1 *strengthens* Q-E (display matches reality); folding it is mandatory for an honest override mode.
- **No new findings. Diminishing returns: cycle 3 added zero folds.** Stop at 3 per method.

**Final FOLD set: {E1, E2, E3, E4} (4). DEFER {E5, E6, E7}. REJECT {E8, E9}.**

---

## Folded into the spec (V1 → V1+)

| Fold | Where | One-line change |
|---|---|---|
| **E1** render fidelity/honesty | §2 IN, §4.A2, §6, §8, AP-OPPAGENCY-5 | Show the **effective** bot Elo + mode tag when an override is active, so `ratingLine` never misstates the strength you're actually playing. |
| **E2** observability | §4.A3, §6 | Persistent "draw offered" indicator while a player draw-offer is pending (feedback slot + `drawOffered` flag). |
| **E3** robustness | §4.A3, §9 (AP-OPPAGENCY-13), §6 | A failed/throwing resign-draw eval ⇒ **no resign, no auto-accept** (bot plays on); never blocks the hot path. |
| **E4** capability gap | §4.A2, §8 | Fixed-Elo input defaults to the current pool/adaptive Elo (never empty/NaN). |

DEFER recorded in §11 (E5 analysis-weighting of override games; E6 siblings; E7 bot-initiated draw). REJECT not folded (E8 claimable-draw UI = P2-adjacent scope creep; E9 telemetry sink = pre-F5, out).

**Anti-fabrication attestation**: the FOLD set was {4} at cycle 1 and remained {4} through cycles 2–3 (no growth). Two axes (reuse, and the symmetry axis beyond the already-noted siblings) returned **CLEAN** — no findings invented to fill them.
