# Arbitrages — `chess960` spec (decisions for the user)

**Spec:** `specs/chess960-spec.md` · **Date:** 2026-06-02 · **Cycles:** 2 (cycle 3 skipped — clean).
These are the open decisions surfaced by the draft. Each carries a **recommendation**; the spec is
written to the recommended default but each can be flipped at implementation without restructuring.

| ID | Decision | Options | **Recommendation** | Why |
|----|----------|---------|--------------------|-----|
| **Q-A** | 960 start-position selection UX | (a) random only · (b) SP-ID picker 0–959 only · (c) both | **(c) both** — default "Random 960" + optional SP-ID field | Cheap once the generator is SP-ID-addressable; SP-ID is the standard way to name/replay a 960 position (reproducible study). |
| **Q-B** | How the human inputs a castle | (a) drag king onto own rook · (b) drag king to g/c target · (c) both | **(a) king-onto-own-rook** | Only encoding that's unambiguous in *every* 960 layout — king-to-g can equal a normal 1-square king move; a king never legally lands on its own rook except to castle. Show a hint. |
| **Q-C** | Timed vs untimed first | (a) untimed-only v1 · (b) timed (needs `time-controls`) | **(a) untimed-only** | Decouples 960 from `time-controls`; `GameRecord.timeControl` written `untimed:true`. Timed 960 is a 1-line follow-up once both ship (§11). |
| **Q-D** | Auto-analysis of 960 games in v1 | (a) accept limitation, defer · (b) block 960 until analysis supports it | **(a) defer; disable "Analyse" for 960** | The analysis pipeline (motif tags, ECO naming, win% curve, std castling) assumes standard rules — feeding it a 960 game gives *wrong* output, a worse honesty violation than offering none. State the limit in-UI + §11. |
| **Q-E** | `UCI_Chess960` acceptance gate | (a) G-gate in-browser, **both** lite + MT builds play a legal castle · (b) trust the option | **(a) G-gate both builds** | A unit test can't prove a vendored WASM build honours a UCI option; lite is the universal fallback (ADR-0004) so it must pass too, not just MT. The whole feature rests on this. |
| **Q-F** | Where `RatingPool` (incl. `chess960`) is defined | (a) `time-controls` owns it; chess960 only populates `chess960` · (b) if chess960 ships first, define union + `PlayerModel` reshape here | **(a) time-controls owns** | Matches the scan's authoritative contract; avoids a migration conflict. **Fallback baked into §4.6:** if `time-controls` is unshipped at 960's implementation, 960 defines the union + reshape itself (idempotent), and time-controls later no-ops it. |

## Notes for the decider
- **Q-D and Q-C are the two honest v1 limitations.** Both are explicitly deferred in §11 with the
  follow-up that lifts them (960-aware `runAnalysis`; timed-960 under `time-controls`' `Clock`).
- **Q-E is a STOP gate, not just a preference:** if either Stockfish build fails to play a legal 960
  castle in-browser, the feature cannot ship honestly on that build → escalate.
- **Q-F decides sequencing, not capability:** ship order in the scan is clock-first, chess960-last, so
  (a) is the expected path; the §4.6 fallback only matters if that order changes.
- **README override (not an arbitrage, but a flagged reversal):** this spec overrides README line 5's
  "no variant catalogue" — narrowly, for exactly one on-doctrine variant (Chess960, anti-memorisation).
  The override is recorded in ADR-0041 and the README line is amended (§7). Matchmaking/social non-goals
  stand.

## Verified empirical facts underpinning the design (no decision needed — cited so the decider trusts the shim scope)
1. chess.js 1.4.0 loads a 960 start FEN but generates **0 castling moves** in a non-standard back-rank
   (king b1, rooks a1/c1, `KQkq` → 19 moves, 0 castles). Standard a1/e1/h1 layout → 2 castles. So
   castling is hardcoded to standard files → **shim mandatory**.
2. chess.js **rejects** Shredder/X-FEN file-letter rights (`ACac` → "Invalid FEN") — accepts only
   `KQkq`. → chess.js keeps `KQkq`; the engine gets X-FEN/Shredder via `fenForEngine()`.
3. chess.js accepts `KQkq` even with **two rooks on one side of the king** and echoes it verbatim → its
   castling field is **ambiguous/decorative in 960**; the shim's rook-file model is the sole rights
   source (AP-960-11).
