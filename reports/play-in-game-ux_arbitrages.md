# Arbitrages — play-in-game-ux (P2)

Drafted 2026-06-30. Recommended defaults **applied → V1 spec**. Flip any to re-fold the spec body.
Grounded in the pre-V0 scan (`reports/play-in-game-ux_target_exists.json`) — every option below was
checked against real code, not assumed.

| Q | Decision | Default | Why (code-grounded) | If flipped |
|---|---|---|---|---|
| **Q-A** move list: static vs click-to-preview a ply | **a — static, auto-following list now; preview DEFER** | a | A static list reads `game.history()` (SAN) directly, needs no new state. Preview needs a ply cursor + board-at-ply reconstruction + a live-vs-history mode — the SAME cursor gap F2 §11 D2 routed *to this PR as its own follow-up*. Folding it multi-PRs P2. | Adds D1 into scope: ply cursor, per-ply FEN/replay, read-only board jump, ←/→ nav. ~doubles the PR; needs the live/history mode tested. |
| **Q-B** takeback in NON-coached play: un-rated or rated? | **a — opt-in `takebackInPlay` (default OFF); takeback in a RATED game marks it un-counted (`unrated=true`, rating skipped)** | a | `finishGame` (Play.svelte:404) ALWAYS rates (`updateRating`) + persists. An un-gated takeback = abuse vector (undo every blunder, keep the gain). Honest fix: opt-in + forfeit the rating for that game, surfaced to the user. `GameRecord` has no rated/unrated field → additive-optional `unrated?` (mirrors `coached?`), **no DB bump**. **This is a rating-integrity policy → ADR-0058.** | Alt (rated takeback) = reject (abuse). Alt (takeback only in a casual/unrated MODE) = no `unrated` field + no ADR, but Play has no casual mode today → would need one (bigger). |
| **Q-C** on-demand blunder check: reuse `coachEvalBad`? | **a — "Check this move" button calls existing `coachEvalBad()`; non-blocking verdict; one check/position; any mode** | a | `coachEvalBad()` (Play.svelte:308) is depth-8 shallow, best-effort (`catch → false`), exactly the on-demand granularity. Reuse avoids a 2nd eval path. Per-position guard (`checkedFen`) stops brute-forcing the engine. Advisory only (no move/undo/clock/rating). | Building a new/deeper eval here = scope creep into F4/T1 teach-explain; rejected (D4 defers the deep "why"). |
| **Q-D** rematch: same color or alternate? | **a — same color + TC + variant (call-through to `newGame()`); alternate-color DEFER** | a | `colorChoice`/`variant` stay in memory after a game; TC is persisted. Rematch = zero-config `newGame()` reuse → same color is free + predictable. | Adds D2: a color-flip toggle + state, seed the bot's first move on flip. Small but its own concern. |

## Cross-cutting decisions baked into V1
- **ADR-0058 flagged** (Q-B is a real rating-integrity policy). Numbering: portfolio reserved 0054;
  F3/F5/F6 = 0055/0056/0057; first free feature ADR = **0058** (per portfolio §8 instruction "flag ≥0058").
- **No `DB_VERSION` bump** — `unrated?`/`takebackInPlay?` are optional with `?? false` read-sites (additive
  doctrine; mirrors `coached?`/`variant?`/`metacogEnabled?`).
- **Single concern held** — PGN export stays in F5; bot resign/draw stays in P3; ply preview + alt-color +
  test harness + deep-why all DEFER (§11). P2 = the in-game/after-game player UX only.
- **No new view/route** — everything renders inside `Play.svelte` + one Settings toggle.

## What the user must ratify
1. **ADR-0058** (takeback forfeits the rating for that game). Accept the policy, or pick the casual-mode
   alternative (bigger), or drop in-play takeback entirely (keeps coached takeback only).
2. The four defaults above (all recommended **a**).
3. Build-order slot: P2 depends on F2 (move text-entry). F2 is drafted (V1) but may not be built; P2's
   move-LIST + nav are what F2 deferred here, so P2 can build on top once F2 lands (or in parallel — P2
   does not touch the F2 input wiring).
