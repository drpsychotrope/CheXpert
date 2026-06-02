# Refiner — `chess960` spec, cycle 1

**Date:** 2026-06-02 · **Input:** `specs/chess960-spec.md` (V0) · **Method:** draft-general §4 adversarial pass.
**Verdict:** no critical structural defect → proceed to cycle 2. 1 correctness tightening (CR-1), 6 polish.

## Critical defects (block → would STOP + escalate)
**None.** The spec correctly identifies the castling shim as the load-bearing risk, namespaces a
G-gate on both engine builds, keeps DB at v4, and defers analysis honestly. Scope is single-concern.

## Correctness findings (must fix in V1)

- **CR-1 (correctness) — chess.js `KQkq` is *ambiguous/unreliable* as a 960 rights source; the spec
  implies it only at §4.2 but doesn't forbid trusting it.** New probe this cycle: chess.js accepts
  `KQkq` on layouts with **two rooks on the same side of the king** (e.g. `RKR1BNQB` — king b1, rooks
  a1 AND c1) and **echoes `KQkq` back verbatim**. So chess.js's castling field cannot tell which rook
  backs the K-side vs Q-side right — it is *decorative* in 960. The shim already tracks rights "by rook
  file" (correct), but the spec must **explicitly state that the chess.js `KQkq` field is ignored as a
  rights source in 960; the shim's rook-file model is the sole source of truth.** This also confirms the
  §4.2 X-FEN/Shredder split is *necessary* (the ambiguous inner-rook case genuinely needs Shredder
  letters). → **Fix:** add a sentence to §4.2 ("chess.js `KQkq` is ignored as a rights source in 960…")
  and an anti-pattern. *(Applied in V1.)*

## Polish (P-N)

- **P-1** — §6 G-gate #3 should name **how** to force each build (it does: `forceLiteFallback` for lite,
  crossOriginIsolated for MT) — good, but add that the gate must use a **position where the bot's best
  move IS a castle** (otherwise "returns a castle bestmove" is untestable). *(Applied: clarified "from a
  position where the bot *should* castle".)*
- **P-2** — §4.4 reset-for-standard: the analyse path already resets `UCI_LimitStrength`; the spec says
  add a `UCI_Chess960 false` reset "there and on a standard newGame." Confirm both call sites — kept;
  AP-960-4 covers it.
- **P-3** — §5.2 table test: explicitly include the **SP-518 (standard) layout in the 960 table** to
  prove the shim's generalised path produces the *same* castle as standard, not only the §5.3 chess.js
  path. *(Already listed "the standard 518" in the table set — kept; it's the cross-check.)*
- **P-4** — §0.5 Q-B disambiguation argument ("king never legally lands on its own rook unless
  castling") is the crux of the UX choice; it appears in §0.5 and §4.2 and AP-960-9 — consistent, good.
- **P-5** — §11 ordering: 960 auto-analysis is correctly flagged as the biggest follow-up and the one
  that lifts Q-D; timed-960 lifts Q-C. Both cross-referenced to their arbitrage. Good.
- **P-6** — Anti-pattern count (10) is high but each maps to a distinct, verified failure mode (fork
  chess.js, hardcode geometry, trust UCI option, respawn drop, mis-route UCI, analyse 960, pool
  contamination, version bump, ambiguous UX, impurity). No padding. Kept.

## Cross-spec / contract conformance
- `RatingPool`/`PlayerModel` ownership matches the scan contract (time-controls owns; chess960
  populates `chess960`; §4.6 fallback idempotent). ✓
- `GameRecord.variant`/`startFen` ownership = this spec; additive, no bump. ✓
- DB stays v4 (no new store). ✓
- Doctrine: pure cores, rand injected, no LLM, honesty (analysis disabled not faked), phase order
  code→tests→verify→docs. ✓
- ADR appended at implementation time (ADR-0041 provisional); README override called out in §0 + §7 +
  the ADR. ✓

## Delta vs V0
Apply CR-1 (one sentence in §4.2 + one anti-pattern AP-960-11, or fold into AP-960-2). P-1 wording
already tight. Net change small but correctness-relevant → justifies cycle 2.
