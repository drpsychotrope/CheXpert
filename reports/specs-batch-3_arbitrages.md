# Consolidated arbitrages — specs batch 3 (clock, modes, pedagogy)

6 single-concern specs drafted via /draft-general (2 refiner cycles each; cycle 3 skipped per stop rule).
Full per-spec detail in `reports/<pr-name>_arbitrages.md`. This file is the consolidated user handoff.

**All recommended defaults are shippable as-is.** Reply only with the items you want to change.
Shorthand to accept everything: "all recs".

## Batch overview

| pr-name | spec | lines | cycles | ADR | DB |
|---|---|---|---|---|---|
| time-controls | specs/time-controls-spec.md | 348 | 2 | 0036 | v4 (field reshape, no bump) |
| metacognition | specs/metacognition-spec.md | 397 | 2 | 0037 | v4 (additive fields) |
| critical-moment-drill | specs/critical-moment-drill-spec.md | 306 | 2 | 0038 | v4 (no change) |
| efficacy-session | specs/efficacy-session-spec.md | 369 | 2 | 0039 | v4 OR v5 (see B1) |
| concept-cards | specs/concept-cards-spec.md | 307 | 2 | 0040 | v4 (additive field) |
| chess960 | specs/chess960-spec.md | 470 | 2 | 0041 | v4 (additive fields) |

Recommended ship order: **time-controls → metacognition → critical-moment-drill → efficacy-session(readout) → concept-cards → chess960**.

## HIGH-STAKES decisions (please confirm explicitly)

### B1 — efficacy-session: split + persistence (two coupled calls)
- **Split?** Recommend **YES** — ship the efficacy *readout* (zero-schema, Insights panel) as its own spec first; defer the *session runner*. De-risks: readout needs no store/nav, runner does.
- **`sessions` store / v4→v5 bump?** Recommend **derive, NO bump** unless you specifically want persisted free-text reflection notes (the only thing a derive-path can't reconstruct). A bump also forces updating `db.test.ts` (`DB_VERSION===4` + store-count assertions). → This keeps the **entire batch at v4**.

### B2 — chess960 v1 scope cuts (real deferrals)
- **Untimed-only v1** (decouple from time-controls clock). Recommend **accept** (timed 960 = §11 once time-controls ships).
- **No auto-analysis for 960 v1** — the analysis pipeline assumes standard rules; faking it would be a worse honesty violation. Recommend **accept**; disable the "Analyse" button for 960 games, defer to §11.
- Confirms a real cost: 960 ships as a *playable, rated, but not-analyzed* mode first.

### B3 — metacognition: default OFF (opt-in)
- Recommend the whole feature is an **opt-in setting, default OFF**, to protect the active-recall flow (confidence/self-tag chips add friction). Turn-on lives in Settings + Insights.

### B4 — critical-moment-drill: the "only-move" signal is not in stored data
- Empirical: `BatchAnalyzer` stores ONE eval per position (ADR-0006) — no second-best line. So "this was the only good move" can't be computed from stored analysis.
- Recommend **(a)** build the drill on realized `winProbLoss` now; **(b)** add `secondBestCp` via a one-shot `analyzeLines(multipv:2)` *during analysis* as a separate §11 follow-up spec (re-analysis needed for old games).

### B5 — ship order / how many to plan now
- Confirm the order above, and whether writing-plans should start with **just time-controls** (foundational, your stated pain) or fan out to all 6.

## Per-spec arbitrages (recommended defaults — override only what you dislike)

### time-controls (Q-A…Q-F)
- Q-A presets: Bullet 1+0/2+1 · Blitz 3+2/5+0 · Rapid 10+0/15+10 · Classical 30+0 · No clock · Custom. **rec a**
- Q-B "No clock" → classical pool + `untimed:true` flag (not a separate 'unlimited' pool). **rec a**
- Q-C flag vs lone king w/ no mating material → FIDE **draw**. **rec a**
- Q-D movesLeftEstimate phase-aware `max(8, 40 − floor(ply/2))`. **rec a**
- Q-E switching TC keeps each pool's persisted Elo (no reset). **rec a**
- Q-F Play header shows selected pool; Dashboard/Home/Insights show classical headline (multi-rating UI → §11). **rec a**

### metacognition (Q-A…Q-H)
- Q-A opt-in master switch default-OFF (**rec a**, = B3) · Q-B metric = confidence×accuracy table, not Brier (**rec a**) · Q-C chips in Tactics+Calculate, Review deferred — accepts that Calculate begins logging attempts (**rec a**) · Q-D self-tag on miss only (**rec a**) · Q-E ship the closed seed taxonomy as-is (**rec a**) · Q-F inline chip markup, not a shared component (**rec a**) · Q-G surface in Insights, not Dashboard (**rec a**) · Q-H calibration sample floor = 10 (**rec a**).

### critical-moment-drill (Q-A…Q-G)
- Q-A CRITICAL = `winProbLoss ≥ 15`, ROUTINE ≤ 3, ambiguous band excluded (**rec a**) · Q-B only-move signal dropped now / §11 follow-up (**rec a**, = B4) · Q-C ROUTINE excludes trivial recaptures (**rec a**) · Q-D binary scoring, show raw swing (no accuracy %) (**rec a**) · Q-E fallback = small curated static FEN set (**rec a**) · Q-F Dashboard-only, no new nav button (comeback precedent) (**rec a**) · Q-G companion to the timeManagement route, additive (no weakness.ts change) (**rec a**).

### efficacy-session (Q-A…Q-G)
- Q-A split, ship readout first (**rec a**, = B1) · Q-B sessions store only if runner+reflection (**rec**, = B1) · Q-C verbatim honesty caveat echoing README (**rec a**) · Q-D metric = two windows (early/recent at median `analyzedAt`), phase-scoped denominator + minMoves gate (**rec a**) · Q-E runner embeds trainer components in a session shell (**rec a**) · Q-F include Review when `dueCount>0` (**rec a**) · Q-G entry = Insights "Start session" button, no new nav (**rec a**).

### concept-cards (Q-A…Q-G)
- Q-A 7 family cards (sub-tags alias to family) (**rec a**) · Q-B leech threshold N=3 (**rec a**) · Q-C first-exposure tracked via `PlayerModel.conceptSeen` (**rec a**) · Q-D optional non-blocking "Learn the pattern" link, not a modal (**rec a**) · Q-E curated seed FENs now; derive-from-user-misses → §11 (**rec a**) · Q-F index in both nav library + contextual links (**rec a**) · Q-G seed-test asserts FEN+key-move legality + coverage == detector set, defer asserting the detector fires (**rec a**).

### chess960 (Q-A…Q-F)
- Q-A start position = both (random default + optional SP-ID 0–959 picker) (**rec c**) · Q-B castle input = drag king onto own rook (only unambiguous encoding) (**rec a**) · Q-C untimed-only v1 (**rec a**, = B2) · Q-D defer auto-analysis, disable Analyse for 960 (**rec a**, = B2) · Q-E `UCI_Chess960` in-browser G-gate on BOTH lite+MT builds — a STOP gate, not a preference (**rec a**) · Q-F time-controls owns RatingPool union incl. `chess960`; idempotent fallback if 960 ships first (**rec a**).

## Stop status
- Cycles run: 2/3 per spec (cycle 3 skipped — clean cycle 2, ≤8 polish).
- Defects fixed mid-refine: time-controls (tick-during-thinking), chess960 (chess.js rights unreliable → shim is sole source), concept-cards (leech vs first-exposure trigger independence), critical-moment-drill (only-move signal not in stored data → rebuilt on winProbLoss).
- No critical-defect STOP; no cross-spec conflict; batch stays at DB v4 (v5 only if B1 picks a sessions store).

## Next steps
1. Reply with decisions — e.g. "all recs" or "B1 keep bundled + v5 store; chess960 deferred; rest recs".
2. Drafter applies chosen decisions as a final V1 patch per spec.
3. Then: writing-plans turns the approved spec(s) into implementation plans (recommend starting with time-controls).
