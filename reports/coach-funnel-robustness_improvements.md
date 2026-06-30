# Improvements — coach-funnel-robustness (C8)

`/enrich` 3 cycles, 8-axis sweep. Verdicts: **FOLD** (into V1) / **DEFER** (good, wrong PR) / **REJECT** (violates scope/causality). ANTI-FABRICATION: an axis with nothing genuine is marked **CLEAN** — not padded. Set does not grow across cycles; it converges.

## 8-axis sweep

| Axis | Finding | Verdict |
|---|---|---|
| **1. Capability gap** | The funnel offer (CO20) and the engine-fail message (CF8) point at coaching, but a user who lands on the Coach intro with `app.puzzles.size === 0` (puzzles still loading) already sees a disabled button — no *new* gap. The genuine small gap: after a resumed assessment (CF4), the user has no way to **discard** a stale in-progress assessment and start fresh. → **FOLD-C1**: a "Start over" affordance when `app.coachAssessment` is resumed (clears the singleton, re-enters intro). | **FOLD-C1** |
| **2. Capability gap (durability)** | CF4 default is in-memory (parity with activeSession) → lost on a full reload / tab close. Some users *will* close the tab mid-assessment. IF it lands without a DB_VERSION bump (additive optional field on PlayerModel, schemaRev backfill), persist `coachAssessment` so it survives reload. | **FOLD-C2 (conditional — only if no DB bump; else DEFER)** |
| **3. Observability / honesty** | When CF8 fires (engine failed), the resulting profile has `source.game === false`. The result panel already renders `coach.directional` with a source string — but today an engine *failure* is indistinguishable from a deliberate *skip*. → **FOLD-C3**: carry the engine-failure reason into the result so the directional/source line (or a one-line note) says the game was *attempted but the engine didn't start*, not silently "puzzles only". Honesty posture (AP-CHESS-13/24). | **FOLD-C3** |
| **4. Render fidelity / i18n** | All four folds add user-facing strings. Risk = FR-only or EN-only leak. Mechanical, not notable — covered by the parity test + §9 AP. Nudge copy must read gentle in BOTH locales (not a literal FR→EN of an imperative). | **FOLD-C4** (parity + tone, lands with the strings) |
| **5. Robustness** | The Home rough-patch prompt (Q-A2) reads `opponentByPool[pool].recent`. If the model is null (pre-onboarding) or a pool is empty, the predicate must no-op (no prompt), never throw. → **FOLD-C5**: `shouldOfferCoach(model, now)` is total — null/empty/just-assessed all return false. Pure, unit-tested across those branches. | **FOLD-C5** |
| **6. Reuse / extensibility** | CF10's download helper: if F5 has shipped `downloadPgn`, generalize the *underlying* Blob/object-URL primitive to `downloadText(content, filename, mime)` so both PGN (F5) and JSON (C8) call one helper — but **do not refactor F5 if it hasn't shipped** (no hard dep). If C8 builds first, C8 introduces `downloadText` and F5 later reuses it. → **FOLD-C6** (introduce the generic primitive; note the F5 reconciliation, don't force it). | **FOLD-C6** |
| **7. Symmetry** | Onboarding already shows an engine-fail message; Coach does not (CF8 closes that). Symmetry also runs the OTHER way: Onboarding ends with `app.go('home')` and offers no coaching — CO20's Onboarding-end offer makes the two wizards symmetric (both end by pointing forward). The *calibration* (Onboarding) → *coaching* (Coach) chain is the headline symmetry. Already in scope (Q-A). | **CLEAN** (symmetry is the PR's spine, already folded) |
| **8. Honest framing** | Resist over-claiming: C8 makes the coach **findable + robust + portable**, it does NOT add coaching *content* (that's C5/C6/C7) nor change *what is assessed* (C2). The export is a snapshot of the *current* profile shape, not a longitudinal report. ADR/copy must say "surface + resume + honest-failure + export", not "smarter coach". | **FOLD-C8** (framing guard → §0 + AP) |

## Cross-cycle convergence
- **Cycle 1 (sweep)**: raised C1, C2, C3, C5, C6 + the two CLEAN axes. C2 flagged conditional from the start.
- **Cycle 2 (prune)**: rejected two tempting-but-out-of-scope ideas (below); confirmed axis 7 CLEAN (symmetry already = the spine, folding a "finding" there would be fabrication); tightened C5 totality branches.
- **Cycle 3 (conditional)**: C2 stays conditional (DB-bump gate). C6 stays "introduce generic, don't force F5 refactor". No new findings (set converged) → STOP.

## DEFER (good idea, not this PR)
- **D1 — Import a coach profile** (round-trip the JSON). Reopens cross-version schema + overwrite-consumer questions → profile-management PR. (Q-E.)
- **D2 — Printable / PDF coaching report.** No print path in the tree; a rendering concern, not export plumbing. (Q-D.)
- **D3 — DB-persisted assessment** if it would require a DB_VERSION bump (FOLD-C2's negative branch).
- **D4 — Longitudinal "coaching over time" view** (chart `coachProfile` vs `coachProfilePrev` deltas). That is C1's trend territory, not C8.
- **D5 — Notification/reminder to re-assess** (push/scheduled). Out of a local-first PWA's no-backend posture; CO19 staleness nudge (C1) is the in-app version.

## REJECT (violates scope / causality / honesty)
- **R1 — Auto-launch the coach after a losing streak** (no consent). Nagging; violates Q-A's "gentle/non-nagging". The prompt must be a *dismissible offer*, never an interception.
- **R2 — Make the assessment game un-skippable to force a fuller profile.** That is CO7/C2's radar-honesty concern, and forcing it fights the honesty posture (a skipped game is a valid, labelled state). Out of C8.
- **R3 — Persist the assessment to the `games` store** (reuse F5's read). Category error: an in-progress *assessment* is not a *played game*; it would pollute the played-history read (AP-GAMES-8 territory). Keep the assessment artifact separate.
- **R4 — Bump DB_VERSION "while we're here" to clean up coach fields.** Doctrine violation; additive-only. No destructive change is in C8's scope.

## Final FOLD set (8) — folded into the V1 spec
C1 start-over affordance · C2 conditional DB-persist resume · C3 engine-failure honesty in result · C4 i18n parity + gentle tone · C5 total `shouldOfferCoach` predicate · C6 generic `downloadText` primitive (no forced F5 refactor) · C8 honest-framing guard. (Axis 7 CLEAN — symmetry is the spine, not a fold.)
