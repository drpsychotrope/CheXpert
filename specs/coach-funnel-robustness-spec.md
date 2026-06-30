# Spec — coach funnel & robustness (feature PR C8)

**PR**: `coach-funnel-robustness` · **Scope**: feature (funnel + robustness) · **Portfolio**: C8 of `enhancements-architecture-spec.md`
**Drafted**: 2026-06-30 · **Spec version**: V1 (`/draft-general` 4 cycles → arbitrages applied; `/enrich` 3 cycles → FOLD set applied — `reports/coach-funnel-robustness_improvements.md`) · **Pre-V0 scan**: PASS
**New ADR**: **none by default**. Reuse ADR-0045 (coach mode), ADR-0053 (bilingual), ADR-0054 (F5 client-side download primitive). Flag **ADR-0059** *only if* FOLD-C2 (DB-persisted resume) is taken (0054–0058 reserved/claimed; 0058 = P2 takeback). See §0.5 Q-B/Q-F + §7.
**DB_VERSION**: **4 — no bump** (default; CF4 resume is in-memory like `activeSession`; CF10 export reads existing `coachProfile`). FOLD-C2 only proceeds if it stays additive (schemaRev backfill, no `DB_VERSION` bump).

---

## §0 Context

The coach is **hard to find and silently fragile**. Three concrete defects, all verified on disk (`reports/coach-funnel-robustness_target_exists.json`):

1. **Dead-end funnel (CO20).** Onboarding runs a `PuzzleLadder` (`Onboarding.svelte:62`) — the same calibration engine the coach builds on — then both terminal paths drop the user home (`skipEvaluation()` → `app.go('home')` at `:222`; the `done` step button at `:322`) and **never mention coaching**. The coach itself is reachable only from **3 static buttons** (`Home.svelte:39`, `Insights.svelte:82`, `Settings.svelte:106`) and is **never surfaced at the moment it matters** — e.g. after a run of losses. A returning user on a rough patch gets no offer.
2. **Mid-assessment data loss (CF4).** The assessment wizard keeps its state in plain in-component locals — `probes` (a bare array, `Coach.svelte:36`), `themeIdx` (`:27`), `step` (`:21`). Navigating away mid-assessment **loses everything**; there is no resume. This is in direct contrast to `Session.svelte`, which lifts its run into `app.activeSession` (an in-memory singleton) and **resumes** on re-mount (`Session.svelte:54-93`).
3. **Silent engine failure (CF8).** `startGame`'s `catch` calls `finishWithoutGame()` (`Coach.svelte:143-144`) with **no message** — a failed engine looks *identical* to the user deliberately pressing **Skip** (`:229`, same `finishWithoutGame`). The sibling wizard already does better: Onboarding shows `t('onboarding.engineFailedSkipping')` (`Onboarding.svelte:124-128`). The coach is the asymmetric, silent one.

And the coach profile is **local-only, not portable** (CF10): `coachProfile?` sits on `PlayerModel` (`db.ts:67`) with no export.

**This PR makes the coach findable, resumable, honest-on-failure, and portable.** It is the C8 *closure* leaf of the Coach stack. It deliberately stops there:
- It does **not** add coaching content or change *what* is assessed (C5/C6/C7, C2).
- It does **not** add a longitudinal trend view (C1) nor import a profile (§11).
- The export is a **snapshot of the current profile**, JSON, lossless, client-side — not a printable report (§11) and not a server share (the app is local-first, no backend).

**Doctrine carried in** (verified against the codebase): additive-optional, **no `DB_VERSION` bump** (mirrors `coachProfile?`/`conceptSeen?`); honesty (a skipped/failed game stays a labelled state, never hidden — AP-CHESS-13/24); bilingual FR/EN parity (`coach.*` in `src/i18n/messages/coach.ts`, ADR-0053); pure cores (no `Date.now()`/`Math.random()` in logic — the one timestamp lives at the UI boundary, as in `Session.svelte`); **Insights output byte-identical** (C8 touches no selection/studyPlan logic; guarded by `studyPlan.test.ts`/`session.test.ts`).

### Pre-V0 scan corrected/confirmed
- **Path correction**: components live in `src/ui/`, not `src/lib/components/`. Prompt line numbers are approximate; real anchors recorded in `_target_exists.json`. All named hooks **exist**.
- **CO20 CONFIRMED** — both Onboarding exits drop home; coach has 3 static entries; not surfaced after a rough patch.
- **CF4 CONFIRMED** — `probes` is a plain array reset via `probes.length = 0`; no persistence; `Session.svelte` resume is the in-memory model to mirror.
- **CF8 CONFIRMED** — `startGame` catch → silent `finishWithoutGame()`; Onboarding already shows a message (the symmetry to restore).
- **CF10 CONFIRMED** — `coachProfile?` local-only; `CoachProfile` (`coach/types.ts:24`) is plain structured-clone-safe data → trivially JSON-exportable. **No print/Blob path exists anywhere in the tree** → printable is greenfield (DEFER).
- **F5 dependency nuance** — `specs/games-store-pgn-io-spec.md` (F5) is **drafted V1, NOT built**: `downloadPgn`/`pgnFilename` in `src/ui/pgnDownload.ts` **do not exist on disk yet**. F5 explicitly **DEFERRED CF10 to C8** (F5 §0.5 Q-D, §11). C8 therefore reuses the helper *if F5 has shipped*, else introduces the same Blob/object-URL primitive — **no hard build-time dependency**.
- **Right-moment signal** — no streak field in `app.svelte`, but `PlayerModel.opponentByPool[pool].recent: GameOutcome[]` (`db.ts:57`; `AdaptiveOpponent.ts:22-23,46-48`) is the persisted rolling-outcome list. The rough-patch signal needs **no new state**.

## §0.5 Arbitrages — RESOLVED 2026-06-30 (recommended defaults applied; flip any to re-fold)

**Q-A=c · Q-A2=a+c · Q-B=a(in-memory) · Q-C=a · Q-D=a · Q-E=a · Q-F=no.** Spec body reflects these (this is the V1). Full rationale + alternatives in `reports/coach-funnel-robustness_arbitrages.md`.

- **Q-A — funnel surfaces (CO20).** **(c) BOTH, gentle/non-nagging.** Onboarding-end offer (catches the new user with momentum) **and** a Home rough-patch prompt (catches the returning user). Both **dismissible + non-recurring within a cooldown**.
- **Q-A2 — rough-patch signal.** **(a) losing streak via `opponentByPool.recent`, guarded by (c) staleness** (don't prompt if a fresh `coachProfile` exists). Encapsulated in a pure total predicate `shouldOfferCoach(model, now)`.
- **Q-B — mid-assessment resume (CF4).** **(a) persist + resume, via the in-memory singleton pattern** (`app.coachAssessment`, mirroring `activeSession`). **No schema change.** DB-durable persistence is **FOLD-C2**, taken only if additive-without-`DB_VERSION`-bump; else DEFER.
- **Q-C — engine-fail message (CF8).** **(a) reuse the existing `info` slot.** Set `info = t('coach.engineFailed')` before `finishWithoutGame()`, carry the reason into the result.
- **Q-D — export format (CF10).** **(a) JSON now via the F5 download pattern; printable/PDF DEFER.**
- **Q-E — import a profile?** **(a) export only** (single concern; import → §11).
- **Q-F — new ADR?** **No** by default; **ADR-0059 only if FOLD-C2 (DB-persist) is taken.**

## §1 Empirical baseline

From `reports/coach-funnel-robustness_{baseline,target_exists,collision}.json` (2026-06-30):

| Fact | Value |
|---|---|
| Tests | **504 passed / 69 files** (`npx vitest run`, all green) |
| `svelte-check` | **0 errors / 0 warnings / 383 files** (portfolio anchor, re-confirmed) |
| `DB_VERSION` | **4 — no bump in C8** |
| Component-test harness | **none** (0 `*.svelte.test.ts`) → verify via pure-core unit tests + static wiring + manual |
| Coach entry points | 3 static — `Home.svelte:39`, `Insights.svelte:82`, `Settings.svelte:106` |
| Onboarding end paths | `app.go('home')` at `Onboarding.svelte:222` (skip) + `:322` (done) — no coach offer |
| Assessment state | `probes` array `Coach.svelte:36`, `themeIdx` `:27`, `step` `:21` — **not persisted** |
| Resume model to mirror | `app.activeSession` in-memory singleton; resume `Session.svelte:54-93` (survives view-swap, lost on reload) |
| Engine-fail today | `Coach.svelte:143-144` silent `finishWithoutGame()`; **Onboarding** shows `engineFailedSkipping` (`:124-128`) |
| `info` slot | `Coach.svelte:42` decl, rendered `:234` — CF8 reuse surface |
| Rough-patch signal | `PlayerModel.opponentByPool[pool].recent: GameOutcome[]` (`db.ts:57`) — persisted, no new state |
| `CoachProfile` | plain data (`coach/types.ts:24-33`) — JSON-serializable; lives at `PlayerModel.coachProfile?` (`db.ts:67`) |
| F5 download helper | `downloadPgn`/`pgnFilename` planned in `src/ui/pgnDownload.ts` — **drafted, NOT on disk**; reuse-if-shipped else introduce generic |
| Print/PDF path | **none in tree** → printable is greenfield (DEFER) |
| Insights guard | `studyPlan.test.ts` + `session.test.ts` — C8 touches no selection logic |
| Collisions | **none** — `coachAssessment`, `shouldOfferCoach`, `exportCoachProfile`, `coach.engineFailed`, `downloadText` all absent; `coach` view already exists (no new view) |

## §2 Scope (single concern: make the coach findable + robust + portable)

**In (the four folds + the enrich FOLD set):**

1. **CO20 — funnel (Q-A=c).**
   - **Onboarding-end offer**: on the `done` step (`Onboarding.svelte:316-323`) and/or the `offer-game` exit, add a third action **"Want a full coaching read? →"** that routes `app.go('coach')`. Gentle, optional, next to "Go home".
   - **Home rough-patch prompt**: a single **dismissible** soft card in `Home.svelte`, shown only when `shouldOfferCoach(model, now)` is true. One line + "Assess me →" + "Not now". Dismiss sets a cooldown (in-memory + optionally the existing settings/schemaRev backfill — additive) so it does not re-nag.
   - **`shouldOfferCoach(model, now)`** (new pure predicate, `src/coach/funnel.ts`): true iff there is a **losing-streak** signal in `opponentByPool.*.recent` AND no **fresh** `coachProfile` (staleness guard). Total: null model / empty pools / just-assessed → false (FOLD-C5).

2. **CF4 — mid-assessment resume (Q-B=a, in-memory).**
   - Lift the wizard's `probes`, `themeIdx`, `step` (and the minimal cursor needed to re-enter mid-ladder) into a new **in-memory singleton `app.coachAssessment`** (mirrors `app.activeSession`; **NOT persisted by default** → no schema change).
   - `Coach.svelte` reads it on mount: if present, **resume** at the saved step; else start fresh (mirror `Session.svelte:59-84`).
   - **FOLD-C1**: when resumed, offer **"Start over"** (clears the singleton, re-enters `intro`).
   - **FOLD-C2 (conditional)**: if it lands **without a `DB_VERSION` bump** (additive optional field on `PlayerModel` + schemaRev backfill), also persist `coachAssessment` so it survives a full reload. Otherwise **DEFER** (§11) — in-memory parity with `activeSession` is the shipped default.

3. **CF8 — engine-failure message (Q-C=a).**
   - In `startGame`'s `catch` (`Coach.svelte:143`), set `info = t('coach.engineFailed')` ("Couldn't start the engine — assessed puzzles only.") **before** `finishWithoutGame()`.
   - **FOLD-C3**: carry the failure reason into `commit`/the result so the directional/source line (or a one-line note) distinguishes *engine failed* from *user skipped* (honesty). Mirrors `Onboarding.svelte:124-128`.

4. **CF10 — profile export (Q-D=a, JSON; Q-E=a, export-only).**
   - **`exportCoachProfile(profile, assessedAt)`** → a JSON blob of the current `CoachProfile`. Filename derived from `assessedAt` (pure helper, no `Date.now()` in the core), e.g. `coach-profile-2026-06-30.json`.
   - **Download primitive (FOLD-C6)**: reuse F5's `downloadPgn` if shipped; otherwise introduce a generic **`downloadText(content, filename, mime)`** (`src/ui/pgnDownload.ts` if present, else a small `src/ui/downloadText.ts`) using `Blob` + object URL + `revokeObjectURL`, feature-detected for SSR/jsdom. Do **not** refactor F5 if it has not shipped (no hard dep).
   - **Affordances**: an **"Export profile"** button in the Coach **result** panel (next to "Start session"/"Later", `Coach.svelte:263-266`) AND in **Settings → "Your data"** (`Settings.svelte:103-108`), guarded on `app.model?.coachProfile` existing.

5. **Bilingual strings (FOLD-C4)** — every new label FR+EN: new `coach.*` keys (`coach.engineFailed`, `coach.resume*`, `coach.startOver`, `coach.exportProfile`, the offer/source-note strings) in `src/i18n/messages/coach.ts`; the Home prompt + Onboarding offer strings in their existing namespaces. Gentle tone in BOTH locales (not a literal imperative translation). Parity test passes by construction.

**Out / deferred (→ §11):**
- **Printable / PDF coaching report** (Q-D) — no print path exists; a rendering concern.
- **Import a coach profile** (Q-E) — cross-version schema + overwrite consumer → profile-management PR.
- **DB-persisted resume** if it would need a `DB_VERSION` bump (FOLD-C2 negative branch).
- **Longitudinal coaching-over-time view** (`coachProfile` vs `coachProfilePrev`) — C1's trend.
- **Notifications/scheduled re-assess reminders** — no backend (local-first); CO19 in-app staleness nudge is C1.
- **Auto-launch coach** (rejected — nagging; the offer is always consented/dismissible).

## §3 Pre-flight

- Confirm baseline green: `npx vitest run` (expect **504/504**) + `npm run check` (expect **0/0**).
- Re-grep collisions: `coachAssessment`, `shouldOfferCoach`, `exportCoachProfile`, `downloadText`, `coach.engineFailed`, `coach.resume*` — all must still be absent.
- Decide FOLD-C2 up front: prototype the additive optional field; **assert the diff contains no `DB_VERSION` change** before keeping it (else fall back to in-memory + DEFER).
- Confirm whether F5 has shipped `downloadPgn`. If yes → reuse. If no → introduce `downloadText` (generic), note the future F5 reconciliation in §11 — do **not** edit F5's spec/files.
- Confirm `CoachProfile` is JSON-round-trippable (it is — plain data, no class instances).

## §4 Phase A — CODE FIRST

Order: pure cores (+ their tests) → state singleton → wizard resume → engine-fail message → export helper → funnel surfaces → i18n. **Code compiles green before any doc edit (§7).**

1. **`src/coach/funnel.ts` (new, pure)**
   - `export function shouldOfferCoach(model: PlayerModel | null, now: number): boolean` — true iff a losing-streak predicate over `model.opponentByPool[*].recent` holds AND no fresh `coachProfile` (`now - coachProfile.assessedAt > FRESH_MS`, or no profile). **Total** (null/empty/just-assessed → false). No `Date.now()` inside — `now` is an argument.
   - `export function coachProfileFilename(assessedAt: number): string` — `coach-profile-YYYY-MM-DD.json` derived from `assessedAt` (pure; sanitised).
   - Keep streak thresholds (`STREAK_LEN`, `FRESH_MS`) as named consts.

2. **Download primitive (FOLD-C6)** — if `src/ui/pgnDownload.ts` exists (F5 shipped): add/reuse `export function downloadText(content: string, filename: string, mime = 'application/json'): void`. Else create `src/ui/downloadText.ts` with the same `Blob` → `URL.createObjectURL` → `a.click()` → `revokeObjectURL`, **feature-detected** (`if (typeof URL?.createObjectURL !== 'function') return;`). DOM side-effect only — no pure logic here.

3. **`exportCoachProfile`** — a thin wrapper (in `Coach.svelte`/`Settings.svelte` or `funnel.ts` glue): `downloadText(JSON.stringify(profile, null, 2), coachProfileFilename(profile.assessedAt))`. Reads the live `app.model.coachProfile`.

4. **`src/state/app.svelte.ts`** — add the in-memory singleton (mirror `activeSession`, `:56-57`):
   ```ts
   /** In-progress coach assessment (in-memory, survives view swaps; NOT persisted by default —
    *  mirrors activeSession). Lets the wizard resume after navigating away (CF4). */
   coachAssessment = $state<{ step: string; themeIdx: number; probes: ThemeProbeResult[] } | null>(null);
   ```
   (FOLD-C2 only: add an additive optional `PlayerModel.coachAssessment?` + schemaRev backfill **iff no `DB_VERSION` bump**.)

5. **`src/ui/Coach.svelte`**
   - **Resume**: on mount, if `app.coachAssessment` → restore `step`/`themeIdx`/`probes` and continue (mirror `Session.svelte:59-84`); else fresh. Write the singleton at each step transition (`startLadders`, `finishThemeLadder`, entering `offer-game`/`result`); clear it when the assessment completes (`commit`) or on **Start over** (FOLD-C1).
   - **CF8**: in `startGame` `catch` (`:143`), `info = t('coach.engineFailed')` then `finishWithoutGame()`; thread a `gameFailed` flag into `commit` so the result note (FOLD-C3) says *engine failed*, not silent.
   - **CF10**: an **Export profile** button in the result panel (`:263-266`), guarded on `profile`.
   - **FOLD-C1**: a **Start over** affordance visible when resumed.

6. **`src/ui/Home.svelte`** — a dismissible rough-patch card gated on `shouldOfferCoach(app.model, Date.now())` (the `Date.now()` boundary is here, not in the core). "Assess me →" → `app.go('coach')`; "Not now" → set cooldown. Place near the existing `dueReview` affordance (`:35`).

7. **`src/ui/Onboarding.svelte`** — add the **"Want a full coaching read? →"** action on the `done` step (`:316-323`) and/or `offer-game` exit → `app.go('coach')`.

8. **`src/ui/Settings.svelte`** — add **Export coach profile** in the "Your data" panel (`:103-108`), guarded on `app.model?.coachProfile`.

9. **i18n (FOLD-C4)** — add the new keys FR+EN in `src/i18n/messages/coach.ts` (and home/onboarding namespaces for those two surfaces). Reuse existing `coach.skip`/`coach.later` where apt.

## §5 Tests (pure-core unit + static wiring; NO component harness)

- **`src/coach/funnel.test.ts` (new)**:
  - `shouldOfferCoach`: true on a losing streak with no/stale profile; **false** when model is null, pools empty, streak below threshold, or a fresh `coachProfile` exists. Deterministic (`now` passed in — no `Date.now`).
  - `coachProfileFilename`: deterministic for a fixed epoch, ends `.json`, sanitised.
- **`downloadText` test (new, `downloadText.test.ts` or extend `pgnDownload.test.ts` if reused)**: feature-detects (no throw when `URL.createObjectURL` absent); builds the right mime/filename.
- **Static wiring-presence** (grep-style assertions, mirroring `board-reactivity.test.ts` philosophy): `app.coachAssessment` exists; `Coach.svelte` references it on mount; `startGame` catch sets `coach.engineFailed`; export button guarded on profile.
- **i18n parity**: existing `translate.test.ts` covers every new `coach.*`/home/onboarding key (fr+en by construction) — assert it stays green; no rewrite.
- **No regression**: full suite stays at **≥504** (new tests add to it).
- **Insights byte-identity**: C8 touches no selection/studyPlan/fingerprint logic → `studyPlan.test.ts`/`session.test.ts` unaffected (assert those files untouched).
- **(FOLD-C2 only)** schema test: if persisted, `DB_VERSION` **stays 4** (additive), like `metacog-schema.test.ts:11-12`.

## §6 Verification

1. `npx vitest run` — green, count = 504 + new, **0 failures**.
2. `npm run check` — **0 errors / 0 warnings**.
3. `npm run build` — green.
4. **Manual smoke** (preview):
   - Finish onboarding → the **"coaching read"** offer appears on the done step → click → lands on Coach.
   - Lose several Play games → reopen Home → the **rough-patch card** appears → "Not now" dismisses it and it does not re-appear within the cooldown; with a fresh profile it never appears.
   - Start a coach assessment, navigate away mid-ladder, return via nav → **resumes** at the same step with prior `probes` intact; **Start over** clears it.
   - Force engine failure (or simulate) → Coach shows **"Couldn't start the engine — assessed puzzles only."** and the result note says *engine failed*, not a silent skip.
   - On the result panel and in **Settings → Your data**, **Export profile** downloads a `coach-profile-YYYY-MM-DD.json` that re-parses to the live `CoachProfile`.
   - Switch FR/EN → every new string flips; tone reads gentle in both.
5. **Doctrine gates**: diff has **no `DB_VERSION` change** (assert); no server/network call; every new user string has fr+en; no Insights/studyPlan file touched.

## §7 Docs (LAST)

- **`decisions.md`** — **default: a short decisions note** under the coach lineage recording Q-A..Q-F (funnel BOTH/gentle, in-memory resume, engine-fail via info slot, JSON export, export-only, no new ADR), referencing **ADR-0045** (coach mode), **ADR-0053** (bilingual), **ADR-0054** (F5 download primitive). **Append ADR-0059 ONLY if** FOLD-C2 (DB-persisted resume) is ratified — "C8 — coach assessment resume persisted (additive, no `DB_VERSION` bump)". Append-only; do **not** edit D001–D051 or prior ADRs. (0054–0058 reserved/claimed; 0058 = P2 takeback.)
- **`specs/enhancements-architecture-spec.md`** — mark **C8** status (drafted→shipped) in §3 when merged (light touch; the portfolio map owns cross-PR status). Note CF10 closed (F5's deferred item).
- **README** — no change required (no new top-level concept; the offer/resume/export are self-describing surfaces).

## §8 Acceptance

- [ ] `shouldOfferCoach(model, now)` exists (pure, total), unit-tested across null/empty/streak/fresh branches.
- [ ] Onboarding end **and** Home (rough-patch, dismissible, cooldown'd) both offer coaching — bilingual, non-nagging. CO20 closed.
- [ ] Coach assessment **resumes** after navigating away (in-memory `app.coachAssessment`, mirrors `activeSession`); **Start over** clears it. CF4 closed.
- [ ] Engine failure shows **"Couldn't start the engine — assessed puzzles only."** via the `info` slot and is distinguished from a deliberate skip in the result. CF8 closed.
- [ ] **Export profile** downloads a valid JSON `CoachProfile` (filename from `assessedAt`) from the result panel and Settings; reuses F5's helper if shipped else a generic `downloadText`. CF10 closed (F5's deferred item).
- [ ] **No `DB_VERSION` bump** (assert in diff); FOLD-C2 only if it stays additive (schemaRev backfill).
- [ ] `npx vitest run` ≥504 green · `npm run check` 0/0 · `npm run build` green.
- [ ] Insights output byte-identical (no selection/studyPlan change).
- [ ] No new ADR (default) OR ADR-0059 appended iff FOLD-C2; decisions note recorded.
- [ ] No printable/PDF, no profile import, no auto-launch (boundaries held).

## §9 Anti-patterns (AP-CFUNNEL-)

- **AP-CFUNNEL-1** — **nagging.** The rough-patch prompt and the Onboarding offer are always **dismissible + cooldown'd + consented**. NEVER auto-launch the coach or re-show after dismissal within the cooldown.
- **AP-CFUNNEL-2** — **`Date.now()` in a core.** `shouldOfferCoach`/`coachProfileFilename` take time as an argument; the `Date.now()` boundary lives only in the component (mirror `Session.svelte`).
- **AP-CFUNNEL-3** — **bumping `DB_VERSION` for resume.** Default resume is in-memory (`activeSession` parity). DB-persist (FOLD-C2) is additive-only (schemaRev backfill) or it does not ship.
- **AP-CFUNNEL-4** — **silent engine failure.** A failed engine MUST set the `info` message and be distinguishable from a deliberate skip in the result (honesty; symmetry with Onboarding).
- **AP-CFUNNEL-5** — **over-claiming export.** Export is a **snapshot** of the current `CoachProfile`, JSON, client-side. Not a printable report, not a longitudinal history, not a server share. Copy/ADR say exactly that.
- **AP-CFUNNEL-6** — **re-serialising or transforming the profile on export.** `JSON.stringify` the live `CoachProfile` verbatim; no lossy projection.
- **AP-CFUNNEL-7** — **a server/network round-trip** for export or surfacing. Strictly client-side / local model reads (local-first posture).
- **AP-CFUNNEL-8** — **untranslated strings** (FR-only or EN-only), or a literal imperative translation that reads pushy in one locale. Every new string is a fr+en `Message` with gentle tone in both.
- **AP-CFUNNEL-9** — **a new top-level view** for the funnel/export. The `coach` view already exists; surface entries to it (no `View`-union/NAV churn).
- **AP-CFUNNEL-10** — **persisting the in-progress assessment into the `games` store** (reusing F5's read). An assessment is not a played game; keep the artifact separate (no played-history pollution).
- **AP-CFUNNEL-11** — **hard-depending on F5's `downloadPgn` at build time.** F5 may be unbuilt; reuse-if-present, else a generic `downloadText`. Do not edit F5's spec/files from C8.
- **AP-CFUNNEL-12** — **forcing the assessment game un-skippable** to get a fuller profile. A skipped/failed game is a valid, labelled state (honesty); fuller-radar is C2's concern.

## §10 Rollback

Additive and isolated. To revert: drop `src/coach/funnel.ts` (+ test), the `downloadText`/`exportCoachProfile` helper (+ test), the `app.coachAssessment` field, the Coach resume/Start-over/engine-fail/export edits, the Home prompt, the Onboarding offer, the Settings export button, and the new `coach.*`/home/onboarding keys. **No schema/migration** introduced by default (nothing to undo in IndexedDB); FOLD-C2's optional field (if taken) reads as `undefined` on old records — leaving it is harmless. Existing flows (`commit`, `finishWithoutGame`, `activeSession`) are untouched. Any decisions note / ADR-0059 stays in `decisions.md` (append-only), annotated as reverted if needed.

## §11 Follow-up

- **Printable / PDF coaching report** (Q-D deferred) — a render of the profile for sharing offline; needs a print/PDF path (none exists today).
- **Import a coach profile** (Q-E deferred) — round-trip the exported JSON, with cross-version schema handling + an overwrite-vs-merge consumer (profile-management PR).
- **DB-persisted assessment resume** (FOLD-C2 negative branch) — if cross-reload durability is wanted and an additive field is not enough, the migration belongs to its own PR with ADR-0059.
- **C1** — surface the saved profile + `coachProfilePrev` trend + staleness nudge (CO19); the Home prompt here and C1's staleness nudge should share `shouldOfferCoach`'s freshness predicate.
- **F5 reconciliation** — when F5 ships `downloadPgn`, fold C8's `downloadText` and F5's PGN download onto the one primitive (whichever landed first absorbs the other).
- **Coach profile share via QR / file-handoff** — a richer "share" once a second device story exists (still no server).
