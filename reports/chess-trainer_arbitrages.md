# Arbitrages — chess progression trainer (4-phase series)

## ✅ DECISIONS APPLIED (2026-05-31)

User picks: **Q-A:b · Q-B:a · Q-C:a · Q-D:a · Q-E:a · Q-F:a · Q-G:a**. Phase-local Q-H/Q-I/Q-J recommendations confirmed. **New requirement:** launch-time skill evaluation (method = my call → two-stage adaptive onboarding).

What changed in the specs:
- **Q-A:b (local-only)** → no `LICENSE` file; ship `ATTRIBUTION.md` + a posture note. GPL obligations dormant until distribution/hosting. (ADR-0002)
- **Q-D:a** → Svelte baked into Phase 1 skeleton + Phase 2 dashboard.
- **Q-B:a × Q-A:b interaction (NEW FINDING):** no distribution + no backend in scope ⇒ **Maia drops out of Phase 4 entirely** until a backend is opted into (which would re-open licensing → GPL/AGPL on hosting). Flagged in Phase 4 §0.5.
- **Launch-time evaluation** → Phase 1 §2.7/§4.8: Stage 1 adaptive puzzle ladder (seeds puzzle rating) + Stage 2 optional calibration game with **live single-position ACPL** (seeds game rating; reuses Phase-1 engine worker, NOT Phase-2 batch analysis); skip path → wide-RD provisional game rating. Phase 2 upgrades Stage 2 to a fully-analyzed game. New AP-CHESS-23/24. ADR-0005.
- **Q-H** Syzygy is the lone network egress in a local-only app → disclose (AP-CHESS-17). **Q-F:a** win-prob delta. **Q-C:a** hybrid (< 30s stays Phase 2 perf gate G2).

**Open micro-confirms (non-blocking):** (1) "resilience" radar dimension = *eval recovery rate after falling behind* — OK? (2) calibration ladder length ~6–10 and Stage-2-optional — OK?

The Q&A below is kept for the record; all are now resolved.

---

## Critical structural defects (cycle 1 stops)
**None.** No spec is doomed. The one real cross-spec tension (engine build vs Phase 2's <30s benchmark) is resolvable via Q-C below + a Phase 2 perf gate. One honesty caveat stands on the record: Phases 2–4 premises are **estimated** (their baseline is Phase 1 code that doesn't exist yet) and must be re-baselined before executing each. (The dependency/toolchain scan itself is **verified**, not estimated — node v20.20.2, and all deps versioned + licensed in `phase1-mvp_baseline.json`.)

## Decisions requested from you

### Q-A — Licensing posture *(blocks Phase 1 README/LICENSE)*
chessground **and** Stockfish are GPL-3.0. Stockfish has no permissive equivalent → GPL is effectively forced *if you distribute the app*.
- (a) **Embrace GPL-3.0, publish source** — keep chessground (9.2.1 GPL-3.0) + Stockfish (18.0.7 GPL-3.0), ship under GPL-3.0. (If Q-C later picks `lila-stockfish-web` multi-thread, license escalates to **AGPL-3.0**.)
- (b) Local-only / no distribution — GPL obligations don't trigger if you never distribute; revisit if you ever host it publicly.
- (c) Avoid copyleft — infeasible: you'd lose chessground's native arrows (swap to chessboard.js) *and* still can't escape Stockfish's GPL.
**Recommendation: (a)** if you'll host/share it; **(b)** if it's purely personal. Either way you keep the chosen stack.

### Q-B — Maia strategy *(shapes Phase 1 opponent + Phase 4)*
- (a) **Stockfish-calibrated only for v1**, Maia deferred to Phase 4 (backend or lc0-WASM) — keeps the true client-only PWA goal.
- (b) Light backend now to host Maia — adds infra + privacy surface (moves leave the device); lc0 isn't trivially serverless.
- (c) Maia in-browser via lc0 WASM now — experimental, heavy weights, non-trivial.
**Recommendation: (a)** — the brief itself says treat Maia as v2 if client-only.

### Q-C — Engine build for Phase 2 batch analysis *(the one cross-spec tension)*
Phase 1 default is lite single-thread (no COOP/COEP). Phase 2 needs a 40-move game in <30s.
- (a) **Hybrid:** lite single-thread default (extract the ~7MB lite asset from the 251MB `stockfish` package) + fixed movetime/ply for batch + background-incremental analysis. Multi-thread (`lila-stockfish-web`, AGPL) offered only where the host supports COOP/COEP.
- (b) Adopt multi-thread + COOP/COEP everywhere — fastest analysis, but breaks on hosts that can't set those headers.
- (c) Lite single-thread only, accept shallower batch precision.
**Recommendation: (a).**

### Q-D — UI framework *(blocks Phase 1 skeleton)*
- (a) **Svelte** — lean, reactive, great for the dashboards/radar later.
- (b) Vanilla TS + Lit — minimal deps, most "library-light".
- (c) React — most familiar, heaviest.
**Recommendation: (a) Svelte**, or (b) if you want minimal dependencies. chessground is framework-agnostic DOM, so any works.

### Q-E — Puzzle subset (size + format) *(blocks Phase 1 trainer)*
The full Lichess DB (~5.94M, hundreds of MB) can't ship to the client.
- (a) **Build-time Node ETL → ~50–100k curated** (filtered by theme/rating spread/popularity), shipped compressed, seeded into IndexedDB on first run.
- (b) Same ETL but ship as a prebuilt SQLite loaded via sql.js (better for complex queries).
- (c) Sharded JSON by rating band, lazy-loaded.
**Recommendation: (a)** for Phase 1; move to (b) if query needs outgrow it.

### Q-F — Gaffe classification metric *(Phase 2)*
- (a) **Win-probability delta** (consistent across eval ranges) with a centipawn fallback.
- (b) Raw centipawn thresholds only (simpler, but a 200cp swing means different things at ±50 vs ±900).
**Recommendation: (a).**

### Q-G — Project location *(blocks everything)*
Build in `D:/Download/Chess` (currently empty, not a git repo)?
- (a) **Yes — `git init` here and scaffold in place.**
- (b) Different path / move first.
**Recommendation: (a).**

## Phase-local decisions (recommendations already baked into the specs — confirm or override)
- **Q-H** Syzygy: API + aggressive cache first; bundle 3-4-5-piece tables only if rate-limited. (Phase 3)
- **Q-I** FSRS grades: fail→again, slow-pass→hard, clean→good, fast-clean→easy. (Phase 3)
- **Q-J** NL "why": rule-based templates, **no LLM** (per brief). (Phase 4)
- **"Resilience" radar dimension:** proposed definition = *eval recovery rate after falling behind*. Confirm. (Phase 2)

## Auto-applied patches (no input needed)
ADR numbering deconflicted across phases (0001–0012); anti-pattern IDs made sequential/greppable (AP-CHESS-1..22); Q-C cross-linked in Phase 1 + Phase 2; Phase 4 flagged as a bundle to split per-feature at execution.

## Stop status
- Cycles run: **2/3** (cycle 3 skipped — 0 critical, 5 polish ≤ 8) + 1 post-decision patch pass (2026-05-31)
- Stop reason: **cycle-3-skip** → **decisions applied → V1 final**
- Scan status: **verified** (node v20.20.2; deps versioned/licensed in `phase1-mvp_baseline.json`)
- Specs: `specs/phase1-mvp-spec.md` (REAL premise, **ready to execute**) · `phase2-loop-spec.md` · `phase3-retention-spec.md` · `phase4-refinements-spec.md` (ESTIMATED premises — re-baseline before each)

## Next steps
1. **Phase 1 is ready to execute** (`specs/phase1-mvp-spec.md`). Run pre-flight gates G1–G5 first.
2. Optionally confirm the 2 micro-confirms above (resilience definition, ladder length) — defaults stand otherwise.
3. To start the build, say so — I'll begin with the skeleton (G1: `git init` + Vite+TS+Svelte scaffold).
4. Re-baseline Phases 2–4 against real Phase 1 code before executing each.
