# Spec — Phase 3: retention + endgames

**Status:** V1 (draft-general output) · **Scope:** feature
> ⚠ **PREMISE ESTIMATED.** Depends on Phase 1 (trainer, store) and Phase 2 (personal puzzles, weakness profile) code that does not exist yet. Re-baseline against real code before executing.

---

## §0 Context

Phases 1–2 produce puzzles and a weakness profile but nothing *schedules* them for long-term retention — and the brief is explicit that spaced practice of one's weaknesses is the strongest lever. Phase 3 adds the retention engine (FSRS) and the endgame trainer with perfect feedback (Syzygy). Together they make the loop *stick*.

Depends on: Phase 1 trainer + IndexedDB; Phase 2 personal puzzles + weakness dimensions; `EngineClient` for endgame play.

## §0.5 Arbitrages — CONFIRMED (2026-05-31, recommendations stand)

- **Q-H Syzygy source → API + aggressive IndexedDB cache first**; bundle 3-4-5-piece tables locally only if rate limits bite. ⚠ This API call is the **one network egress** in an otherwise local-only app (Q-A=b) — position-only, no identity; disclose it (AP-CHESS-17). See ADR-0009.
- **Q-I FSRS grade mapping → fail→again; slow-pass→hard; clean→good; fast-clean→easy** (tunable). See ADR-0008.

## §1 Empirical baseline *(capture at exec time)*

- Phase 1 `puzzleAttempt` shape + trainer hook points (FSRS wraps these).
- Phase 2 personal-puzzle store schema (FSRS cards reference these).
- ts-fsrs API surface (version 5.4.1 / MIT verified 2026-05-31; confirm API at pre-flight).

## §2 Scope

**IN:**
1. **FSRS scheduler** (`ts-fsrs`) — one card per trainable item (personal puzzle, weakness drill, opening line). Difficulty/Stability/Retrievability on the power-law forgetting curve. Daily "due" queue feeds the trainer.
2. **Review integration** — trainer solve result + time → FSRS grade (Q-I) → next interval. Cards persist in a new `srsCards` store (schema v3 migration).
3. **Endgame trainer** — drill sets: K+P vs K, rook endings, basic mates (K+Q, K+R). Play vs `EngineClient`; **perfect feedback via Syzygy** (WDL + DTZ + best moves, ≤ 7 pieces). Cache every API result in IndexedDB; respect rate limits (Q-H).
4. **Opening repertoire builder** — build lines (named via Lichess `chess-openings` CC0), drill them under FSRS (Chessable-style). (Maia showing "what humans at your level actually play" is Phase 4.)

**OUT / DEFERRED:** Woodpecker fixed-set mode → Phase 4. Maia in repertoire → Phase 4. NL annotations → Phase 4.

## §3 Pre-flight gates

| Gate | Check | Stop-if-fail |
|---|---|---|
| G1 | Phases 1–2 shipped and green | yes |
| G2 | `ts-fsrs` installs; version/API confirmed; recorded in dep_check | yes |
| G3 | Syzygy API reachable; response schema parsed; **cache layer** in place before any volume use | yes |
| G4 | IndexedDB v2→v3 migration adds `srsCards`/`repertoire` without loss | yes |

## §4 Phase A — code (ordered)

1. `srsCards` + `repertoire` stores (schema v3 migration).
2. FSRS module wrapping ts-fsrs: create/update card, compute due queue.
3. Trainer ↔ FSRS hook: on solve, grade (Q-I) → schedule.
4. Syzygy client: fetch WDL/DTZ/best moves; **cache-first** (IndexedDB), backoff on rate limit (Q-H); optional local 3-4-5 bundle behind a flag.
5. Endgame trainer UI: drill picker, play vs engine, Syzygy "perfect move" feedback + DTZ countdown.
6. Repertoire builder UI: add lines, name via chess-openings, drill via FSRS due queue.

## §5 Phase B — tests

- FSRS scheduling vs ts-fsrs reference outputs; grade-mapping table (Q-I).
- Syzygy client: cache hit avoids network; rate-limit backoff; correct WDL/DTZ parse on fixtures.
- Endgame correctness: engine + Syzygy agree on KPvK / rook-ending fixtures.
- Migration v2→v3 preserves prior data.

## §6 Phase C — verification

| Gate | Target |
|---|---|
| Due queue | correct cards surface on the right day |
| Syzygy feedback | matches known DTZ/WDL on fixtures; cached results never re-hit network |
| Endgame drills | perfect-play feedback present for ≤7-piece positions |
| Repertoire | lines drillable and scheduled |

## §7 Phase Z — docs

- `decisions.md` (append): ADR-0008 FSRS adoption + grade mapping (Q-I), ADR-0009 Syzygy caching strategy (Q-H).
- README: review/retention + endgame trainer usage; note Syzygy is an external API call (the one place data touches the network — disclose, it's position-only, no identity).

## §8 Acceptance criteria

- [ ] Personal puzzles + weakness drills + repertoire lines all schedule under FSRS.
- [ ] Daily due queue drives the trainer.
- [ ] Endgame trainer gives Syzygy-perfect feedback, cached, rate-limit-safe.
- [ ] Migrations safe; privacy disclosure for the Syzygy call present.

## §9 Anti-patterns

- **AP-CHESS-14** — hammering the Syzygy API (no cache). Cache-first, always.
- **AP-CHESS-15** — SRS without active recall (showing the answer instead of requiring the move).
- **AP-CHESS-16** — FSRS grades inferred sloppily (e.g. ignoring time), corrupting intervals. Map deliberately (Q-I).
- **AP-CHESS-17** — silently sending position data to the Syzygy API without disclosing it. Disclose; it's the one network egress.

## §10 Rollback

Per-feature commits. v2→v3 migration gated + backed up. Syzygy is read-only/external — disabling it degrades gracefully to engine-only feedback.

## §11 Follow-up

Phase 4: Woodpecker fixed-set mode, Maia in repertoire/sparring, NL "why", calc drills, and the loop-closing opponent that probes the weakness profile.
