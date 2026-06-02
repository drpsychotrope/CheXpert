# Decisions applied — specs batch 3 (clock, modes, pedagogy)

User decision 2026-06-02: **"all recs, fan out plans for all 6."**
→ Every arbitrage resolved to the refiner's recommended option. Plans written for all 6 specs.

## Batch-level (B1–B5)

- **B1 efficacy-session** — SPLIT accepted (ship efficacy *readout* first, then runner) + **DERIVE, no `sessions` store, no v4→v5 bump**. Whole batch stays **DB v4**. Spec patched (§0.6). Reflection display-only (persistence → §11).
- **B2 chess960** — v1 ships **untimed-only** + **not auto-analyzed** (Analyse disabled for 960 games). Playable + rated now; timed 960 + analysis → §11.
- **B3 metacognition** — **opt-in, default OFF**. Toggle in Settings + Insights.
- **B4 critical-moment-drill** — build on realized `winProbLoss`; the "only-move"/`secondBestCp` signal is **not in stored analysis** (one eval/position, ADR-0006) → deferred §11 (needs an analysis-path change + re-analysis of old games).
- **B5 scope** — **fan out plans for all 6** specs (not time-controls-only).

## Per-spec arbitrages — all resolved to rec (a) unless noted

- **time-controls** Q-A presets (Bullet 1+0/2+1·Blitz 3+2/5+0·Rapid 10+0/15+10·Classical 30+0·No clock·Custom) · Q-B "No clock"→classical pool + `untimed:true` · Q-C flag vs lone-king-no-mate = FIDE draw · Q-D movesLeftEstimate `max(8, 40−floor(ply/2))` · Q-E keep per-pool Elo on TC switch · Q-F Play header = selected pool, Dashboard/Home/Insights = classical headline (multi-rating UI → §11).
- **metacognition** Q-A opt-in default-OFF · Q-B confidence×accuracy table (not Brier) · Q-C chips in Tactics+Calculate (Calculate begins logging attempts), Review deferred · Q-D self-tag miss-only · Q-E closed seed taxonomy as-is · Q-F inline chip markup · Q-G Insights (not Dashboard) · Q-H sample floor 10.
- **critical-moment-drill** Q-A CRITICAL `winProbLoss≥15` / ROUTINE ≤3 / ambiguous excluded · Q-B drop only-move now (§11 follow-up) · Q-C ROUTINE excludes trivial recaptures · Q-D binary scoring, show raw swing · Q-E curated static FEN fallback set · Q-F Dashboard-only (no nav button) · Q-G companion to timeManagement route (additive, no weakness.ts change).
- **efficacy-session** Q-A split/readout-first · Q-B derive/no-bump · Q-C verbatim caveat · Q-D two-window median split + phase-scoped denominator + minMoves · Q-E runner launches existing trainers · Q-F include Review when due>0 · Q-G Insights "Start session" entry.
- **concept-cards** Q-A 7 family cards (sub-tags alias) · Q-B leech threshold N=3 · Q-C `PlayerModel.conceptSeen` · Q-D optional non-blocking link (not modal) · Q-E curated seed FENs now (derive-from-misses → §11) · Q-F index in nav library + contextual links · Q-G seed-test asserts FEN+key-move legality + coverage==detector set.
- **chess960** Q-A both (random default + SP-ID 0–959 picker) · Q-B drag king onto own rook · Q-C untimed-only v1 · Q-D defer auto-analysis, disable Analyse for 960 · Q-E `UCI_Chess960` in-browser G-gate on BOTH lite+MT (STOP gate) · Q-F time-controls owns RatingPool union incl. `chess960`, idempotent fallback if 960 ships first.

## Ship order (recommended)

time-controls → metacognition → critical-moment-drill → efficacy-session(readout) → concept-cards → chess960.

## ADR ids (provisional, assigned at implementation)

0036 time-controls · 0037 metacognition · 0038 critical-moment-drill · 0039 efficacy-session · 0040 concept-cards · 0041 chess960. (All distinct; current max = ADR-0035.)
