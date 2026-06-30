# Spec — Board input + a11y (foundation PR F2)

**PR**: `board-input-a11y` · **Scope**: a11y / UI wiring (single concern) · **Portfolio**: F2 of `enhancements-architecture-spec.md`
**Drafted**: 2026-06-30 · **Spec version**: V1 (4 refiner cycles + 3 enrich cycles; FOLD set applied — `reports/board-input-a11y_improvements.md`) · **Pre-V0 scan**: PASS (premise corrected + narrowed)
**Extends**: ADR-0052 (audit-v2 a11y line / P0-04) + ADR-0053 (bilingual). **No new ADR** (display/markup follow-up — mirrors F1 precedent; see §0.5 Q-D and the ADR-0054 collision note).

---

## §0 Context

Chessground boards are wrapped by a single component, `src/ui/Board.svelte`, consumed by ~23 call
sites. The audit's CF9 finding said the boards are "mouse-only and lack aria/role". **The pre-V0 scan
materially corrected this premise** (see §1): keyboard/text move entry was *already shipped at the
component level* by audit v2 P0-04, and three consumers already wire it. What remains genuinely unmet:

1. **The interactive board region has no `role`/`aria-label`.** Only the keyboard input and the
   promotion dialog carry aria today; a screen-reader user lands on an unlabeled `<div>` of pieces.
2. **Eleven interactive board instances across nine consumers never pass `onMoveText`**, so the
   already-built keyboard form simply does not render for them — Coach, Onboarding, Sparring, Comeback,
   Endgames, GuessMove, AnalysisBoard, Repertoire, Woodpecker are still mouse-only in practice.

So the F2 goal — *keyboard/text move entry + aria across **all** Board consumers* — is real but the work
is **thin and additive**: one aria upgrade in the single source, plus copy-the-canonical-pattern wiring
in nine files. No persistence, no logic, no new dependency.

**Doctrine carried in:** additive-only (no `DB_VERSION` bump — nothing persisted); honesty posture
(N/A — no metric); bilingual FR/EN parity for the one new string (stable key via the `t()` catalogue —
ADR-0053); pure cores untouched (`resolveMove` already pure); Insights study-plan output byte-identical
(this PR touches no selection logic — AP-COACH-1 not at risk).

## §0.5 Arbitrages — RESOLVED 2026-06-30 (recommended defaults applied → this is V1; flip any to re-fold)

**Q-A=a** · **Q-B=DEFER** · **Q-C=a (Board.svelte single source)** · **Q-D=no-new-ADR** · **Q-E=a (whitelist interactive consumers)**. Full rationale in `reports/board-input-a11y_arbitrages.md`.

- **Q-A — a11y depth.** Text move entry + a basic `aria-label` on the board region **now**; full
  `role="grid"` / `role="gridcell"` per-square navigation **DEFER**. → **(a) text entry + aria-label now,
  ARIA grid DEFER** (§11). Rationale: the grid pattern is a large, separate concern with its own focus
  model; the move-text input already gives a complete no-mouse path (WCAG 2.1.1) and a labelled region
  gives orientation (WCAG 1.3.1 / 4.1.2) at near-zero cost.
- **Q-B — keyboard MOVE NAVIGATION (←/→ through plies).** A distinct concern (it needs a ply cursor and
  exists nowhere today). → **DEFER** to the feature PRs that own a move list (P2 in-game UX; analysis
  surfaces). Not in F2.
- **Q-C — consolidate in `Board.svelte` vs per-consumer.** The aria region label belongs in the **single
  source** so every consumer inherits it; only the `onMoveText` *callback* must be per-consumer (it needs
  the consumer's own game instance + guard). → **(a) aria in `Board.svelte`; thin identical `onMoveText`
  wiring per interactive consumer.**
- **Q-D — new ADR?** F1 set the precedent "display-only follow-up → no new ADR", and the portfolio spec
  already reserves **ADR-0054** for itself. → **no new ADR**; F2 extends ADR-0052's a11y line. (If the
  team later wants an ADR for the board-region-aria policy, it takes the first free number *after* the
  portfolio ADR — never 0054.)
- **Q-E — which consumers get wired?** Only **interactive** boards (those passing `onMove` with a real
  `movableColor`). `onSelect` calc/vision drills and `viewOnly` boards are excluded — the existing
  `{#if onMoveText && !viewOnly}` guard makes wiring them a no-op or wrong. → **(a) whitelist the 11
  interactive instances enumerated in §1.**

## §1 Empirical baseline

From `reports/board-input-a11y_target_exists.json` + `_baseline.json` (2026-06-30):

| Fact | Value |
|---|---|
| Single source | `src/ui/Board.svelte` (one wrapper, ~23 call sites) |
| **Already shipped** (audit v2 P0-04 / W4) | `Board.onMoveText` prop (`Board.svelte:45`); keyboard form (`:112–124, :206–222`); `role=alert aria-live` error (`:220`); `ChessGame.resolveMove` (`ChessGame.ts:236`, tested `chessGame960.test.ts:213`) |
| **Already wired** consumers | `Tactics.svelte:357`, `Review.svelte:195`, `Play.svelte:592` (canonical pattern = Tactics) |
| **Gap 1 — region aria** | `div.cg-board-host` (`Board.svelte:198`) has **no `role`/`aria-label`** |
| **Gap 2 — unwired interactive** (11 instances / 9 files) | `Coach.svelte:215`, `Coach.svelte:237`, `Comeback.svelte:153`, `Sparring.svelte:146`, `Endgames.svelte:185`, `GuessMove.svelte:92`, `AnalysisBoard.svelte:104`, `Repertoire.svelte:178`, `Woodpecker.svelte:218`, `Onboarding.svelte:273`, `Onboarding.svelte:303` |
| Out — `onSelect` drills | `Calculate.svelte:205`, `Vision.svelte:239` (tap-to-build / coordinate; no from→to move) |
| Out — view-only | `AnalysisResult:96`, `WhenToThink:100`, `ConceptCard:35`, `Vision:249/301` |
| i18n | all `board.*` move-entry keys exist + bilingual (`common.ts:63–71`); **new keys = `board.label`, `board.labelView`** |
| DB | **stays v4** — no field, store, or migration |
| Test stack | vitest + jsdom; **no `@testing-library/svelte`, zero `*.svelte.test.ts`** → no Svelte-mount precedent |
| Insights byte-identity | unaffected (no selection/study-plan code touched) |

**Premise correction (recorded):** "boards are mouse-only app-wide" is **false** at the component +
3-consumer level; F2 is *finish the rollout + label the region*, not *build keyboard entry*. This is the
single most important scan output — it shrank the PR from "build a feature" to "wire 9 files + 1 attr".

## §2 Scope (single concern: make every interactive Board keyboard/text-accessible with aria)

**In:**
1. **Board region aria (single source).** On `Board.svelte`'s board host, add `role` + `aria-label`,
   branched by interactivity so the label never over-promises (Q-A defers `role="grid"`):
   - interactive (`!viewOnly` **and** `onMoveText` present): `role="group"` + `aria-label={t('board.label')}`
     — states it is the board and that moves can be typed below.
   - otherwise (view-only, or interactive-by-drag-only with no text path): `role="img"` +
     `aria-label={t('board.labelView')}` — positional only, **no** "type below" claim. (See §4 gating.)
2. **Three i18n keys `board.label`, `board.labelView`, `board.movePlayed`** in
   `src/i18n/messages/common.ts`, FR + EN, stable.
3. **Wire `onMoveText` on the 11 interactive instances** (§1 Gap 2) using the canonical Tactics pattern,
   each guarded by that consumer's own "is it my move / is play active" condition and feeding the existing
   `onMove(from,to,promo)` path via `<consumer-game>.resolveMove(text)`.
4. **(FOLD A1+A3) Keyboard feedback loop in the single source** — on a successful typed move, return focus
   to the move input and announce via a polite `aria-live` status (`board.movePlayed`), completing the
   input→apply→announce→focus-back loop for keyboard/AT users.
5. **Bilingual parity** preserved — the new keys have both locales; the structural parity test stays green.

**Out (and why):**
- `role="grid"` + per-square keyboard navigation — **DEFER** (Q-A; §11). Large separate focus model.
- ←/→ ply MOVE NAVIGATION — **DEFER** (Q-B). Distinct concern; no ply cursor exists.
- `onSelect` calc/vision drills + view-only boards — **excluded** (Q-E); the `onMoveText`/`!viewOnly`
  guard already makes them no-ops; a text *move* makes no sense for a square-tap drill.
- Any change to `resolveMove`, the move API, or selection/persistence logic — **out** (single concern).
- A Svelte component-test harness / new dev dependency — **out** (§5 explains the realistic test surface).

## §3 Pre-flight gates (run before touching code)

- **G1 — premise still holds.** Re-confirm `Board.svelte` still has `onMoveText` + the keyboard form and
  that Tactics/Review/Play still wire it (the scan basis). If a refactor removed them, STOP and re-scope.
- **G2 — clean baseline.** `npm test` green, `npm run check` (svelte-check) **0 errors**, `vite build`
  green on `main` *before* any edit (records the no-regression floor).
- **G3 — consumer list current.** Re-grep `<Board` and confirm the 11-instance interactive set + the
  excluded sets are unchanged (a new board added since the scan must be triaged into in/out).
- **G4 — i18n parity tool green.** The existing FR/EN structural parity test passes pre-edit (so a new
  failure is attributable to this PR's key).

## §4 Phase A — code (CODE FIRST)

> Order inside the phase: A1 (single source) → A2 (i18n key) → A3 (consumer wiring). A3 is mechanical
> and identical per file; do it in one pass.

**A1 — `src/ui/Board.svelte` (board-region aria + keyboard feedback loop, single source).**
- Add `role` + `aria-label` to the board host (`div.cg-board-host`, line ~198). Branch by whether the
  text path is present (derive a `const interactive = !viewOnly && !!onMoveText`):
  - `interactive`: `role="group"` + `aria-label={t('board.label')}`.
  - else: `role="img"` + `aria-label={t('board.labelView')}` (positional; no "type below" claim — covers
    both view-only boards and any drag-only board with no `onMoveText`).
- **(FOLD A1) Focus return** — in `submitKbMove`, on a successful apply, keep focus in the move input
  (it already clears `kbMove`; also re-focus the input) so consecutive keyboard moves need no re-tab.
- **(FOLD A3) Polite success announcement** — add ONE visually-hidden `aria-live="polite"` status node in
  the board shell; on a successful `onMoveText`, set it to `t('board.movePlayed')`. This is the success
  counterpart to the existing `role=alert` error. Bounded: a single status string, **not** a general
  message system; clear it on the next attempt. (Keep the existing assertive error region as-is.)
- Do **not** alter chessground config, the keyboard form's existing structure, or the promotion dialog.
- Keep `coords`/gutter markup unchanged.

**A2 — `src/i18n/messages/common.ts` (three new keys, after the existing `board.*` block, line ~71).**
```
'board.label': { fr: 'Échiquier — saisissez votre coup dans le champ ci-dessous', en: 'Chess board — type your move in the field below' },
'board.labelView': { fr: 'Échiquier (lecture seule)', en: 'Chess board (view only)' },
'board.movePlayed': { fr: 'Coup joué', en: 'Move played' },
```
(`board.label` aligns the region with the keyboard input so AT users know the text path exists;
`board.labelView` avoids promising an input that isn't rendered; `board.movePlayed` is the polite
success announcement for FOLD A3.)

**A3 — wire `onMoveText` on each interactive consumer (canonical pattern from `Tactics.svelte:357`).**
For every instance in §1 Gap 2, add the prop to the `<Board …>` using *that consumer's* game variable
and *that consumer's* "play active / my turn" guard. Template (adapt the guard + game var per file):
```svelte
onMoveText={(text) => {
  if (/* consumer's existing play-active && my-turn guard */) {
    const r = <game>.resolveMove(text);
    if (!r) return false;
    void <onMoveHandler>(r.from, r.to, r.promo ?? 'q');
    return true;
  }
  return false;
}}
```
Per-file binding (verified against current code):

| File:line | game var | onMove handler | guard (reuse the consumer's existing condition) |
|---|---|---|---|
| `Coach.svelte:215` (ladders) | `display` | `onLadderMove` | `trainer && ladder` present |
| `Coach.svelte:237` (game) | `game` | `onGameMove` | `opponent && game.turn === coachSide && !thinking` |
| `Comeback.svelte:153` | `game` | `onMove` | `status === 'playing' && turnColor() === orientation` |
| `Sparring.svelte:146` | `game` | `onMove` | `status === 'playing' && turnColor() === orientation` |
| `Endgames.svelte:185` | `game` | `onMove` | `status === 'playing' && turnColor() === playerColor` |
| `GuessMove.svelte:92` | `display` | `onMove` | `guess && !guess.done` |
| `AnalysisBoard.svelte:104` | `game` | `onMove` | board is always movable (no guard needed → `return true` branch) |
| `Repertoire.svelte:178` (drill) | **no persistent game** — build a scratch `new ChessGame(drill.fen())` (the component already does this in `dests()`/`onDrillMove`, lines 99/104); resolve on it | `onDrillMove` | `drill && !drill.done` |
| `Woodpecker.svelte:218` | `display` | `onMove` | `trainer?.state.status === 'solving'` |
| `Onboarding.svelte:273` (ladder) | `display` | `onLadderMove` | ladder active |
| `Onboarding.svelte:303` (game) | `game` | `onGameMove` | `!gameThinking && game.turn === gameSide` |

> Each callback must mirror the consumer's existing `movableColor`/`dests` gate so a typed move can never
> be applied when a dragged move couldn't be (consistency = AP-A11Y-2). Where the handler is `async`
> (`onGameMove`, `onMove` in Comeback/Sparring/Endgames), call it via `void` and return `true`
> optimistically *after a successful `resolveMove`* (the resolve itself is the legality gate; the handler
> re-checks turn/thinking) — identical to Play/Review/Tactics.

## §5 Phase B — tests

**Honest constraint (from baseline):** the repo has **no Svelte component-test harness** and adding one
(`@testing-library/svelte` + jsdom mount) is a separate infrastructure concern, out of this single-concern
PR. So Phase B does **not** mount components. The realistic, high-value surface:

- **B1 — `resolveMove` core (reuse, no new test needed; assert still green).** The keyboard path's
  correctness lives in `resolveMove`, already covered by `chessGame960.test.ts:213–235` (SAN/UCI/coord/
  castle/promo). Phase B confirms these stay green; **optionally** extend with a standard-chess case if
  coverage of the non-960 branch is thin (cheap, pure, additive).
- **B2 — wiring guard (static).** A lightweight source-level test (Node `fs` read of the 11 consumer
  files, no DOM) asserting each interactive `<Board` usage in the whitelist contains an `onMoveText`
  attribute and a `resolveMove(` call. This locks the rollout so a future edit can't silently drop the
  prop and regress a consumer to mouse-only. (Grep-style assertion; mirrors the spirit of the i18n parity
  test — structural, not behavioural.) **(FOLD A8 — honest limit)** This guards the *presence* of the
  wiring, **not** the correctness of each consumer's turn/play guard; behavioural correctness (a typed
  move can't be applied off-turn) is verified manually in C2, not by B2.
- **B3 — i18n parity.** The existing FR/EN structural test now also guards `board.label` +
  `board.labelView` (both have both locales) — no new test, just confirm it passes with the added keys.

> If the team *wants* behavioural keyboard tests, that is a **DEFER** item (§11: "introduce a Svelte
> component-test harness") — it would benefit the whole UI, not just F2, and should be its own PR.

## §6 Phase C — verification

- **C1 — gates.** `npm test` green (no regression vs G2), `npm run check` 0 errors, `vite build` green.
- **C2 — manual keyboard pass (preview).** For at least Coach (both boards), Sparring, Endgames,
  GuessMove, AnalysisBoard, Repertoire drill, Onboarding (both): tab to the move field, type a SAN and a
  UCI move, confirm it applies and the board updates; type an illegal move, confirm the `role=alert`
  error speaks and the position is unchanged. **(FOLD A1)** After a successful move, confirm focus stays
  in the input so a second move can be typed without re-tabbing. **(AP-A11Y-2)** Type a move when it is
  *not* your turn (e.g. while the bot is thinking) and confirm it is rejected.
- **C3 — screen-reader spot check.** With a screen reader, confirm the board region announces
  `board.label`, the move field + error are reachable and announced, and **(FOLD A3)** a successful move
  triggers the polite `board.movePlayed` announcement. Verify in **both FR and EN** (toggle locale) that
  the region label, success/error strings, and existing kb strings are localized.
- **C4 — no-op safety.** Confirm view-only and `onSelect` drill boards are visually + behaviourally
  unchanged (no stray input rendered) — the `{#if onMoveText && !viewOnly}` guard holds.
- **C5 — reduced-motion + promotion still intact** on a wired board (regression check on the existing
  a11y features).

## §7 Phase Z — docs (LAST)

- **Z1 — `decisions.md`**: append a short note under the audit-v2 a11y line (NOT a new ADR — Q-D):
  "F2 board-input-a11y — completed the P0-04 keyboard rollout to all 11 interactive Board instances and
  added a localized `role`/`aria-label` on the board region; ARIA-grid navigation deferred (§11)."
  Append-only; do not touch locked ADR-0001..0051.
- **Z2 — spec status line**: mark this spec `Status: delivered` with the merge SHA after merge.
- **Z3 — portfolio spec**: tick F2 in `enhancements-architecture-spec.md` §2 as delivered (one-line).
- **Z4 — README**: only if it enumerates a11y features; add "keyboard move entry on every interactive
  board" to that list (skip if no such list exists).

## §8 Acceptance

- [ ] All 11 interactive Board instances render the keyboard move field and apply typed SAN/UCI/coord
      moves through the same `onMove` path as a drag, gated identically.
- [ ] The interactive board region exposes `role` + a localized `aria-label`; view-only boards expose a
      positional label without an input.
- [ ] `board.label`, `board.labelView`, `board.movePlayed` exist in FR + EN; parity test green.
- [ ] (FOLD A1) Focus returns to the move input after a successful typed move.
- [ ] (FOLD A3) A successful typed move announces via a polite `aria-live` status; the assertive error
      region still fires only on an illegal move.
- [ ] `npm test` green (no regression), `npm run check` 0 errors, `vite build` green.
- [ ] No `DB_VERSION` bump; no persistence/selection/logic change; Insights study-plan byte-identical.
- [ ] B2 static wiring test prevents silent regression of any consumer to mouse-only.
- [ ] Manual keyboard + screen-reader pass (C2/C3) succeeds in both locales.

## §9 Anti-patterns (AP-A11Y-)

- **AP-A11Y-1 — Re-implementing keyboard entry per consumer.** The form + parsing already live in
  `Board.svelte` + `resolveMove`. Consumers wire the **callback only**; never duplicate the input/parse.
- **AP-A11Y-2 — Typed move bypassing the drag gate.** A keyboard move must honour the *same*
  turn/thinking/`movableColor` guard as a drag; otherwise a user types a move when it isn't their turn.
  Mirror the consumer's existing condition exactly.
- **AP-A11Y-3 — Wiring `onMoveText` onto a view-only or `onSelect` board.** It is a no-op (guarded out)
  or semantically wrong (a calc/vision square-tap drill has no from→to move). Stay on the whitelist.
- **AP-A11Y-4 — `role="grid"` without the full keyboard model.** Announcing a grid you cannot arrow
  through is *worse* than `role="group"` (it promises navigation that isn't there). Defer the grid until
  its navigation ships (§11).
- **AP-A11Y-5 — A bare/English aria-label.** The region label is user-facing → it MUST be a bilingual
  `t()` key (`board.label`), not a hard-coded string (ADR-0053 parity).
- **AP-A11Y-6 — Bumping `DB_VERSION` / adding a store.** Nothing here is persisted; a bump would be
  gratuitous and trigger a migration for no data (mirrors the additive-field doctrine).
- **AP-A11Y-7 — Smuggling ply-navigation or a test-harness into F2.** Both are real and good, but each is
  a separate concern (§11). Folding them breaks the single-concern gate and bloats the blast radius.

## §10 Rollback

Pure additive UI. Rollback = revert the commit: the `onMoveText` props vanish (consumers fall back to
mouse-only, exactly today's behaviour for those 9 files), the `board.label` key is removed (no consumer
references a missing key — `t()` falls back to the key, and the parity test would have caught an orphan),
and the region loses its `role`/`aria-label`. No data, no schema, no migration to unwind. Per-file safe:
a single mis-wired consumer can be reverted in isolation without affecting the others.

## §11 Follow-up (DEFER — explicitly out of F2)

- **D1 — Full ARIA grid navigation** (`role="grid"`/`gridcell`, arrow-key square focus, piece
  announcements). Large, self-contained focus model; build with its own keyboard spec (Q-A).
- **D2 — Keyboard MOVE NAVIGATION (←/→ through plies)** — folds into the PRs that own a move list
  (P2 in-game UX; analysis surfaces). Needs a ply cursor that doesn't exist yet (Q-B).
- **D3 — A Svelte component-test harness** (`@testing-library/svelte`) enabling behavioural keyboard/aria
  tests across the whole UI. Benefits more than F2; its own infra PR (§5).
- **D4 — Square-tap a11y for the calc/vision `onSelect` drills** (a keyboard path to *select* a square)
  — a different interaction than a move; route to the drill specs (ADR-0043/0044), not F2.
- **D5 — A board-region ADR** for the aria policy, if the team wants one — takes the first free number
  *after* the portfolio's ADR-0054 (never 0054 itself; Q-D).
- **D6 — Typed under-promotion via the keyboard field.** A bare last-rank pawn push typed without a
  promo letter (`e7e8`) resolves with `promo: undefined` and the callbacks default to `'q'` — so the
  text path auto-queens and never opens the promotion dialog. This is **consistent with the existing
  Tactics/Play/Review wiring** (they also `?? 'q'`), so F2 keeps it for parity rather than diverging.
  The explicit forms (`e7e8n`, `e8=N`) already under-promote correctly via `resolveMove`. A future
  enhancement could route a promo-less last-rank text move through the same dialog the drag path uses;
  out of F2 (would touch only the text path and create a Board-vs-consumer asymmetry). Honest note, not
  a blocker.
