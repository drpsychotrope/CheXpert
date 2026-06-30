# Enrichments — play-in-game-ux (P2)

**Drafted**: 2026-06-30 · `/enrich` 3 cycles over 8 axes. Companion to `specs/play-in-game-ux-spec.md`.
**Anti-fabrication**: empty axes are reported **CLEAN** (no invented enrichment). The FOLD set did **not
grow** across cycles (2 at cycle 1 → 2 at cycle 2 → 2 at cycle 3 = converged). Every finding is grounded
in the verified scan (`reports/play-in-game-ux_target_exists.json`), not assumed.

## Axis sweep (cycle 1 — full)

| Axis | Finding | Verdict |
|---|---|---|
| **A1 capability gap** | Considered: inline game-result in the move list; eval-per-move; "un-mark unrated"; resign reachable while the bot thinks. The result already shows in the status line; per-move eval is the deferred deep-why (D4); un-marking a forfeited rating would defeat ADR-0058 (dishonest); `resign()` already permits `playing||thinking` so the confirm dialog naturally covers both. No genuine *missing capability* — adding any would be scope creep or fabrication. | **CLEAN** |
| **A2 observability** | P2 is pure UI; no metric/telemetry surface exists and inventing analytics on takeback/check usage would be fabrication. | **CLEAN** |
| **A3 render/output fidelity** | Move list already: numbered pairs, latest-ply highlight (`aria-current`), auto-scroll, correct White-first ordering even when the board is flipped for a Black player, 960 castle SAN verbatim. Verdict + un-rated note render non-blocking. Fidelity complete. | **CLEAN** |
| **A4 robustness / degenerate guards** | **Real gaps.** (1) **Black-player takeback at ply 1:** game starts, bot (White) plays ply 1, it is now the player's (Black) turn with `history().length===1` → `canTakeBack` is TRUE, but undoing leaves an empty board with the BOT to move → must NOT auto-fire `engineMove` (infinite re-open) and should be **disallowed** (nothing of the player's to take back yet). (2) **Rematch / takeback while an analysis is in flight** (`aStatus==='analyzing'`): a running `runAnalysis` promise can resolve and write stale `aResult` after the new game starts. (3) **`checkMove` racing the bot reply:** must be gated to the player's turn only. | **FOLD** |
| **A5 reuse / consolidation** | In-play `takeBack()` overlaps `coachTakeBack()` (both undo + `fen=game.fen` + `playedUci.pop`). But `coachTakeBack` undoes exactly ONE ply *pre-commit* (fires at `onMove:277` before the bot replies); in-play takeback undoes the bot's reply **and** the player's move (TWO plies, post-commit). Different arity/timing → a shared helper would need branching that costs more than it saves. **Reuse the field-update shape, not a merged function.** | **REJECT** (consistency; mirrors F2 A5) |
| **A6 extensibility** | The `unrated?` field + an explicit rating-skip decision is the exact seam a future "casual mode" / "N rated takebacks" (D5) extends, without re-touching `finishGame`'s shape. `toMovePairs` already carries `whitePly`/`blackPly` so the deferred click-to-preview (D1) needs no formatter change. Extensibility already designed in. | **CLEAN** (handled) |
| **A7 symmetry / family-completeness** | In-play **Take back** reuses the coached takeback's wording (`play.takeBack` ↔ `play.coachTakeBack`) → consistent vocabulary. Confirm-before-destructive: resign is now guarded; `newGame` is only reachable when idle/over (no mid-game discard to confirm) → family complete for destructive actions. Rematch sits symmetric to New game. | **CLEAN** |
| **A8 honest framing** | The on-demand check uses the **shallow depth-8** `coachEvalBad`; its verdict is a quick nudge, **not** an authoritative engine assessment, and can disagree with the post-game full-strength analysis. The spec calls it "advisory/best-effort" but should state the *shallow-and-may-differ* limit explicitly so the verdict isn't over-trusted (parallels F2's B2-limitation honesty note). Also: B2's rating-skip test may lack a pure seam — already stated honestly in §5. | **FOLD** (one honesty sentence) |

## Cycle 2 (prune)

Re-examined the 2 FOLDs; **no new items invented** (anti-fabrication holds).
- **A4** — kept, but **bounded** to the three concrete guards above (do not expand into a general
  "undo-stack" feature; D5 owns any budget model). The fix is: tighten `canTakeBack` to require **at least
  one full *player* move played** (i.e. the player has moved at least once — `history().length >= 2` for a
  White player, and for a Black player the last ply was the player's), undo **both** the bot reply and the
  player move, and **never** auto-trigger `engineMove` from `takeBack()`; disable Rematch/takeback while
  `aStatus==='analyzing'` (or cancel/ignore the stale analysis result).
- **A8** — kept as a single sentence in §2 (Out/honesty) + §6 C6 (verify the shallow verdict can differ
  from the full analysis). Not a code change — a framing line.
- A1/A2/A3/A5/A6/A7 re-confirmed CLEAN/REJECT. **FOLD set = 2 (unchanged).**

## Cycle 3 (conditional / convergence)

- A4 + A7 viewed together: the takeback guard is also what keeps the destructive-action family consistent
  (a takeback that empties the board is the takeback analogue of an unconfirmed resign) — the same lens
  reinforces the same item; **no new item** emerges.
- No axis flips. **FOLD set frozen at 2. Converged** (diminishing returns: cycle 2→3 produced 0 new items).

## FOLD set (applied to the spec)

1. **(A4) Takeback degenerate-guard hardening.** Tighten `canTakeBack` so a takeback requires the player to
   have actually made a move (no undoing the bot's *opening* move when the player is Black at ply 1); undo
   **both** the bot reply and the player move so it is cleanly the player's turn; **never** auto-fire
   `engineMove` from `takeBack()`; and disable Rematch + Take-back while an analysis is in flight (or
   discard a stale `runAnalysis` result on rematch). → folded into §2, §4 A4 (`canTakeBack`/`takeBack`/
   `rematch`), §6 C5, §9 (AP-PLAYUX-10 added).
2. **(A8) Shallow-check honesty line.** State that the on-demand "Check this move" verdict is a shallow
   (depth-8) best-effort nudge that can disagree with the post-game full-strength analysis — advisory, not
   authoritative. → folded into §2 (Out), §6 C6.

## DEFER / REJECT (recorded, not folded)

- **REJECT** — merging `takeBack()` with `coachTakeBack()` (A5): different ply arity + timing; reuse the
  field-update shape only.
- **REJECT** — per-move eval / "un-mark unrated" / takeback telemetry (A1/A2): scope creep or fabrication.
- **DEFER** (already in spec §11): click-to-preview a ply + ←/→ nav (D1), alternate-color rematch (D2),
  Svelte component-test harness (D3), deep "why" on the checked move (D4), takeback budget/cap (D5),
  move-list export (D6 → F5).
