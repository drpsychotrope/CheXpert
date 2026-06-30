# Spec — Play in-game / after-game UX (feature PR P2)

**PR**: `play-in-game-ux` · **Scope**: feature / in-game UX (single concern: the play-slowly-&-learn surface in Play) · **Portfolio**: P2 of `enhancements-architecture-spec.md` (§3 Play stack)
**Drafted**: 2026-06-30 · **Spec version**: V1 (4 refiner cycles + 3 enrich cycles; arbitrages applied — `reports/play-in-game-ux_arbitrages.md`; FOLD set applied — `reports/play-in-game-ux_improvements.md`) · **Pre-V0 scan**: PASS (all 4 fold premises verified TRUE against real code — `reports/play-in-game-ux_target_exists.json`)
**Depends on**: F2 `board-input-a11y` (move text-ENTRY; P2 owns the move-LIST + ply nav that F2 §11 D2 deferred here)
**New ADR**: **ADR-0058** — *takeback in a rated game marks that game un-counted* (rating-integrity policy; Q-B). Append-only to `decisions.md`. (Reserved 0054 portfolio / 0055-0057 = F3/F5/F6; first free feature ADR = 0058.)

---

## §0 Context

`Play.svelte` is the "play a full game against the adaptive bot" surface. The pre-V0 scan confirmed it
renders **only** the board, the (optional) clocks, a status/result line, and a small control row
(`newGame` / `resign` / `analyse this game`). Four things a *slow, learning-oriented* player needs are
missing, and the scan proved each one is a thin display/UX layer over machinery **that already exists**:

1. **No move list / notation while you play** (PL3). You cannot see what has been played, read the game
   back, or orient yourself mid-game. Yet `ChessGame.history()` (SAN, 960-aware — `ChessGame.ts:160`)
   and `ChessGame.pgn()` (`:119`) are already maintained every move. *Only the display is missing.*
2. **No rematch** (PL10). After a game ends the only path is `newGame()` (`Play.svelte:122`) with the
   config controls still showing; there is no one-click "play another, same setup". `newGame()` already
   reads the persisted time control (mount `$effect`, `:100-113`) and resolves the current color/variant
   (in-memory `colorChoice`/`variant`), so a rematch is a thin call-through.
3. **Resign fires instantly and writes a rated loss** (PL8). `resign()` (`:494`) immediately ends the
   game and calls `finishGame('loss')` → Glicko update + `putGame` — no confirmation. `ConfirmDialog` is
   **already imported** (`:28`) and already used for the coached take-back (`:648-656`); confirm-resign is
   a second instance of the same dialog.
4. **Takeback + blunder-check only exist inside the coached blunder flow** (PL7). `coachTakeBack()`
   (`:292`, calls `game.undo()` — full undo incl. 960, `ChessGame.ts:289`) is reachable **only** via the
   automatic coached-blunder dialog; there is no on-demand takeback and no on-demand blunder check in
   normal play. `coachEvalBad()` (`:308`, shallow depth-8 eval) is reusable behind a button.

So P2's goal — *the in-game/after-game UX a "play slowly & learn" trainer needs* — is real, and the work
is **additive display + UX wiring over verified pure cores**. No new engine logic, no new analysis
pipeline. The one place P2 touches data is an **additive-optional** `GameRecord` field for Q-B (mirrors
the `coached?`/`variant?` precedent) — **no `DB_VERSION` bump**.

**Doctrine carried in:** additive-optional (one optional `GameRecord` field, read-site defaulted; **no
`DB_VERSION` bump**); honesty posture (a takeback in a rated game is *honestly* marked un-counted — it
must not silently inflate a rating); bilingual FR/EN parity for every new string (stable `play.*` /
`settings.*` keys via the `t()` catalogue — ADR-0053); pure cores untouched and *extended* (one new pure
move-list formatter, fully unit-tested — the realistic test surface given no component harness); Insights
study-plan output byte-identical (P2 touches no selection/`weaknessCounters`/study-plan code — AP-COACH-1
safe).

## §0.5 Arbitrages — RESOLVED 2026-06-30 (recommended defaults applied → this is V1; flip any to re-fold)

**Q-A = a (static move list now; click-to-preview a ply DEFER)** · **Q-B = a (opt-in takeback setting;
a takeback in a RATED game marks that game un-counted)** · **Q-C = a (on-demand blunder check reuses
`coachEvalBad` behind a button)** · **Q-D = a (rematch keeps the same color/TC/variant; alternate-color
toggle DEFER)**. Full rationale + alternatives in `reports/play-in-game-ux_arbitrages.md`.

- **Q-A — move list: static vs click-to-preview a ply.** → **(a) static, scrollable, auto-following move
  list now; ply preview DEFER (§11 D1).** Rationale: a static list reads `game.history()` directly and
  needs no new state. *Click-to-preview a ply* requires a ply cursor + board-state-at-ply reconstruction
  (replay-from-start or a per-ply FEN cache) and a "viewing-history vs live" mode — the same ply-cursor
  gap F2 called out (`board-input-a11y-spec.md §11 D2`). That is a separate concern; folding it would
  multi-PR P2. Static now gives the orientation/read-back value at near-zero risk; preview + ←/→ ply nav
  is the natural next PR that finally owns the cursor.
- **Q-B — takeback in NON-coached play: un-rated or rated?** → **(a) an opt-in setting
  `takebackInPlay` (default OFF); when ON, a takeback is allowed in normal play, and if used in a RATED
  game that game is marked un-counted** (its rating update is skipped and the saved `GameRecord` carries
  an honest `unrated: true`). Rationale: `finishGame` today *always* rates + persists; an un-gated
  takeback in a rated game is an abuse vector (undo every bad move, keep the rating gain). The honest fix
  is: takeback is opt-in, and exercising it forfeits the rating for that game — visible to the user
  before/at the moment they take a move back. Off by default keeps today's behaviour byte-identical for
  everyone who doesn't opt in. **This is a rating-integrity policy → ADR-0058.** (Coached takeback is
  unchanged — it already interposes pre-clock-press and the game continues; see §2 Out.)
- **Q-C — on-demand blunder check: reuse `coachEvalBad`?** → **(a) yes — a "Check this move" button that
  calls the existing `coachEvalBad()` (depth-8 shallow eval) and shows a non-blocking hint.** Rationale:
  the eval already exists, is best-effort (catch → false, never blocks), and is exactly the right
  granularity for an on-demand nudge. Reusing it avoids a second eval path. Available **regardless of
  coached mode** (it is a manual request, not the automatic coached interpose), but gated so it cannot be
  spammed to brute-force the engine's opinion (one check per position; see §4 + AP-PLAYUX-5).
- **Q-D — rematch: same color or alternate?** → **(a) keep the same color, time control, and variant;
  alternate-color toggle DEFER (§11 D2).** Rationale: `colorChoice`/`variant` are still in memory after a
  game and the TC is persisted, so a rematch is a zero-config call-through to `newGame()` — same color is
  the free, predictable default. Alternating color each rematch is a nice option but needs a small
  toggle + color-flip state; defer it rather than bloat P2.

## §1 Empirical baseline

From `reports/play-in-game-ux_{target_exists,baseline,collision}.json` (2026-06-30):

| Fact | Value |
|---|---|
| Target surface | `src/ui/Play.svelte` (single screen; board + clocks + status + control row) |
| Move list today | **none** anywhere in `src/ui` (grep `move-list`/`movelist`/`notation` → only `history().length` budget calls) |
| `ChessGame.history()` | exists `ChessGame.ts:160` — `string[]` SAN, 960-aware (`[...san960]` / `chess.js.history()`) |
| `ChessGame.pgn()` | exists `:119`; used `Play.svelte:440` (`finishGame`) |
| `ChessGame.undo()` | exists `:289` — full undo incl. 960 snapshot-restore |
| `coachEvalBad()` | `Play.svelte:308` — depth-8 `fullStrength` shallow eval; `catch → false` |
| `coachTakeBack()` | `Play.svelte:292` — `game.undo()` + `fen=game.fen` + `playedUci.pop()`; reachable **only** via the coached dialog |
| `resign()` | `Play.svelte:494` — immediate; `finishGame('loss')` → rated loss + `putGame` |
| `finishGame()` | `Play.svelte:404` — `applyGameResult` (Glicko `updateRating` + `recordGame`) + `putGame` + `persistModel`; idempotent (`gameFinished`) |
| `newGame()` | `Play.svelte:122` — reads persisted `lastTimeControl`; resolves in-memory `colorChoice`/`variant` |
| `ConfirmDialog` | imported `Play.svelte:28`; used `:648-656` (coached takeback); has `danger` prop (`ConfirmDialog.svelte:14`) |
| `GameRecord` fields | `id,pgn,result,botElo,playedAt,coached,timeControl?,variant?,startFen?` — **no rated/unrated marker** |
| Settings toggle pattern | `Settings.svelte:17-18/23-24` (`x=!x; await persistSettings()`) + checkbox `:75/84` |
| i18n catalogue | `src/i18n/messages/play.ts` (FR/EN per key); parity test `translate.test.ts:50-61` |
| Tests baseline | **504 passed / 69 files** |
| `svelte-check` baseline | **0 errors / 0 warnings / 383 files** |
| `DB_VERSION` | 4 — **no bump in P2** (the one new field is additive-optional) |
| Component-test harness | **none** (0 `*.svelte.test.ts`) → verify via pure-core unit test + static wiring + manual/preview |

**Premise correction (recorded):** none of the four premises were wrong — but the scan *narrowed* two
boundaries: (1) the move list must read `game.history()` (SAN), because `Play.onMove` stores only **UCI**
in `playedUci`, not SAN; (2) F2 owns move text-*entry* (already wired in Play) and explicitly hands the
move-*list* + ply nav to P2 — so P2 must not re-touch the input wiring.

## §2 Scope (single concern: the in-game / after-game "play slowly & learn" surface in Play)

**In:**
1. **Move list (PL3, Q-A=a).** A scrollable, auto-following SAN move list rendered beside/under the board
   while a game is live and after it ends. Numbered pairs (`1. e4 e5  2. Nf3 …`), the latest ply
   highlighted, auto-scrolled into view. Reads a **pure formatter** over `game.history()` (re-derived from
   the reactive `fen`, the same dependency `inCheck` already uses — ADR-0051). View-only; no click yet.
2. **Rematch (PL10, Q-D=a).** A **"Rematch"** button shown alongside "New game" when `status==='over'`
   that re-invokes the game-start path with the **same** color, time control, and variant (a thin
   `rematch()` that calls `newGame()` without touching `colorChoice`/`variant`/`selectedTC`). Steering and
   the opening book continue to behave exactly as a normal `newGame()` (no special-casing).
3. **Confirm-before-resign (PL8).** `resign()` no longer ends the game directly; the Resign button opens a
   **`ConfirmDialog`** (the already-imported component, `danger` styling) — confirm → the existing
   resign/`finishGame('loss')` path; cancel → nothing changes (clock keeps running; it's the player's
   time). A second `ConfirmDialog` instance, mirroring the coached-takeback one.
4. **On-demand takeback in normal play (PL7, Q-B=a).** Behind an **opt-in setting** `takebackInPlay`
   (default OFF). When ON, a **"Take back"** button is available on the player's turn (`status==='playing'
   && turnColor()===playerColor`, and only when at least one full player move can be undone) that undoes
   the last *player* move (and the bot's reply before it, so it is the player's turn again) via
   `game.undo()`. If the game is **rated**, taking a move back marks the in-progress game **un-counted**
   (`unrated=true` in component state) — surfaced immediately (a small "this game won't count" note) — so
   `finishGame` skips the rating update and persists `unrated: true`. Coached takeback is untouched.
5. **On-demand blunder check (PL7, Q-C=a).** A **"Check this move"** button on the player's turn that runs
   the existing `coachEvalBad()` and shows a non-blocking inline verdict ("This looks risky" / "Looks
   fine") — best-effort, one check per position, available regardless of coached mode. It is *advisory*:
   it never moves, never undoes, never touches the clock or rating.
6. **One additive-optional `GameRecord` field** `unrated?: boolean` (Q-B) + the matching skip in
   `finishGame`. Read-site defaulted (`?? false`). **No `DB_VERSION` bump.**
7. **Bilingual parity** — all new `play.*` + `settings.*` keys have FR + EN; the structural parity test
   stays green.

**Out (and why):**
- **Click-to-preview a ply / ←/→ ply navigation** — **DEFER** (Q-A; §11 D1). Needs a ply cursor +
  board-at-ply reconstruction + a live-vs-history mode; the cursor is the concern F2 §11 D2 routed here as
  its *own* follow-up, not as part of the static list.
- **Alternate-color rematch** — **DEFER** (Q-D; §11 D2).
- **PGN export / download** — **out**; F5 `games-store-pgn-io` owns PGN I/O (saved-games history list +
  `downloadPgn`). P2 must not duplicate it (single-concern boundary).
- **Bot resign / accept-draw / draw-offer UI** — **out**; P3 `opponent-agency` owns the *bot's* agency.
  P2's confirm-resign is the *player* resigning.
- **Deep "why" analysis on the checked move** — **out**; the on-demand check is the *shallow* `coachEvalBad`
  verdict only. The full teach/explain reveal is F4/T1 territory; reusing it here would couple P2 to that
  stack. Honest shallow nudge only. **(FOLD A8 — honesty)** The verdict is a quick **depth-8 best-effort**
  read: it is *advisory*, not authoritative, and can disagree with the post-game full-strength analysis. The
  UI copy must not present it as a definitive judgement (a "risky/fine" hint, not "this is a blunder").
- **Touching the coached-blunder interpose, the F2 move-text-entry wiring, the analysis pipeline, or any
  selection/study-plan code** — **out** (single concern + Insights byte-identity).
- **A Svelte component-test harness** — **out** (§5); its own infra PR (mirrors F2/F5).

## §3 Pre-flight gates (run before touching code)

- **G1 — premises still hold.** Re-confirm `Play.svelte` still has `resign()`/`finishGame()`/`newGame()`/
  `coachEvalBad()`/`coachTakeBack()` and the `ConfirmDialog` import, and that `ChessGame.history()`/`undo()`
  are present (the scan basis). If a refactor (e.g. F6 controller extraction) moved them, re-target onto
  the new home and note it — **do not** duplicate logic.
- **G2 — clean baseline.** `npm test` (504 green), `npm run check` (svelte-check **0/0**), `vite build`
  green on the branch *before* any edit (records the no-regression floor).
- **G3 — `GameRecord`/settings shape current.** Confirm `unrated` is still absent on `GameRecord` and
  `takebackInPlay` absent on `SettingsRecord` (a collision would mean a sibling PR already added one — then
  reuse it, don't redeclare).
- **G4 — i18n parity tool green** pre-edit (so a new failure is attributable to P2's keys).
- **G5 — sibling-boundary check.** Confirm F5 still owns PGN export and P3 still owns bot agency (so P2
  doesn't accidentally cross a boundary if those merged first).

## §4 Phase A — code (CODE FIRST)

> Order: A1 pure formatter (testable core) → A2 `GameRecord` field + `finishGame` skip → A3 settings field
> → A4 Play state + handlers → A5 markup (move list, buttons, dialog, check verdict, settings toggle) →
> A6 i18n keys. A1 first so Phase B can lock the only non-trivial logic.

**A1 — `src/game/moveList.ts` (NEW, pure, DOM-free) — the move-list formatter.**
- Export `toMovePairs(sanHistory: string[], startSide: 'w' | 'b' = 'w', startMoveNo = 1): MovePair[]`
  where `MovePair = { no: number; white?: string; black?: string; whitePly?: number; blackPly?: number }`.
  `whitePly`/`blackPly` are 0-based indices into `sanHistory` (for the latest-ply highlight; they also
  pre-position the future click target — D1 — without P2 using them for navigation).
- Pure: no `Date`/`Math.random`/DOM. Variant-agnostic (it formats SAN strings; 960 castles arrive as
  `O-O`/`O-O-O` from `history()`). Handles a Black-first start (960 / a loaded mid-game FEN) via
  `startSide`/`startMoveNo` so the numbering is correct (mirrors the `pgn()` body builder logic,
  `ChessGame.ts:127-136`, but pure and render-shaped). **(FOLD reuse note)** keep this the single
  numbering authority; do not re-derive pairs inline in the component.

**A2 — `src/store/db.ts` + `src/ui/Play.svelte:finishGame` (additive-optional un-rated marker).**
- Add `unrated?: boolean;` to `GameRecord` (after `coached`), with a one-line doc:
  *"Set when the player used an in-play takeback (P2/ADR-0058); the game is persisted but its rating
  update is skipped. Additive — absent reads `?? false`. NO DB_VERSION bump."*
- In `finishGame(outcome)`: read a component flag `unrated` (default `false`). When `true`, **skip** the
  `applyGameResult`/rating-write block (do **not** call `updateRating`/assign `gameRatings`/`opponentByPool`)
  and set `unrated: true` on the `GameRecord`. Still `putGame` (the game is recorded, just un-counted) and
  still `persistModel(now)` (other model state, if any, persists; the rating simply wasn't changed).
  Keep `finishGame` idempotent (`gameFinished` guard unchanged).

**A3 — `src/store/db.ts` `SettingsRecord` + `src/store/playerModel.ts` default (opt-in takeback).**
- Add `takebackInPlay?: boolean;` to `SettingsRecord` with a doc:
  *"Opt-in: allow on-demand takeback during a normal game (P2). Default false (read-site `?? false`).
  A takeback in a rated game marks that game un-counted (ADR-0058). No DB_VERSION bump."*
- Add `takebackInPlay: false` to the `freshSettings()` factory (`playerModel.ts:110-111`, **not**
  `DEFAULT_SETTINGS` — that name does not exist) so a fresh profile is explicit (matches the
  `coachedMode: false`/`metacogEnabled: false` fields already listed there). Existing/legacy records
  back-read fine via the `?? false` read-site, so this is for explicitness, not correctness.

**A4 — `src/ui/Play.svelte` (state + handlers).**
- New state: `let unrated = $state(false);` (reset to `false` in `newGame()` alongside the other resets,
  `:131-137`); `let resignOpen = $state(false);`; `let checkVerdict = $state<'risky' | 'fine' | null>(null);`
  (the on-demand check result); a `checkedFen` guard so a check maps to the current position only.
- Derived: `const moveSan = $derived(fen ? game.history() : []);` (re-derives on every move, ADR-0051
  pattern) → fed to `toMovePairs(moveSan, …)`. Derive `startSide`/`startMoveNo` from the start FEN for 960 /
  loaded positions; for the standard start they are `'w'`/`1`.
- `const takebackEnabled = $derived(app.settings?.takebackInPlay ?? false);`
- `const canTakeBack = $derived(takebackEnabled && status === 'playing' && turnColor() === playerColor &&
  !coachOpen && !thinking && aStatus !== 'analyzing' && playerHasMoved());` where **(FOLD A4)**
  `playerHasMoved()` is true only if the player has actually made at least one move that can be undone — NOT
  merely "≥1 ply exists". Concretely: a White player needs `history().length >= 2` (player move + bot
  reply, so undoing returns to the player's turn); a Black player needs `history().length >= 3` (bot ply 1,
  player ply 2, bot ply 3). **The degenerate case this closes:** a Black player at ply 1 (bot just opened,
  player hasn't moved) must NOT be able to "take back" the bot's opening move (that would empty the board
  with the bot to move). `playedUci` length is the simplest cursor here; derive the rule from whose turn it
  is + how many plies exist rather than a magic constant if it reads clearer.
- Handlers:
  - `requestResign()` → `resignOpen = true;` (replaces the button's direct `resign()`).
  - `confirmResign()` → `resignOpen = false; resign();` (the existing `resign()` is untouched).
  - `cancelResign()` → `resignOpen = false;`.
  - `takeBack()` → if `!canTakeBack` return. If the game is **rated** (i.e. not already `unrated` — every
    Play game is rated today) set `unrated = true`. Then undo back to the player's turn: since `canTakeBack`
    guarantees the player has moved, the last ply is always the **bot's reply** — `game.undo()` it, then
    `game.undo()` the player's move; update `fen`, recompute `lastMove` from the now-last ply (or `null` if
    none), pop `playedUci` **twice**, clear `checkVerdict`/`checkedFen`. Mirror `coachTakeBack`'s field
    updates. **(FOLD A4) Never call `engineMove()` from here** — after the double-undo it is the player's
    turn and the loop resumes naturally on their next move; auto-firing the engine would re-open the
    position we just left. Keep the clock as-is (no time rewind — honest; the time was spent).
  - `rematch()` → **(FOLD A4)** guard against a stale in-flight analysis: if `aStatus === 'analyzing'`,
    either ignore the click or cancel the pending `runAnalysis` (its result must not write `aResult` into
    the fresh game). Then `void newGame();` (same color/TC/variant; the in-memory config is reused).
    `newGame()` already resets `aResult`/`aStatus`/`aPuzzles` (`:130-132`), so the only risk is a
    still-resolving promise — discard it (e.g. a generation token checked before assigning `aResult`).
    Distinct button so intent reads clearly even though it call-throughs.
  - `checkMove()` → if not the player's turn, return. If `checkedFen === game.fen`, no-op (one check per
    position — AP-PLAYUX-5). Set `checkedFen = game.fen`; `checkVerdict = (await coachEvalBad()) ? 'risky'
    : 'fine';`. Never moves/undoes/presses the clock.
  - Clear `checkVerdict` + `checkedFen` at the start of `onMove` (a new move invalidates the prior verdict).
- `finishGame` reads `unrated` (A2). No other change to the move/engine loop.

**A5 — `src/ui/Play.svelte` markup.**
- **Move list:** a `<div class="move-list" role="log" aria-live="off">` (history log; not a live region —
  it would over-announce every ply) rendered next to the board (`.board-wrap` row) or directly below it on
  narrow screens. Render `toMovePairs(...)`: each row `no.`, white SAN, black SAN; add `aria-current="true"`
  + a highlight class on the latest ply; auto-scroll the latest row into view with a tiny `$effect` keyed
  on `moveSan.length` (`el?.scrollIntoView({ block: 'nearest' })`). Empty-state: hide the panel (or show a
  muted `play.moveListEmpty`) before the first move.
- **Control row (`:610-624`):** replace the bare `resign` onclick with `requestResign`; add a **Rematch**
  button in the `status === 'over'` branch next to **New game**; add **Take back** (only when `canTakeBack`)
  and **Check this move** (only on the player's turn, `status==='playing' && turnColor()===playerColor`)
  while the game is live.
- **Check verdict:** a non-blocking inline line near the feedback area: `{#if checkVerdict}` →
  `play.checkRisky` / `play.checkFine` (muted; cleared on the next move).
- **Un-rated note:** when `unrated`, a small muted line (`play.unratedNote`) near the status so the player
  knows this game won't count *before* it ends.
- **Resign confirm dialog:** a second `<ConfirmDialog open={resignOpen} danger … onConfirm={confirmResign}
  onCancel={cancelResign}/>` with `play.resignConfirmTitle` / `play.resignConfirmBody` /
  `play.resignConfirmYes` / `play.coachKeep`-style cancel (`play.resignConfirmNo`).
- Do **not** alter the `<Board>` props, the coached dialog, or the clocks markup.

**A6 — `src/ui/Settings.svelte` toggle + `src/i18n/messages/play.ts` (and `settings.*`) keys.**
- Settings: add a checkbox following the `coachedMode`/`metacogEnabled` pattern (`Settings.svelte:75/84`)
  bound to `takebackInPlay` with a `toggleTakeback()` (`x=!x; await persistSettings()`), label
  `settings.takebackInPlay` + a help line `settings.takebackInPlayHelp` ("…undoing a move in a rated game
  means it won't count").
- i18n (FR + EN, stable keys), appended after the existing `play.*` block (`play.ts:122`):
```
'play.rematch':            { fr: 'Revanche',                       en: 'Rematch' },
'play.takeBack':           { fr: 'Annuler le coup',                en: 'Take back' },
'play.checkMove':          { fr: 'Vérifier ce coup',              en: 'Check this move' },
'play.checkRisky':         { fr: 'Ce coup semble risqué.',        en: 'This move looks risky.' },
'play.checkFine':          { fr: 'Ce coup semble correct.',       en: 'This move looks fine.' },
'play.unratedNote':        { fr: 'Coup repris — cette partie ne comptera pas.', en: "Move taken back — this game won't count." },
'play.moveListEmpty':      { fr: 'Aucun coup pour l\'instant.',    en: 'No moves yet.' },
'play.resignConfirmTitle': { fr: 'Abandonner ?',                  en: 'Resign?' },
'play.resignConfirmBody':  { fr: 'La partie sera perdue et comptera comme une défaite.', en: 'The game will be lost and counts as a defeat.' },
'play.resignConfirmYes':   { fr: 'Abandonner',                    en: 'Resign' },
'play.resignConfirmNo':    { fr: 'Continuer',                     en: 'Keep playing' },
```
```
'settings.takebackInPlay':     { fr: 'Autoriser les reprises en partie', en: 'Allow takebacks during a game' },
'settings.takebackInPlayHelp': { fr: 'Reprendre un coup dans une partie classée la rend non comptabilisée.', en: 'Taking a move back in a rated game makes it not count.' },
```
(`play.takeBack` mirrors the wording of the existing `play.coachTakeBack` for consistency; the un-rated
note is the honesty surface for ADR-0058.)

## §5 Phase B — tests

**Honest constraint (baseline):** no Svelte component-test harness; adding one is a separate infra PR
(§11 D3). So Phase B targets the **pure core** + a **static wiring guard**, exactly as F2/F5 did.

- **B1 — `toMovePairs` unit tests (NEW, the load-bearing logic).** `src/game/moveList.test.ts` covering:
  even/odd ply counts (trailing white-only pair); the standard start (`1. e4 e5  2. Nf3`); a **Black-first**
  start (`startSide='b'` → `1... e5  2. Nf3 …`) for 960 / loaded mid-game; a 960 castle SAN (`O-O`) passes
  through verbatim; `whitePly`/`blackPly` indices map back to the right `sanHistory` slots; empty history →
  `[]`. Pure, fast, no DOM. This is the only new non-trivial logic and it is fully covered here.
- **B2 — `finishGame` un-rated skip (logic-level).** The rating skip is the policy core. Prefer extracting
  the decision into a tiny pure helper if it reads cleanly (e.g. `shouldRate(unrated): boolean`) and unit-
  test it; otherwise assert via the existing rating/repos test seam that a `GameRecord{unrated:true}` does
  **not** change the pool rating while a normal record does. (If neither seam is clean without mounting,
  this drops to a C-phase manual check — recorded honestly, not faked with a component test.)
- **B3 — static wiring guard.** A source-level test (Node `fs` read of `Play.svelte`, no DOM) asserting:
  the Resign button routes through `requestResign`/`ConfirmDialog` (not a bare `resign()` onclick); a
  `rematch` and `takeBack` and `checkMove`/`checkVerdict` handler are referenced; `finishGame` references
  `unrated`. Locks the rollout so a later edit can't silently regress (mirrors F2 B2's spirit).
- **B4 — i18n parity.** The existing FR/EN structural test now also guards the new `play.*`/`settings.*`
  keys (both locales present) — no new test, confirm it passes.
- **B5 — no-regression.** Full suite stays **≥ 504 green** (the new B1/B2 tests are additive; nothing
  existing should change). `coachEvalBad`/`coachTakeBack`/960 undo tests stay green (P2 reuses, doesn't
  modify, those paths).

## §6 Phase C — verification

- **C1 — gates.** `npm test` green (≥ baseline, no regression), `npm run check` **0/0**, `vite build` green.
- **C2 — move list (preview).** Play a standard game: confirm the list fills move-by-move, numbers
  correctly, highlights + auto-scrolls the latest ply, and reads back the whole game after it ends. Play as
  **Black** and a **960** game: numbering still correct (Black-first / castle SAN renders).
- **C3 — rematch.** Finish a game, click **Rematch**: same color, same time control, same variant; a fresh
  game starts (bot moves first iff you're Black), steering/opening behave as a normal new game.
- **C4 — confirm-resign.** Click **Resign**: the dialog opens (clock keeps running); **cancel** → game
  continues unchanged; **confirm** → game ends as a loss and is recorded exactly as today. Escape cancels
  (ConfirmDialog behaviour).
- **C5 — takeback (opt-in + rating integrity + degenerate guards).** With `takebackInPlay` OFF: no
  Take-back button (today's behaviour). Toggle it ON in Settings: on your turn, **Take back** undoes your
  move and the bot's reply so it's your turn again; the board/last-move/move-list update; the "won't count"
  note appears. Finish the game and confirm via the rating display / a re-open that the **rating did not
  change** and the saved record is `unrated`. Confirm a game with **no** takeback still rates normally.
  Confirm coached takeback (coached mode) is unchanged. **(FOLD A4)** Play as **Black**: at ply 1 (bot just
  opened, you haven't moved) the Take-back button is **absent/disabled** — it never undoes the bot's opening
  move, and the board never empties. Confirm a takeback never auto-triggers a bot move (the engine waits for
  your next move). Click **Rematch** while "Analyse this game" is running and confirm the stale analysis
  result does not appear over the fresh game.
- **C6 — on-demand blunder check.** On your turn, **Check this move**: a verdict appears (risky/fine),
  non-blocking, does not move/undo/press the clock; a second click on the same position is a no-op; it
  works with coached mode OFF; an engine failure shows nothing harmful (never blocks). Verify the verdict
  clears after you actually move. **(FOLD A8)** Sanity-check that the shallow verdict can differ from the
  post-game full-strength analysis (play a move the shallow check calls "fine" that the full analysis later
  flags) — confirming the copy reads as an advisory hint, not a verdict.
- **C7 — bilingual.** Toggle FR/EN: every new string (rematch, take back, check verdicts, un-rated note,
  resign dialog, settings label/help, empty move list) is localized; no raw key leaks.
- **C8 — no-op safety / byte-identity.** A normal game with the setting OFF and no resign/check/takeback is
  behaviourally identical to today (same record written, same rating math). Insights study-plan output
  unchanged (P2 touched no selection code).

## §7 Phase Z — docs (LAST)

- **Z1 — `decisions.md`**: append **ADR-0058** — *"Takeback during a rated Play game marks that game
  un-counted."* Context (abuse vector: un-gated undo inflates rating), Decision (opt-in `takebackInPlay`;
  takeback → `GameRecord.unrated=true` + rating-update skipped), Consequences (honesty preserved; default
  OFF = byte-identical today; coached takeback unaffected; additive field, no `DB_VERSION` bump).
  Append-only; do not touch locked ADR-0001..0051.
- **Z2 — spec status line**: mark this spec `Status: delivered` with the merge SHA after merge.
- **Z3 — portfolio spec**: tick **P2** in `enhancements-architecture-spec.md` §3 as delivered (one line);
  note the move-list ply-preview + alternate-color rematch DEFERs (§11) so the next Play PR inherits them.
- **Z4 — README**: if it lists Play features, add "in-game move list, rematch, confirm-resign, opt-in
  takeback, on-demand move check" (skip if no such list exists).

## §8 Acceptance

- [ ] A scrollable, auto-following SAN move list renders during and after a game, latest ply highlighted,
      numbered correctly for White-first, Black-first, and 960 (castle SAN) games.
- [ ] `toMovePairs` is a pure module with unit tests (B1) and is the single numbering authority.
- [ ] A **Rematch** button restarts with the same color, time control, and variant (call-through to
      `newGame()`); steering/opening behave as a normal new game.
- [ ] **Resign** opens a `ConfirmDialog` (danger); confirm → today's resign/loss path, cancel → no change.
- [ ] An **opt-in** `takebackInPlay` setting (default OFF) gates an on-demand **Take back** on the
      player's turn; using it undoes back to the player's turn and (if rated) marks the game un-counted.
- [ ] (FOLD A4) Takeback requires the player to have moved (a Black player can't undo the bot's opening),
      undoes bot-reply + player-move, never auto-fires the engine, and is disabled during analysis; rematch
      discards any in-flight analysis result.
- [ ] A rated game with a takeback writes `GameRecord.unrated=true` and **does not** change the rating; a
      game without a takeback rates exactly as today (B2 / C5).
- [ ] **Check this move** reuses `coachEvalBad`, shows a non-blocking verdict, never moves/undoes/clocks,
      one check per position, works regardless of coached mode.
- [ ] New `GameRecord.unrated?` + `SettingsRecord.takebackInPlay?` are additive-optional; **no
      `DB_VERSION` bump**; read-sites default.
- [ ] All new `play.*`/`settings.*` keys exist in FR + EN; parity test green.
- [ ] `npm test` green (≥ 504, no regression), `npm run check` **0/0**, `vite build` green.
- [ ] Insights study-plan output byte-identical (no selection/study-plan code touched).
- [ ] Static wiring guard (B3) prevents silent regression of resign-confirm / takeback / rematch / check.
- [ ] Manual preview (C2–C8) passes in both locales.

## §9 Anti-patterns (AP-PLAYUX-)

- **AP-PLAYUX-1 — Re-deriving move pairs inline / a second numbering path.** The list must read the single
  pure `toMovePairs` over `game.history()`. Do not build a parallel SAN list from `playedUci` (it's UCI,
  not SAN, and would diverge on 960 castles).
- **AP-PLAYUX-2 — Smuggling ply navigation / a board-at-ply preview into the static list.** Click-to-preview
  needs a ply cursor + history-vs-live mode (a separate concern, §11 D1, the cursor F2 routed here as its
  own PR). A static list that silently mutates the live board on click is a correctness trap. Static only.
- **AP-PLAYUX-3 — A takeback that keeps the game rated.** An un-gated/rated takeback is an abuse vector
  (undo every blunder, keep the gain). Takeback is opt-in AND forfeits the rating for that game
  (`unrated=true` + skip `updateRating`), surfaced to the user. This is the whole point of ADR-0058.
- **AP-PLAYUX-4 — Resign that ends the game before the dialog resolves.** The Resign button must open the
  dialog; only `confirmResign` may call the real `resign()`. Never call `finishGame('loss')` on the first
  click (that's today's instant-loss bug this PR fixes).
- **AP-PLAYUX-5 — Spammable / move-altering blunder check.** The on-demand check is advisory: one eval per
  position (guard on `game.fen`), and it must never move, undo, press the clock, or change the rating.
  Repeated checks to brute-force the engine's best line are blocked by the per-position guard.
- **AP-PLAYUX-6 — Bumping `DB_VERSION` / non-optional field.** `unrated`/`takebackInPlay` are optional with
  read-site defaults (mirrors `coached?`/`variant?`/`metacogEnabled?`). A bump would force a migration for
  data that back-reads fine. Keep additive.
- **AP-PLAYUX-7 — Duplicating F5 (PGN export) or P3 (bot agency).** No PGN download here (F5). No bot
  resign/draw here (P3). Confirm-resign is the *player* only. Stay on P2's single concern.
- **AP-PLAYUX-8 — A bare/English string.** Every new label/verdict/dialog/help is user-facing → bilingual
  `t()` key, never hard-coded (ADR-0053 parity).
- **AP-PLAYUX-9 — A live-region move list that announces every ply.** The move log is `aria-live="off"`
  (history, not status); announcing each ply spams AT users. The latest ply carries `aria-current`, which
  is the orientation cue without the noise.
- **AP-PLAYUX-10 — A takeback that undoes the bot's opening move or auto-fires the engine.** Taking back
  must require the *player* to have moved (so a Black player at ply 1 can't undo White's opening, emptying
  the board), must undo to the player's turn (bot reply + player move), and must **never** call
  `engineMove()` itself — the loop resumes on the player's next move. Also disable takeback/rematch while an
  analysis is in flight so a stale `runAnalysis` result can't write into a fresh game.

## §10 Rollback

Mostly additive UI + one optional field. Rollback = revert the commit: the move list, Rematch / Take-back /
Check buttons, the resign dialog, and the settings toggle vanish (Resign falls back to … the *old* instant
resign only if A4's `requestResign` swap is also reverted — so revert the whole commit, not a partial). The
`unrated` field becomes unread (records that carry it read fine elsewhere — it's optional); `takebackInPlay`
becomes unread (`?? false`). No data migration to unwind (no `DB_VERSION` change). `toMovePairs` is a new
pure file with no other consumer — deletes cleanly. Per-feature partial-disable is possible (e.g. hide the
Take-back button) but the rating-skip + field should be reverted together to avoid a half-state where a
record is marked `unrated` but still rated. ADR-0058 stays in `decisions.md` as a (reverted) record entry.

## §11 Follow-up (DEFER — explicitly out of P2)

- **D1 — Click-to-preview a ply + ←/→ ply navigation.** Add a ply cursor, board-state-at-ply
  reconstruction (replay-from-start or a per-ply FEN cache), and a "viewing history vs live" mode; clicking
  a move in the list (it already carries `whitePly`/`blackPly`) jumps the board to that position read-only.
  This is the cursor F2 §11 D2 routed to "the PR that owns a move list" — it is the *next* Play PR, not P2.
- **D2 — Alternate-color rematch.** A toggle ("rematch as the other color") that flips `colorChoice` each
  rematch (and seeds the bot's first move accordingly). Small, but its own color-flip state (Q-D).
- **D3 — A Svelte component-test harness** (`@testing-library/svelte`) so the move list, dialogs, and
  takeback flow get *behavioural* tests instead of the static wiring guard. Benefits the whole UI; own infra
  PR (mirrors F2/F5).
- **D4 — Deeper "why" on the on-demand check.** Route the checked move through the F4/T1 teach/explain
  reveal (best line + reason), not just the shallow risky/fine verdict. Couples to that stack; defer until
  F4 lands.
- **D5 — Takeback budget / per-game cap.** Today (P2) a takeback simply forfeits the rating; a future option
  could allow *N* "rated takebacks" with a difficulty/penalty model. Out of P2 (would re-open the rating
  policy ADR-0058 settled).
- **D6 — Move-list export / copy.** Copy the move list as text/PGN — folds into F5's PGN I/O, not P2.
