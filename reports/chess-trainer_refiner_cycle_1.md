# Refiner cycle 1 — critical defect detection

**Target:** specs/phase1-mvp-spec.md + phase2-loop-spec.md + phase3-retention-spec.md + phase4-refinements-spec.md
**Date:** 2026-05-31

## Critical-defect classes (skill §4.1)

| Class | Finding | Verdict |
|---|---|---|
| Scope obsolete | N/A — greenfield, nothing to be already-done | clear |
| Path stale | N/A — no existing files/symbols | clear |
| Foundation premise wrong | **C1 (see below)** engine-build vs Phase 2 benchmark tension | resolvable → arbitrage, NOT a hard stop |
| Schema/metric non-canonical | C2 gaffe metric (cp vs win-prob) | resolvable → arbitrage Q-F |
| Inferred values w/o empirical block | C3 all Phase 2–4 numbers estimated; C4 dep/toolchain unverified | disclosed → banners + pre-flight gates |

**No hard-stop critical defect.** No spec is doomed/un-executable. The premise tensions are surfaced and converted to arbitrages + pre-flight gates. Proceed to cycle 2.

## C1 — engine build vs Phase 2 benchmark (most important finding)
Phase 1 mandates Stockfish **lite single-thread** (~7MB, no COOP/COEP). Phase 2 requires a **40-move game analysed in < 30s** client-side. ~80 plies single-threaded at a meaningful per-ply budget sits right at the 30s edge and blows past it at any real depth. This is a genuine cross-spec tension.
- **Resolution:** arbitrage **Q-C** (movetime cap per ply / background-incremental analysis / opt-in multi-thread+COOP-COEP). Phase 2 already carries pre-flight **G2** (perf probe) with escalation. Surface Q-C prominently; do not let Phase 1 lock the engine choice without acknowledging Phase 2's need.

## C2 — gaffe metric (Phase 2)
Raw centipawn thresholds misbehave across eval ranges. → arbitrage **Q-F** (recommend win-probability delta). Already reflected in the Phase 2 spec.

## C3 — estimated premises (Phases 2–4)
Unavoidable: their baseline is Phase 1 code that doesn't exist. Disclosed via ESTIMATED banners + "capture at exec time" §1 tables. Honest, not hidden.

## C4 — empirical scan (RESOLVED)
Shell/read output was buffered and appeared empty mid-session, then landed complete. Scan is **verified**, not degraded: node v20.20.2 / npm 10.8.2 / git 2.54.0; deps versioned + licensed in baseline.json. New finding: npm `stockfish` 18.0.7 unpacks to ~251MB → extract only the lite asset (folded into G3 + Q-C).

## Non-critical patches → cycle 2
- P1: Phase 1 §2 adds onboarding calibration beyond the brief's literal Phase 1 list (needed to seed Glicko) — note as a deliberate scope choice.
- P2: UI framework undecided (Q-D) blocks the skeleton — must be a clear arbitrage.
- P3: Puzzle subset size/format (Q-E) underspecified — arbitrage.
- P4: "Resilience/rebound" radar dimension (Phase 2) is vaguely defined — flag for definition.
- P5: Project location + git init (Q-G) — confirm with user.
