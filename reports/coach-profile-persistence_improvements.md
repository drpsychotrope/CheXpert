# coach-profile-persistence (C1) — `/enrich` improvements

**Method** 3 cycles · 8-axis sweep (A1 capability · A2 observability · A3 fidelity · A4 robustness · A5 reuse ·
A6 extensibility · A7 symmetry · A8 honest framing) · verdicts FOLD / DEFER / REJECT.
**Anti-fabrication:** an axis with nothing real = **CLEAN** (not padded). The FOLD set is closed at **2** and did
**not grow** across cycles 2–3 (re-sweep produced no new FOLD).

## Cycle 1 — sweep
| Axis | Verdict | Finding |
|---|---|---|
| A1 capability | CLEAN | Resume + trend + staleness already cover what the saved profile enables; no missing capability in-scope. |
| A2 observability | CLEAN | Rebuilt program carries the same `reason` strings; movement is observable via the trend. |
| A3 fidelity | **FOLD-2** | A motif at n=2/run can show a big absolute swing that's mostly ladder noise; spec carried `nPrev`/`nCurrent` but didn't de-emphasize low-n rows. |
| A4 robustness | CLEAN | `app.model` null, undefined prev, missing `assessedAt`, empty overlap all already guarded. |
| A5 reuse | CLEAN | Trend copy mirrors `insights.*`; FOLD-2's marker must reuse `dashboard.lowData` (noted in FOLD-2), no new dup. |
| A6 extensibility | CLEAN | `CoachTrend` iterates `current.motifs` generically; C2/C4 can extend without breaking. No gold-plating added. |
| A7 symmetry | CLEAN | Intro & result trend share one core + one fragment; staleness only on intro (correct — a fresh run isn't stale). |
| A8 honest framing | **FOLD-1** | Q-A named three actions incl. `View profile`, but the always-on card already IS the view → a `View` button would be dead. Drop it; keep two buttons + always-on card. |

## Cycle 2 — prune (FOLD set must not grow)
Both folds survive scrutiny (real, in-scope, near-zero cost, reuse existing patterns). New candidates rejected to
avoid fabrication:
- Rating-history sparkline → **REJECT** (no history store; that's C7/efficacy).
- Persist `activeSession` for cross-device resume → **REJECT** (violates AP-CPROF-5; rebuild is already reload-safe).
- Expected-impact ordering on resume → **DEFER** (CO9 → C6).

**FOLD set unchanged: {FOLD-1, FOLD-2}.**

## Cycle 3 — conditional / diminishing returns
Second 8-axis pass: **all axes CLEAN**, no new FOLD (set confirmed closed at 2). Delta < 10% → stop.

## FOLDED into the spec
- **FOLD-1 (A8/A1) — drop the phantom `View profile` button.** The intro card (radar + strengths/weaknesses +
  trend) is the view; only `Start program` and `Re-assess` are buttons. Spec §1, §4.2, **AP-CPROF-8**.
- **FOLD-2 (A3) — low-confidence marker on noisy trend rows.** `MotifTrend.lowData = nPrev≤2 && nCurrent≤2`;
  `TrendList` appends the **existing** `dashboard.lowData` label (` · low data` / ` · peu de données`) — no new
  i18n key. Spec §4.1 (type + `LOW_DATA_N=2`), §4.3 (render), §10 (test), **AP-CPROF-7** note.

## DEFER / REJECT log (for traceability)
- DEFER → CO9 expected-impact ordering (C6).
- REJECT → rating-history sparkline (no store, C7), persisted `activeSession` (AP-CPROF-5).

## Net effect
Two small, additive, honesty-improving folds. No new core logic beyond a boolean flag on existing sample counts;
no new persisted state; no DB/ADR change. Doctrine intact (directional-no-grade, bilingual, Insights byte-identical).
