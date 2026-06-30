# T3 `trainer-integrity-retention` — /enrich (3 cycles)

**Method**: 8-axis sweep for NOTABLE enrichments (not defects), verdict FOLD / DEFER / REJECT per finding.
**Anti-fabrication**: empty axis = CLEAN (say so; do not invent). The FOLD set must stay small and real — no filler to hit a count. Precedents cited are **this repo's** (chess-trainer), not Tradingbot's.

---

## Cycle 1 — 8-axis sweep

| # | Axis | Finding | Verdict |
|---|---|---|---|
| 1 | **Capability gap** | The clamp withholds the Glicko **gain** on a hinted solve, but the player gets no closure that the *reason* the card returns is the hint. A small "(hint used)" marker on the solved feedback closes that gap honestly. | **FOLD** (already added cycle-3 of draft as `tactics.hintedTag`; keep) |
| 2 | **Capability gap** | Streak is shown only inside the trainer. The app's existing re-engagement surface is `app.dueReview` (Home/Review badge). Surfacing the streak on **Home** too would put the retention signal where re-engagement actually happens. | **FOLD** (small) — add the streak line to Home alongside `dueReview`; reuses `app.model.dailyStreak`, one render site, no new logic. |
| 3 | **Observability** | The impulsivity readout reports a pattern but not the underlying split counts. Exposing `fastTotal`/`slowTotal` (the denominators) in the readout makes the claim inspectable ("of your N fast attempts…") — same honesty discipline as `calibration`'s `(correct/n)`. | **FOLD** (tiny) — already in the `ImpulsivityReadout` shape (`fastTotal`/`slowTotal`); ensure the Insights render shows the denominators, mirroring calibration's `(k/n)`. |
| 4 | **Render fidelity** | None. The trainer header + Insights metacog section already have a settled descriptive style; the new lines reuse it. CLEAN. | CLEAN |
| 5 | **Robustness** | `solvedToday` recomputed from `allAttempts()` each solve is O(all attempts). For a long-lived local DB this grows. The `playedAt` index already exists — counting today's solves can use a bounded range query instead of a full scan. | **FOLD** (note) — §4 A4: prefer the `playedAt` index range for "today" over `allAttempts()`; keeps the count O(today), not O(all). |
| 6 | **Reuse** | The impulsivity fast/slow threshold should reuse `DEFAULT_GRADE_THRESHOLDS.fastMs` (`fsrs.ts:25`) rather than a new magic number, so "fast" means the same thing the grader already uses. | **FOLD** (tiny) — §4 A1 already defaults `fastMs` to the FSRS `fastMs`; make the reuse explicit (import, don't re-declare). |
| 7 | **Extensibility** | `usedHint?: boolean` collapses three tiers into one bit. A future "how much did the hint help" analysis would want the tier. But recording the tier now is speculative (no consumer) and would widen the schema. | **DEFER** — keep the boolean; note in §11 that a `hintTier?: 1\|2\|3` could be added additively later if a consumer appears. Anti-fabrication: don't add an unused field. |
| 8 | **Symmetry** | Calculate.svelte is a sibling solve surface (calc drill) that also grades via FSRS and could leak the same hint-inflation. But Calculate has no `hint()` reveal of the same kind (it's a full-line entry drill), so there is no symmetric hole to close here. | **REJECT** (no symmetric defect) — verified Calculate's flow differs; folding it would be scope creep with no integrity gain. Noted as a CLEAN finding, not a FOLD. |
| 8b | **Honest framing** | The impulsivity `kind` ('impulsive'/'deliberate'/'mixed') risks reading as a label/grade on the *player*. Frame it as a pattern in the *attempts* ("your quick attempts miss more often"), not a trait. | **FOLD** (wording) — §4 A5 + AP-TINTEG-7: the sentence describes the attempts, never the person; no trait noun. |

## Cycle 2 — prune & confirm (FOLD set must not grow with filler)

Re-examined the 7 FOLD candidates; kept the ones that add real value at near-zero cost, dropped nothing as fabricated (each has a concrete site + reuses an existing hook):

**FOLDED into the spec (6, all small):**
1. `tactics.hintedTag` "(hint used)" marker on solved feedback — transparency (capability gap). *[already in V1; retained]*
2. **Streak on Home** beside `dueReview` — retention where re-engagement happens (capability gap). → add to §4 A4 + §6 manual.
3. **Show impulsivity denominators** (`fastTotal`/`slowTotal`) in the Insights render, mirroring calibration's `(k/n)` (observability). → §4 A5.
4. **`solvedToday` via the `playedAt` index range**, not a full `allAttempts()` scan (robustness). → §4 A4 + AP note.
5. **Reuse `DEFAULT_GRADE_THRESHOLDS.fastMs`** for the impulsivity "fast" threshold (reuse). → §4 A1 (make explicit).
6. **Pattern-not-trait framing** of the impulsivity sentence (honest framing). → §4 A5 + AP-TINTEG-7.

**DEFERRED (1):** `hintTier?` recording — additive-later, no consumer now (extensibility). → §11.
**REJECTED (1):** Calculate hint-clamp symmetry — no symmetric defect (verified). Not folded.
**CLEAN axes:** render fidelity (reuses settled style).

## Cycle 3 — conditional / final pass (diminishing)

- No new notable enrichment surfaced. Confirmed the 6 FOLDs are mutually consistent and none widens the schema (all are render/threshold/query refinements except the Home streak line, which reuses an existing field).
- Anti-fabrication check: the FOLD set went **draft 5 arbitrages → enrich +6 small FOLDs**, all with a concrete site and an existing hook; **1 DEFER, 1 REJECT** kept the set honest (it did not balloon). STOP.

---

## Net result

V1 spec + **6 folded enrichments** (transparency marker, Home streak, impulsivity denominators, indexed `solvedToday`, threshold reuse, pattern-not-trait framing). 1 DEFER (`hintTier?`), 1 REJECT (Calculate symmetry). No new schema field beyond the four already in V1; **no `DB_VERSION` bump**. Ready to build (Phase A code → B tests → C verify → Z docs), rebased on F3.
