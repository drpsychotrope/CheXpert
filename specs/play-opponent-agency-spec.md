# Spec — Opponent agency & realism (Feature P3)

**Type**: feature (additive) · **PR**: `play-opponent-agency` · **ADR**: none (default; flag ≥0058 only if PR-time review deems the realism model a genuine new decision — see §7)
**Spec version**: V1 (enriched) · **Drafted**: 2026-06-30 · **Method**: `/draft-general` (4 cycles) → `/enrich` (3 cycles, 4 folds E1–E4)
**Parent**: `specs/enhancements-architecture-spec.md` §3 (P3) · **Folds**: PL4, PL9, PLt (difficulty control/override · increment-in-movetime · difficulty-scaled coached-blunder threshold)
**Depends on**: F6 `specs/game-session-controller-spec.md` (hard prerequisite — see §0, §3)

> **Doctrine**: additive-optional, **no `DB_VERSION` bump** (settings/game additive optional fields + `schemaRev`, mirroring `opponentStyle?`/`coached`). Honesty (an override game does not move the adaptive pool — §0.5 Q-E). Bilingual FR/EN parity for every new string. **Pure cores** (the resign/draw/difficulty *decision* is a pure function; the eval fetch and `Math.random` stay at the edge). Insights output stays **byte-identical** (P3 does not touch `buildStudyPlan`). **Single concern**: give the player agency over the opponent and make the opponent realistic. **Code before docs.**

---

## §0 Context

Today the Play opponent's strength is **100% automatic and invisible**, and the bot never concedes:

- **Strength is auto-only.** The adaptive bot starts at the pool's `targetElo` and is nudged ±50–100 Elo toward a rolling ~55% player win-rate after each game (`AdaptiveOpponent.recordGame`, `playSession.applyGameResult`). The player **cannot ask for a deliberately hard or easy game** (RED#2). The opponent-style `<select>` (`Play.svelte:517`) only toggles *how* the bot picks (human-sampled vs best move) — not *how strong*.
- **Adaptation is silent.** After a game the bot's Elo shifts, but nothing tells the player it happened or in which direction (PL4). The realism of "the opponent got tougher because you keep winning" is invisible.
- **The bot plays to the bitter end.** It never resigns a dead-lost position and never agrees to a draw — it grinds bare-king mates and shuffles in dead-drawn endings (PL9). The player has no way to offer a draw.
- **Minor realism gaps** (PLt): the clock increment is not added to the bot's per-move time budget (`botMovetime` ignores increment), and the coached-blunder warning threshold is a flat 250 cp regardless of how strong/weak the bot is.

**This PR** gives the player agency over the opponent (a difficulty control) and makes the opponent realistic (it resigns when truly lost, accepts a draw when the position is dead, and uses its increment), with an honest post-game line showing how the bot adapted.

**Dependency posture (F6).** Architecture §3 lists **P3 dep = F6** (shared game-session controller). The pre-V0 scan confirmed `src/game/gameSession.ts` is **drafted (V1 spec) but not yet built**. P3 is therefore written **against the F6 contract**: the bot-resign/draw decision and the difficulty override live as new controller config/queries that the controller exposes and Play wires. **F6 must land before P3 builds.** If sequencing forces P3 first, the identical logic targets `Play.svelte`'s `engineMove`/`finishGame`/`coachEvalBad` directly as a fallback (same pure decision module, different call site) — but the F6-first order is strongly preferred and is the default this spec assumes. Concrete hooks either way: `AdaptiveOpponent.{clampElo,applyStrength,state.targetElo}`, `playSession.{applyGameResult,botMovetime}`, `Play.svelte` `finishGame`/`resign`/`ratingLine`/opponent-style select/`coachEvalBad`, `EngineClient.evaluate(...).whiteCp`.

**Premise corrections (pre-V0 scan).**
1. `AdaptiveOpponent.pickMove` returns a **uci string** (`res.bestmove`), *not* an eval cp. The honest eval signal for resign/draw is `EngineClient.evaluate(fen, { fullStrength: true }).whiteCp` (white-POV cp) — already the pattern in `coachEvalBad`. The bot-resign decision **must use a full-strength eval**, never the throttled `UCI_Elo` search, or a weak bot would resign on its own bad eval (AP-OPPAGENCY-3).
2. F6 unbuilt (above).

---

## §0.5 Arbitrages (resolved → applied to V1)

| Q | Question | Options | **Default (applied to V1)** |
|---|---|---|---|
| **Q-A** | Difficulty model | (a) free Elo slider; (b) **modes {Adaptive(default) · Easier(−200) · Harder(+200) · Fixed Elo}** as offset/override before `applyStrength` | **(b)** four modes. `Adaptive` = today's behaviour (default → **zero regression**). `Easier`/`Harder` = `clampElo(adaptiveTargetElo ± 200)` offset. `Fixed` = an explicit Elo the user sets, clamped to [1320,3190]. Set the bot via `state.targetElo` then `applyStrength()`. |
| **Q-B** | Bot-resign rule | (a) flat eval gate; (b) **`whiteCp` from the bot's POV below −RESIGN_CP for N consecutive bot-decision plies, threshold scaled by bot Elo** | **(b)** weak bots resign **less** (a 1320 bot keeps playing lost positions like a human beginner; a 2800 bot resigns promptly). Decision is a pure fn of (botPovCp, consecutivePlies, botElo). Eval is full-strength (premise #1). |
| **Q-C** | Draw handling | (a) player-offer the bot accepts near 0 + bot also offers in dead-drawn; (b) **player-offer first (bot accepts near 0 / declines if winning); bot-initiated offer DEFERRED** | **(b)** ship the **player draw-offer** the bot accepts when the full-strength eval is near 0 (|whiteCp| ≤ DRAW_CP) for N plies (and declines if it's winning). **Bot-initiated draw-offer is DEFERRED** to a follow-up (smaller surface, avoids nag/annoyance tuning this PR). |
| **Q-D** | Adaptation feedback | (a) none; (b) **one post-game line derived from `nextOpp.targetElo` vs `prevOpp.targetElo`** | **(b)** yes — one honest line ("the bot will be tougher / easier / unchanged next game", with the Elo delta) shown after the game, adjacent to `ratingLine`. Derived from the values `applyGameResult` already returns. **Suppressed for override games** (an Easier/Harder/Fixed game does not adapt — Q-E). |
| **Q-E** | Does an override game move the rating pool? | (a) yes; (b) **no — a Fixed/Easier/Harder game is flagged and does NOT move the adaptive pool or the Glicko game rating** | **(b)** honesty: only an `Adaptive` game folds into `applyGameResult` (pool nudge + rating). An override game **persists the `GameRecord` (flagged `difficultyMode`)** for history/analysis but **skips** the pool/rating fold. Mirrors AP-CHESS-13/24. Explicit + tested (AP-OPPAGENCY-5). |
| **Q-F** | Increment-in-movetime (PLt) | (a) leave; (b) **add the increment to the bot's per-move budget in `botMovetime`** | **(b)** fold the per-move increment into the budget (a real opponent uses its increment). Pure change to `botMovetime` (add `incrementMs`, re-clamp per category). Untimed/960 unaffected (no clock). |
| **Q-G** | Difficulty-scaled coached-blunder threshold (PLt) | (a) leave flat 250 cp; (b) **scale `coachEvalBad`'s gate by the active difficulty/bot Elo** | **(b)** a stronger chosen opponent → a tighter "that's a blunder" gate; a weaker one → looser. Pure helper `coachedBlunderThreshold(botElo)`; `coachEvalBad` consumes it. Keeps the coached-mode signal proportional to the game you chose. |
| **Q-H** | Where does the difficulty mode persist? | (a) ephemeral; (b) **`SettingsRecord.difficultyMode?` (+ `fixedElo?`), additive optional, restored on mount like `lastTimeControl`** | **(b)** persist the chosen mode (additive optional, `?? 'adaptive'`), restored on mount — mirrors `opponentStyle?`/`lastTimeControl`. **No `DB_VERSION` bump.** |
| **Q-I** | Resign/draw decision home | (a) inline in `engineMove`/`Play`; (b) **pure module `src/engine/opponentAgency.ts` (decisions) consumed by the F6 controller / Play** | **(b)** a new pure module owns `decideResign`, `decideAcceptDraw`, `coachedBlunderThreshold`, `difficultyTargetElo` — DOM-free, no `Date`/`Math.random`/engine import → unit-testable like `playSession.ts`. The controller/Play feed it the eval cp + supply the engine fetch. |

Full reasoning + the 4 refiner cycles: `reports/play-opponent-agency_arbitrages.md`.

---

## §1 Baseline (measured — see `reports/play-opponent-agency_baseline.json`)

- **Tests**: 504 passed / 69 files green (`npm test`). **No Svelte component-test harness** (0 `*.svelte.test.ts`) → P3 verifies via **pure-core unit tests** (the resign/draw/difficulty/threshold decisions are pure and fully unit-testable), static wiring-presence, and manual/preview.
- **svelte-check**: 0 errors / 0 warnings across 383 files.
- **`DB_VERSION` 4**, player `schemaRev` 1, settings `schemaRev` 1. Latest committed ADR **0053**.
- **Today's opponent behaviour (the thing P3 changes)**: strength 100% auto (`recordGame` nudge), invisible (no feedback line), bot never resigns/draws, `botMovetime` ignores increment, coached threshold flat 250 cp.
- **Reuse hooks verified present** (`reports/play-opponent-agency_target_exists.json`): `AdaptiveOpponent.{clampElo:26, applyStrength:72, rollingWinRate:35, pickMove:81→uci, pickHumanMove:92, recordGame:46}`; `playSession.{applyGameResult:40→{nextOpp,nextRating}, botMovetime:23, flagOutcome:32}`; `Play.svelte.{finishGame:404, resign:494, ratingLine:509, opponentStyle select:517, coachEvalBad:308→flat 250cp, engineMove:321, checkEnd:386}`; `SettingsRecord` (additive-optional pattern), `GameRecord.coached`; `EngineClient.evaluate→{whiteCp}`; `ConfirmDialog` (non-blocking, `danger`); `ChessGame.terminal()→{over,reason,winner}`.

---

## §2 Scope (single concern)

**Single concern**: *give the player agency over the opponent and make the opponent realistic.*

**IN**
1. **Difficulty modes** (Q-A, Q-H): a Play control {Adaptive (default) · Easier (−200) · Harder (+200) · Fixed Elo}, persisted in `SettingsRecord.difficultyMode?`/`fixedElo?`, restored on mount, applied to the bot's `targetElo` before `applyStrength()`. Adaptive = today (zero regression). When an override is active, the rating line shows the **effective** bot Elo + a mode tag so the displayed strength matches what's actually being played (E1 — see §4.A2).
2. **Bot resign** (Q-B): the bot resigns when a full-strength eval from its POV is below an Elo-scaled threshold for N consecutive bot-decision plies → ends the game as a **player win**.
3. **Player draw-offer the bot accepts/declines** (Q-C): the player offers a draw; the bot accepts when the full-strength eval is near 0 for N plies (declines if winning) → ends the game as a **draw by agreement**.
4. **Adaptation feedback line** (Q-D): one honest post-game line from `nextOpp.targetElo` vs `prevOpp.targetElo` (suppressed for override games).
5. **Increment-in-movetime** (Q-F): fold the per-move increment into `botMovetime`.
6. **Difficulty-scaled coached-blunder threshold** (Q-G): scale `coachEvalBad`'s gate by the active bot Elo.
7. **Honest pool isolation** (Q-E): an override game does not move the adaptive pool or the Glicko rating; it persists a flagged `GameRecord`.
8. **Pure decision module** `src/engine/opponentAgency.ts` + its tests.
9. **FR+EN** strings for every new label/line; ADR/decisions doc (LAST).

**OUT**
- **Bot-initiated draw offers** (Q-C → DEFERRED; §11).
- **Confirm-before-resign, rematch, takeback, in-game move list** — those are **P2** (`In-game UX`). P3 reuses `ConfirmDialog` for the draw-offer prompt but does **not** add/alter the player-resign confirm (AP-OPPAGENCY-7).
- **F6 controller extraction itself** — that is F6; P3 *consumes* it (adds capability, does not re-extract the loop).
- **PGN export / opening-variety seed** — those PLt items are **F5 / P4**, not P3 (AP-OPPAGENCY-7).
- **Insights / `buildStudyPlan` / weakness profile** — untouched (byte-identical).
- **Any `DB_VERSION` / store / index change.**
- **Free-form Elo slider** (Q-A → Fixed-Elo input only).
- **Sparring/Comeback** opponent behaviour (P3 is the Play surface; siblings adopt via their own fast-follow once F6 migrates them — §11).

---

## §3 Pre-flight

1. **F6 prerequisite**: confirm `src/game/gameSession.ts` exists and exposes the controller contract (`config` opt-ins, return-state, no auto-chain, `checkTerminal` pure). If F6 is **not** built, either (a) build F6 first (preferred), or (b) explicitly switch this PR to the `Play.svelte`-direct fallback call sites and note it in the PR description. **Do not** silently assume the controller.
2. `npm test` green at HEAD (capture count = 504 baseline).
3. `svelte-check` → 0 errors at HEAD.
4. `npm run build` green at HEAD.
5. Confirm reuse hooks (done — `reports/play-opponent-agency_target_exists.json`).
6. Confirm `EngineClient.evaluate` accepts `fullStrength` (db/engine confirmed) — the resign/draw eval **must** pass it.
7. Re-confirm ADR posture: default **no new ADR** (feature). If PR-time review elevates the realism model to an architectural decision, reserve **0058**.
8. Branch off `main`.

---

## §4 Phase A — CODE FIRST

**A0 — Pure decision module** (`src/engine/opponentAgency.ts`, new — DOM-free, no `Date`/`Math.random`/engine import):

- `export type DifficultyMode = 'adaptive' | 'easier' | 'harder' | 'fixed';`
- `export const DIFFICULTY_OFFSET = 200;` (Easier/Harder delta, cp-of-Elo).
- `difficultyTargetElo(mode, adaptiveElo, fixedElo): number` — pure; returns `clampElo` of: `adaptive→adaptiveElo`, `easier→adaptiveElo−200`, `harder→adaptiveElo+200`, `fixed→fixedElo`. (Imports `clampElo` from `AdaptiveOpponent`.)
- `export const RESIGN_BASE_CP = 900;` and `export const RESIGN_PLIES = 4;` — tunables.
- `decideResign({ botPovCp, consecutiveLostPlies, botElo }): boolean` — pure; true iff `botPovCp <= -resignThreshold(botElo)` AND `consecutiveLostPlies >= RESIGN_PLIES`. `resignThreshold(botElo)` scales the cp gate by Elo so weak bots resign **less** (e.g. linear from a *higher* (more lenient) cp at `ELO_MIN` to `RESIGN_BASE_CP` at `ELO_MAX`; a sub-resign-strength floor where a very weak bot **never** resigns is allowed and tested). Never resign while a forced mate is not clearly present-against — i.e. resign only on a sustained, decisive material/eval deficit, never on a single noisy ply (AP-OPPAGENCY-2).
- `decideAcceptDraw({ whiteCp, botSide, consecutiveEqualPlies }): boolean` — pure; true iff `|whiteCp| <= DRAW_CP` (e.g. `DRAW_CP = 30`) for `consecutiveEqualPlies >= DRAW_PLIES`, AND the bot is **not** winning from its POV (decline if `botPovCp >` a small positive margin). The bot never accepts a draw when it's better (AP-OPPAGENCY-4).
- `coachedBlunderThreshold(botElo): number` — pure; returns the cp gate replacing the flat 250 (Q-G), scaled by Elo (stronger opponent → tighter gate). Defaults reproduce ~250 around the mid pool so coached behaviour is unchanged at a typical Elo (regression-safe).

> Determinism: every function above is a pure fn of its numeric args. The **eval fetch** (`EngineClient.evaluate(fen,{fullStrength:true}).whiteCp`) and any randomness stay at the call site, exactly like `sampleHumanMove`/`coachEvalBad`. This is what makes the §5 tests global-free.

**A1 — Increment-in-movetime** (`src/game/playSession.ts`, `botMovetime` — Q-F):
- Add an `incrementMs` parameter (default 0 → behaviour-preserving for existing callers/tests) and add it to the budget before the per-category clamp. Pure. Update the doc comment. Existing `playSession.test.ts` stays green (default 0); add a case for increment folded in.

**A2 — Difficulty application** (controller/`Play` wiring):
- On `newGame`, after seeding the adaptive `targetElo` from the pool, compute the effective Elo via `difficultyTargetElo(mode, adaptiveElo, fixedElo)` and set `state.targetElo` before `applyStrength()`. `Adaptive` reproduces today exactly.
- Difficulty `<select>` + (when `fixed`) an Elo number input, mirroring the opponent-style select + 960 SP-ID input pattern (disabled while `live`). Persist via `app.settings.difficultyMode`/`fixedElo` + `persistSettings()`; restore on mount (`$effect`, like `lastTimeControl`).
- **Fixed-input default (E4)**: when `fixed` is first selected the Elo input is seeded from the current pool/adaptive Elo, never left empty/NaN (mirrors the 960 SP-ID "blank = sensible default" handling).
- **Effective-Elo display (E1, honesty)**: `ratingLine` today reads the bot Elo from `poolOpponent(...).targetElo` (the *pool's adaptive* value). Under an override the bot plays at `difficultyTargetElo(...)`, so the pool value would misstate the strength. When `difficultyMode !== 'adaptive'`, display the **effective** bot Elo (the value actually applied) plus a short mode tag (`play.difficultyTag*`) so the line never lies about who you're playing. Adaptive games keep the existing line verbatim (byte-identical).

**A3 — Bot resign / accept-draw in the loop** (F6 controller `engineReply` path, or `Play.engineMove` fallback):
- After the bot would move (or before, per the cheapest correct point), run a **full-strength** `evaluate` of the current position; track `consecutiveLostPlies` / `consecutiveEqualPlies` counters on the session.
- **Eval-failure robustness (E3)**: the resign/draw eval is a serialized worker round-trip that can throw (worker crash/timeout). On throw → **no resign, no auto-accept**: reset the counters and let the bot play its move as normal (mirrors `coachEvalBad`'s `catch → false`). A failed eval must never block the hot path nor fabricate a concession (AP-OPPAGENCY-13).
- If `decideResign(...)` → end the game as a **player win**: the controller returns a structured `{ over:true, reason:'resign', winner: playerSide, outcome:'win' }` (no localized string — F6 AP-CTRL-1); Play maps it through `t('play.botResigns')` and calls `finishGame('win')`.
- Player draw-offer: a "Offer draw" button (live, player's turn) sets an offered flag; on the bot's next decision, if `decideAcceptDraw(...)` → structured `{ over:true, reason:'agreement', outcome:'draw' }` → Play shows `t('play.drawAgreed')` + `finishGame('draw')`; else the offer is declined (`t('play.drawDeclined')`, game continues). The eval reuse: the same full-strength eval already fetched for the resign check feeds the draw decision (one eval per bot decision, not two).
- **Pending-offer indicator (E2, observability)**: while a player draw-offer is outstanding (between the click and the bot's next decision), show a persistent "draw offered" line in the feedback slot (`play.drawOfferedPending`) so the offer is legible rather than silently in-flight. Cleared on accept/decline.
- **Honesty (Q-E)**: the resign/draw/normal end all route through `finishGame`, which **branches on `difficultyMode`**: `adaptive` → `applyGameResult` (pool nudge + rating, as today); override → **skip** the fold, still `putGame` a `GameRecord` flagged with `difficultyMode` (additive optional field). `finishGame`'s `gameFinished` idempotency guard is preserved.

**A4 — Coached threshold scaling** (`Play.coachEvalBad` — Q-G):
- Replace the flat `±250` with `coachedBlunderThreshold(effectiveBotElo)`. Behaviour at a typical pool Elo is ~unchanged (regression-safe default).

**A5 — Adaptation feedback line** (`Play`, post-game — Q-D):
- After `finishGame` (adaptive games only), derive the line from `prevOpp.targetElo` vs `nextOpp.targetElo`: tougher / easier / unchanged + the delta. Render adjacent to `ratingLine`. Suppressed for override games (no adaptation happened). Pure string selection; values come from what `applyGameResult` already returns.

**A6 — Persistence shape** (additive, no `DB_VERSION` bump):
- `SettingsRecord.difficultyMode?: DifficultyMode` + `fixedElo?: number` (read `?? 'adaptive'` / `?? <pool seed>`); bump settings `schemaRev` if the load path must backfill (else leave). `GameRecord.difficultyMode?: DifficultyMode` (absent = legacy adaptive). Both additive optional — **no migration**.

---

## §5 Tests

New `src/engine/opponentAgency.test.ts` (DOM-free, mirrors `AdaptiveOpponent.test.ts` / `playSession.test.ts` — **no fake timers, no seeded random**; the decisions are pure numeric fns):

1. **`difficultyTargetElo`**: adaptive returns the input; easier = input−200 (clamped); harder = input+200 (clamped); fixed returns the clamped fixed value; clamping at `ELO_MIN`/`ELO_MAX` boundaries (e.g. harder from 3100 clamps to 3190; easier from 1400 clamps to 1320).
2. **`decideResign` — strong bot**: a 2800 bot with `botPovCp ≤ −threshold` for ≥ `RESIGN_PLIES` → true; below the ply count → false; a single bad ply → false.
3. **`decideResign` — weak bot resigns less**: a 1320 bot does **not** resign at the same cp/plies a strong bot resigns at (Elo-scaled threshold; a very weak bot may never resign — assert the documented floor).
4. **`decideResign` — never on a transient swing**: cp dips below the gate for fewer than `RESIGN_PLIES` then recovers → never returns true.
5. **`decideAcceptDraw` — near-0 accepted**: `|whiteCp| ≤ DRAW_CP` for ≥ `DRAW_PLIES` and bot not winning → true.
6. **`decideAcceptDraw` — bot winning declines**: bot clearly better → false even if a (stale) equal-ply count exists (the winning check dominates).
7. **`decideAcceptDraw` — not yet stable**: equal for fewer than `DRAW_PLIES` → false.
8. **`coachedBlunderThreshold`**: monotonic in Elo (stronger → tighter/smaller gate); at a mid pool Elo ≈ the legacy 250 (regression anchor); clamped sane at the extremes.
9. **`botMovetime` increment fold** (in `playSession.test.ts`): with `incrementMs > 0` the budget increases by the increment (then per-category clamp); `incrementMs = 0` reproduces the existing expected values (the existing 6 cases stay green).
10. **Honesty branch (decision-level)**: a small pure helper (or the documented branch contract) — assert that the override→skip-fold decision is keyed only on `difficultyMode !== 'adaptive'` (a unit assertion on the predicate, since the fold itself lives in the component; the predicate is pure and testable).
11. **Adaptation-line selection**: given (prevElo, nextElo) → 'tougher' when next>prev, 'easier' when next<prev, 'unchanged' when equal; and the suppressed case (override) returns null/none.

**Purity guard** (mirrors F6 C3-2): if any test needs `vi.useFakeTimers()`/seeded random to pass, the core leaked impurity and must be fixed — determinism comes from passing numeric eval cp directly, not from patching globals.

**Regression**: `AdaptiveOpponent.test.ts`, `playSession.test.ts` (incl. the unchanged increment-default cases), and the Insights snapshot stay green.

---

## §6 Verification

- `npm test` — all green; new `opponentAgency.test.ts` passing; **no drop** vs the 504 baseline (≥ 504 + new).
- `svelte-check` — 0 errors (Play + module typed).
- `npm run build` — green.
- **Insights byte-identity**: the existing study-plan snapshot is unchanged (P3 touches none of that path) — confirm.
- **Honest-pool check (automatable at the decision layer; manual at the fold)**: a Fixed/Easier/Harder game does **not** change `poolOpponent(model,pool).targetElo` nor `gameRatings[pool]` (manual: note the rating line before/after an override game — unchanged; an Adaptive game still moves it). The decision predicate is unit-tested (§5.10).
- **Manual/preview smoke (Play)**:
  - Difficulty modes: Adaptive plays as before; Easier visibly weaker, Harder stronger, Fixed at the entered Elo; selection persists across reload; disabled while a game is live. **(E1)** under an override the rating line shows the effective bot Elo + mode tag (not the stale pool Elo); Adaptive line unchanged. **(E4)** selecting Fixed seeds the input from the current Elo (never blank).
  - **(E2)** offering a draw shows a persistent "draw offered" line until the bot accepts/declines.
  - **(E3)** if the engine errors during the resign/draw eval, the bot still plays its move (no spurious resign, no freeze).
  - Bot resign: contrive a winning position (or beat a weak bot down) → the bot resigns with the FR/EN line, scored as your win; a weak bot grinds on (no premature resign).
  - Draw offer: offer a draw in a dead-equal position → bot accepts (draw by agreement); offer while you're worse/better appropriately declined.
  - Adaptation line: after an Adaptive win-streak the line says "tougher" with a delta; after an override game no line.
  - Increment: a game with increment → the bot uses slightly more time per move than the same base without increment.
  - Coached mode: warnings still fire sensibly; tighter vs a strong chosen opponent, looser vs a weak one.
- **i18n parity**: every new key has FR + EN (grep the new keys in `src/i18n/messages/play.ts`).

---

## §7 Docs (LAST)

- `decisions.md`: **default — no new ADR** (additive feature; the honesty rule extends AP-CHESS-13/24, not a new axis). Append a brief decision note under the existing Play lineage referencing the V1 arbitrages (difficulty modes, bot-resign Elo-scaled, player-draw-offer, override-isolation). **Flag ADR-0058 only** if PR-time review judges the bot realism model (resign/draw policy) a genuine architectural decision; if so, draft 0058 and cross-link F6 (0057) + AP-CHESS-6.
- Brief note in `enhancements-architecture-spec.md` P3 row: status → drafted/landed; record that bot-initiated draw is deferred (§11).
- README "Play" section: one line that the opponent has a difficulty control and can resign/accept a draw (user-facing). FR/EN if the README is bilingual at that section; otherwise match the existing README language convention.
- No other user docs (in-app strings carry the UX).

---

## §8 Acceptance

1. `src/engine/opponentAgency.ts` exists; DOM-free; no `Date`/`Math.random`/engine/`performance.now` import; owns `difficultyTargetElo`, `decideResign`, `decideAcceptDraw`, `coachedBlunderThreshold` (+ tunables).
2. Play offers a difficulty control {Adaptive · Easier · Harder · Fixed Elo}; Adaptive reproduces today's behaviour exactly (zero regression); the choice persists and is restored on mount; disabled while live. Under an override the rating line shows the **effective** bot Elo + mode tag (E1); the Fixed input is seeded, never blank (E4).
3. The bot resigns a sustained, decisively lost position (Elo-scaled, full-strength eval, ≥ N plies) → scored a player win; weak bots resign less / not at all per the floor.
4. The player can offer a draw; the bot accepts in a dead-equal position (full-strength eval near 0 ≥ N plies, not winning) and declines otherwise → scored a draw by agreement. A pending offer is shown until resolved (E2). A failed eval never resigns/auto-accepts (E3). Bot-initiated offers are out (deferred).
5. A post-game adaptation line shows tougher/easier/unchanged + delta for Adaptive games; suppressed for override games.
6. `botMovetime` folds the increment (default 0 preserves existing callers/tests).
7. `coachEvalBad` uses the Elo-scaled threshold; coached behaviour at a typical Elo is ~unchanged.
8. An override game does **not** move the adaptive pool or the Glicko rating; it persists a `GameRecord` flagged `difficultyMode`. An Adaptive game still folds as today.
9. `opponentAgency.test.ts` covers §5.1–§5.8, §5.10–§5.11 + the `botMovetime` increment case (§5.9); all green; total ≥ baseline 504.
10. `svelte-check` 0 errors; `npm run build` green; Insights snapshot byte-identical.
11. No `DB_VERSION`/store/index change (additive optional fields + `schemaRev` only).
12. Every new user string has FR + EN. Docs/ADR posture per §7.

---

## §9 Anti-patterns (AP-OPPAGENCY-*)

- **AP-OPPAGENCY-1** — Difficulty as a regression. `Adaptive` (default) MUST reproduce today's strength/adaptation exactly; the offset/override is applied **only** when a non-adaptive mode is chosen.
- **AP-OPPAGENCY-2** — Resigning on a noisy single ply. Resign requires a **sustained** deficit (≥ `RESIGN_PLIES` consecutive bot-decision plies); never on one eval swing, never on a fortress the bot can hold.
- **AP-OPPAGENCY-3** — Resign/draw decided on the **throttled** eval. The decision MUST use a **full-strength** `evaluate({ fullStrength:true })`; a weak bot's own (deliberately bad) search must not drive its concession (or the bot would resign winning positions it merely misjudges).
- **AP-OPPAGENCY-4** — The bot accepting a draw while winning. `decideAcceptDraw` declines whenever the bot is better; accept only near-0 sustained.
- **AP-OPPAGENCY-5** — An override game silently moving the rating pool / game rating (HONESTY regression). A Fixed/Easier/Harder game skips `applyGameResult`'s fold and is flagged in its `GameRecord`; only Adaptive games adapt. Explicit + unit-tested predicate.
- **AP-OPPAGENCY-6** — Localized strings in the decision module or the F6 controller. `opponentAgency.ts` returns booleans/numbers; the controller returns structured ends (`reason:'resign'|'agreement'`, no `t()`); labels stay in Play (F6 AP-CTRL-1).
- **AP-OPPAGENCY-7** — Scope creep into P2 (confirm-resign / rematch / takeback / move list), F5 (PGN export), F6 (re-extracting the loop), or P4 (opening-variety seed). P3 is opponent agency + realism only; it *consumes* F6 and *reuses* `ConfirmDialog`.
- **AP-OPPAGENCY-8** — `DB_VERSION` bump or a store/index change. Persistence is additive optional fields (`difficultyMode?`, `fixedElo?`) + `schemaRev`, backfilled in the load path.
- **AP-OPPAGENCY-9** — Auto-chaining the bot reply (F6 AP-CTRL-8). The resign/draw evaluation runs in the caller-orchestrated `engineReply`, not by fusing `applyPlayerMove`→`engineReply`; coached takeback + clock press still interpose.
- **AP-OPPAGENCY-10** — Two evals per bot decision. Fetch the full-strength eval **once** per bot decision and feed both `decideResign` and `decideAcceptDraw` (cost discipline on the hot path; mirrors the MultiPV-3-not-4 audit W15 lesson).
- **AP-OPPAGENCY-11** — Impurity in the core. No `Date`/`Math.random`/`performance.now`/engine import in `opponentAgency.ts`; if a test needs faked globals, the core leaked.
- **AP-OPPAGENCY-12** — Bot-initiated draw offers this PR (Q-C deferred). Player-offer only; bot-offer is §11.
- **AP-OPPAGENCY-13** — A throwing/failed resign-draw eval blocking the hot path or fabricating a concession (E3). On eval failure: no resign, no auto-accept, counters reset, the bot plays on (like `coachEvalBad`'s `catch → false`).
- **AP-OPPAGENCY-14** — The rating line stating the pool's adaptive Elo during an override game (E1, honesty). When a non-adaptive mode is active, display the **effective** bot Elo actually applied; never the stale pool value.

---

## §10 Rollback

Additive feature, single new pure module + Play wiring + one pure-helper param. Rollback = revert the PR commit: `opponentAgency.ts` is deleted, Play returns to auto-only strength / no resign-draw / flat coached threshold, `botMovetime` drops the increment param. The persisted `difficultyMode?`/`fixedElo?`/`GameRecord.difficultyMode?` are **additive optional** — old code ignores them (`?? 'adaptive'`), so no data migration to unwind. Siblings untouched. No `DB_VERSION` change either way. The feature is behaviourally gated by the difficulty `<select>` (defaulting to Adaptive = today), so even pre-revert a defect in override modes is opt-in.

---

## §11 Follow-up

- **Bot-initiated draw offers** (Q-C deferred): the bot offers a draw in a dead-drawn ending (with anti-nag tuning) — a small follow-up on top of `decideAcceptDraw`.
- **Sparring/Comeback parity**: once F6 migrates the siblings (F6 §11 fast-follow), expose the same resign/draw/difficulty capability there via controller config (they currently `pickMove(fen,500)` with no resign/draw).
- **Resignation as a teaching moment**: surface *why* the bot resigned (the losing line) once F4 teach/explain is wired into Play — defer to a Play+F4 PR.
- **Difficulty as a coached program step**: a coach "play a harder game" step could set `difficultyMode` via the existing `app.steerDimension`-style one-shot channel — defer to the Coach stack.
- **Tune `RESIGN_*` / `DRAW_*` / threshold curves** against real games once telemetry (F5 game reads) exists; the tunables are centralized in `opponentAgency.ts` for exactly this.
- **Override-game weighting in analysis** (E5, DEFER): downstream analysis / weakness steering should not over-weight a deliberately-easy win. P3 only *flags* the `GameRecord` (`difficultyMode`); how F5 game-reads / C4 assessment weight a flagged game is their concern — wire it there.
