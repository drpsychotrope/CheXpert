<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { AdaptiveOpponent, initOpponentState, type GameOutcome } from '../engine/AdaptiveOpponent';
  import type { GameRecord } from '../store/db';
  import { putGame, getAnalysis } from '../store/gamesRepo';
  import { poolRating, poolOpponent } from '../store/playerModel';
  import type { RatingPool } from '../rating/pools';
  import {
    initClock, startClock, stopClock, tick, press, flagged,
    type ClockState, type Side,
  } from '../clock/Clock';
  import {
    categoryFor, fmtClock, TIME_CONTROL_PRESETS,
    type Category, type TimeControlPreset,
  } from '../clock/categories';
  import { loadAllAnalyses, runAnalysis } from '../analysis/runAnalysis';
  import { buildWeaknessProfile, type Dimension } from '../analysis/weakness';
  import { selectOpening, nextBookMove, steeringNote, type OpeningEntry } from '../opening/openingBook';
  import AnalysisResult from './AnalysisResult.svelte';
  import type { GameAnalysis } from '../analysis/types';
  import { chess960Position, chess960PositionById } from '../variant/chess960';
  import ColorPicker from './ColorPicker.svelte';
  import { resolveColor, type ColorChoice } from '../game/color';
  import { applyGameResult, botMovetime, flagOutcome } from '../game/playSession';
  import { createGameSession, type GameSession } from '../game/gameSession';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { downloadPgn, pgnFilename } from './pgnDownload';
  import { t } from '../i18n';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  // The DOM-free controller (F6, ADR-0057) owns the move/engine/end loop + the rules-truth game.
  // Play keeps its $state mirrors (fen drives ADR-0051 reactivity; status/result/lastMove the view)
  // and reassigns `fen` from each returned snapshot. `game` points at the controller's ChessGame so
  // the view's `game.*` reads (dests/turn/inCheck/fenForEngine/history/pgn) are unchanged.
  let session = $state<GameSession | null>(null);
  let game = $state(new ChessGame());
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  let status = $state<'idle' | 'playing' | 'thinking' | 'over'>('idle');
  let result = $state('');
  let thinking = $state(false);
  // Set when the bot's move throws (worker crash / timeout): offer Retry instead of freezing the
  // game on the bot's turn (audit v2 P1-05).
  let engineError = $state(false);
  // Non-blocking coached take-back prompt (audit v2 W12/F5). While it's open the player's own clock
  // keeps running — fair, it's their decision time — and the opponent isn't charged (F6).
  let coachOpen = $state(false);
  let steerNote = $state('');
  let opponent: AdaptiveOpponent | null = null;
  let colorChoice = $state<ColorChoice>('white');
  let playerColor = $state<'white' | 'black'>('white');

  // Chess960 state (ADR-0041)
  let variant = $state<'standard' | 'chess960'>('standard');
  let sp960Input = $state(''); // optional SP-ID string; blank = random
  let startFen960 = $state<string | null>(null);
  let castle960 = $state<import('../game/ChessGame').Chess960CastleFiles | null>(null);

  // Time-control state. `clock` is null for the untimed ("No clock") path = today's behavior.
  let selectedTC = $state<TimeControlPreset>(TIME_CONTROL_PRESETS.find((p) => p.id === 'rapid-10-0')!);
  let clock = $state<ClockState | null>(null);
  let customInitialSec = $state(300);
  let customIncrementSec = $state(0);
  let rafId: number | null = null;
  let lastTs = 0;

  // The bot plays the side opposite to the player.
  const botSide = $derived<Side>(playerColor === 'white' ? 'b' : 'w');
  const playerSideClock = $derived<Side>(playerColor === 'white' ? 'w' : 'b');

  function initialSecOf(p: TimeControlPreset): number {
    return p.id === 'custom' ? customInitialSec : p.initialSec;
  }
  function incrementSecOf(p: TimeControlPreset): number {
    return p.id === 'custom' ? customIncrementSec : p.incrementSec;
  }

  const selectedPool = $derived<RatingPool>(
    selectedTC.untimed ? 'classical' : categoryFor(initialSecOf(selectedTC), incrementSecOf(selectedTC)),
  );
  /** The pool used for rating display and updates: chess960 for 960, selectedPool for standard. */
  const displayPool = $derived<RatingPool>(variant === 'chess960' ? 'chess960' : selectedPool);

  // One-click post-game analysis (ADR-0022): no PGN paste needed.
  let lastGame = $state<{ id: string; pgn: string; playedAt: number; result: 'win' | 'loss' | 'draw' } | null>(null);
  let aStatus = $state<'idle' | 'analyzing' | 'done'>('idle');
  let aResult = $state<GameAnalysis | null>(null);
  let aPuzzles = $state(0);
  let aProgress = $state(0);
  let aTotal = $state(0);

  // Loop closure: the bot (Black here) opens toward the player's weakest area. The played-UCI list
  // that book steering consults now lives in the controller (F6); `opening` stays here (view).
  let opening: OpeningEntry | null = null;
  // Guard against finishGame() running twice (onFlag + checkEnd race, audit W6).
  let gameFinished = false;

  const model = $derived(app.model);
  const coached = $derived(app.settings?.coachedMode ?? false);
  const opponentStyle = $derived(app.settings?.opponentStyle ?? 'human');
  const live = $derived(status === 'playing' || status === 'thinking');

  // Restore the last-used time control on mount (spec §4.5).
  $effect(() => {
    const last = app.settings?.lastTimeControl;
    if (!last) return;
    const match = TIME_CONTROL_PRESETS.find(
      (p) => !p.untimed && p.id !== 'custom' && p.initialSec === last.initialSec && p.incrementSec === last.incrementSec,
    );
    if (match) {
      selectedTC = match;
    } else {
      selectedTC = TIME_CONTROL_PRESETS.find((p) => p.id === 'custom')!;
      customInitialSec = last.initialSec;
      customIncrementSec = last.incrementSec;
    }
  });

  async function setOpponentStyle(s: 'human' | 'engine') {
    if (app.settings) {
      app.settings.opponentStyle = s;
      await app.persistSettings();
    }
  }

  async function newGame() {
    if (!model) return;
    // Chess960 stays White (no opening theory / color choice — ADR-0041/0047).
    playerColor = variant === 'chess960' ? 'white' : resolveColor(colorChoice);
    result = '';
    lastGame = null;
    aResult = null;
    aStatus = 'idle';
    aPuzzles = 0;
    startFen960 = null;
    castle960 = null;
    lastMove = null;
    gameFinished = false;
    coachOpen = false;
    engineError = false;

    if (variant === 'chess960') {
      // Distinguish an invalid entry from a deliberate 0: NaN → random, not silently SP 0 (audit W6).
      const raw = sp960Input.trim();
      let id: number | null = null;
      if (raw !== '') {
        const n = Number(raw);
        id = Number.isFinite(n) ? Math.max(0, Math.min(959, Math.floor(n))) : null;
      }
      const pos = id === null ? chess960Position(Math.random()) : chess960PositionById(id);
      startFen960 = pos.startFen;
      castle960 = pos.castle;
      sp960Input = String(pos.id); // reflect the chosen id back to the field
      opening = null; // no opening book / steering for 960 (no theory)
      app.steerDimension = null; // discard any pending steer so it doesn't leak to a later standard game (M-1)
      steerNote = t('play.chess960Steer', { id: pos.id });
    } else {
      // Read the weakness profile (from analysed games) and steer the opening.
      let weakest: Dimension | null = null;
      try {
        const analyses = await loadAllAnalyses();
        if (analyses.length) weakest = buildWeaknessProfile(analyses, poolRating(model, selectedPool).rating).weakest;
      } catch {
        /* no analyses yet → neutral variety */
      }
      let weakestDim = weakest;
      if (app.steerDimension) { weakestDim = app.steerDimension; app.steerDimension = null; }
      opening = selectOpening(playerColor === 'white' ? 'b' : 'w', weakestDim, Math.random());
      steerNote = steeringNote(opening, weakestDim);
    }

    // Seed the bot from the active pool's adaptive state.
    // 960 uses the chess960 pool (lazy seed from classical); standard uses selectedPool (AP-TC-3).
    const activePool: RatingPool = variant === 'chess960' ? 'chess960' : selectedPool;
    const state = initOpponentState(poolOpponent(model, activePool).targetElo);
    opponent = new AdaptiveOpponent(app.engine, state, variant === 'chess960');

    // Chess960 is always untimed (Q-C); standard respects the selected time control.
    if (variant === 'chess960' || selectedTC.untimed) {
      clock = null;
    } else {
      clock = startClock(initClock(initialSecOf(selectedTC) * 1000, incrementSecOf(selectedTC) * 1000, 'w'));
    }

    // Construct the shared controller (F6). It owns the loop + the rules-truth game; Play turns ON
    // exactly the capabilities it uses today so behaviour is unchanged: humanMove per opponentStyle,
    // retry, book steering (standard only), a clock-aware movetime budget, and 960 X-FEN feeding.
    // Defaults (siblings: pickMove/500/no-retry) are not engaged here.
    const opp = opponent;
    session = createGameSession({
      startFen: variant === 'chess960' ? (startFen960 ?? START_FEN) : START_FEN,
      playerSide: playerColor,
      // Port: picks via the adaptive opponent; interrupt via the engine client (Play's original
      // retry interrupts app.engine, then re-asks the opponent — preserved exactly).
      engine: {
        pickMove: (f, mt) => opp.pickMove(f, mt),
        pickHumanMove: (f, mt) => opp.pickHumanMove(f, mt),
        interrupt: () => app.engine.interrupt(),
      },
      variant,
      castle: castle960,
      config: {
        humanMove: opponentStyle !== 'engine',
        retry: true,
        bookMove: (played) => (opening ? nextBookMove(opening, played) : null),
        // Clock-aware budget from the BOT's own remaining time (AP-TC-4); untimed/960 → null so the
        // controller uses pickHumanMove's 300ms default / pickMove's 500ms, exactly as today.
        movetime: (g, side) =>
          clock
            ? botMovetime(side === 'w' ? clock.whiteMs : clock.blackMs, g.history().length, selectedPool as Category)
            : null,
        engineFen: (g) => (variant === 'chess960' ? g.fenForEngine() : g.fen),
      },
    });
    game = session.gameRef; // view reads (dests/turn/inCheck/fenForEngine/history/pgn) hit the same instance
    fen = session.fen;

    // Persist the chosen time control for next time (skip for untimed and 960).
    if (variant !== 'chess960' && !selectedTC.untimed && app.settings) {
      app.settings.lastTimeControl = { initialSec: initialSecOf(selectedTC), incrementSec: incrementSecOf(selectedTC) };
      await app.persistSettings();
    }

    status = 'thinking';
    try {
      await opponent.applyStrength(); // sets UCI_Chess960 = (variant==='chess960') on boot
      status = 'playing';
      startClockLoop();
      // If the player is Black, the engine (White) makes the first move.
      if (turnColor() !== playerColor) await engineMove();
    } catch (e) {
      result = t('play.engineFailedStart') + String(e);
      status = 'idle';
    }
  }

  // ---- Clock loop (the ONLY place time is read; Clock.ts stays Date-free, AP-TC-1) ----

  /** Start the rAF tick loop. Runs while the game is live (playing OR thinking) so the
   *  bot's clock keeps decrementing during its turn and the bot can flag (AP-TC-4). */
  function startClockLoop() {
    if (!clock || rafId !== null) return;
    lastTs = performance.now();
    const step = () => {
      if (!clock || !live) {
        rafId = null;
        return;
      }
      const now = performance.now();
      const elapsed = now - lastTs;
      lastTs = now;
      clock = tick(clock, elapsed);
      const flag = flagged(clock);
      if (flag) {
        rafId = null;
        clock = stopClock(clock);
        void onFlag(flag);
        return;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function stopClockLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  onDestroy(stopClockLoop);

  /** A side flagged: game over. FIDE Art. 6.9 — if the OTHER side cannot mate, it's a draw
   *  (Q-C); otherwise the side that flagged loses. */
  async function onFlag(flaggedSide: Side) {
    stopClockLoop();
    // Sync the controller's status so an in-flight engineReply drops its late move on a bot flag,
    // exactly as the resign-during-think guard does (P1-14 family).
    session?.markOver();
    status = 'over';
    const { outcome, draw } = flagOutcome(flaggedSide, playerSideClock, game.fen);
    result = draw
      ? t('play.flagDraw')
      : flaggedSide === playerSideClock
        ? t('play.flagYouLost')
        : t('play.flagYouWin');
    await finishGame(outcome);
  }

  function turnColor(): 'white' | 'black' {
    return game.turn === 'w' ? 'white' : 'black';
  }

  // In-check king highlight: `game` is mutated in place each move and Svelte 5 doesn't proxy the
  // ChessGame instance, so a bare `game.inCheck()` binding never re-fires (movableColor/dests are
  // saved only by their co-dependency on the toggling `status`). Depend on the reactive `fen`
  // (reassigned every move) so the highlight refreshes mid-game. ADR-0051. The controller exposes
  // `inCheckFor(fen)`; the $derived stays here, anchored on the reactive `fen`.
  const inCheck = $derived(fen && session ? session.inCheckFor(fen) : false);

  async function onMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!session || status !== 'playing' || turnColor() !== playerColor) return;
    // Controller validates turn + legality and advances the board (no auto-chain — C1-1).
    const snap = session.applyPlayerMove(from, to, promo);
    if (!snap) return;
    fen = snap.fen;
    lastMove = snap.lastMove;

    // Coached mode: shallow-eval the move BEFORE pressing the clock to the opponent. If it looks
    // like a blunder, pause on a non-blocking dialog — the player's own clock keeps running while
    // they decide, and the opponent isn't charged for the deliberation (audit v2 W12/F5+F6).
    if (coached && (await coachEvalBad())) {
      coachOpen = true;
      return;
    }
    await commitPlayerMove();
  }

  /** Finalize the player's move: press the clock to the opponent, then end-check / engine reply.
   *  This interposition (coached gate above + clock press here) is exactly why the controller does
   *  NOT auto-chain applyPlayerMove → engineReply (Q-G / C1-1). */
  async function commitPlayerMove() {
    if (clock) clock = press(clock, playerSideClock);
    if (checkEnd()) return;
    await engineMove();
  }

  /** Coached take-back (non-blocking): undo the move; the player stays on move, on their own clock. */
  function coachTakeBack() {
    coachOpen = false;
    if (!session) return;
    const snap = session.undoPlayerMove();
    fen = snap.fen;
    lastMove = snap.lastMove;
  }

  /** Coached keep: dismiss the warning and play on. */
  function coachKeep() {
    coachOpen = false;
    void commitPlayerMove();
  }

  /** Quick shallow eval (coached mode, best-effort): true if the move looks like a blunder. Does
   *  NOT block or touch the clock — onMove decides what to do with the verdict (audit v2 W12). */
  async function coachEvalBad(): Promise<boolean> {
    try {
      const evalRes = await app.engine.evaluate(
        variant === 'chess960' ? game.fenForEngine() : game.fen,
        { depth: 8, fullStrength: true },
      );
      const cp = evalRes.whiteCp;
      return playerColor === 'white' ? cp < -250 : cp > 250;
    } catch {
      return false; // an eval failure must never block play
    }
  }

  /** The bot's reply, via the controller. The controller owns the book/budget/style branch and both
   *  guards (P1-14 resign-during-think, P1-17 illegal-move halt); Play keeps the clock press, the
   *  `thinking` flag, the result strings (AP-CTRL-1), and the end-check side effects. */
  async function engineMove() {
    if (!session || !opponent) return;
    status = 'thinking';
    thinking = true;
    engineError = false;
    applyEngineReply(await session.engineReply());
  }

  /** Apply a controller engine-reply snapshot to Play's view + clock (shared by engineMove/retry).
   *  Reproduces the inline loop's tail: error → Retry; illegal → halt; resign-mid-think → leave as
   *  resign() set it; else press the clock for a real bot move and run the end-check side effects. */
  function applyEngineReply(snap: import('../game/gameSession').SessionSnapshot) {
    if (!session) return;
    fen = snap.fen;
    lastMove = snap.lastMove;
    status = session.status;
    thinking = false;
    if (session.engineError) {
      // The bot's move threw (worker crash / timeout). Don't fall back to 'playing' on the bot's
      // turn — that strands the game on a frozen board. Offer an explicit Retry (audit v2 P1-05).
      result = t('play.engineError');
      engineError = true;
      return;
    }
    if (session.illegalHalt) {
      // Engine returned a move the rules layer rejected (desync/illegal). Halt rather than advance
      // a phantom move and corrupt the board/last-move (audit W6, P1-17).
      result = t('play.engineIllegal');
      stopClockLoop();
      if (clock) clock = stopClock(clock);
      return;
    }
    if ((status as string) === 'over') return; // P1-14: resign landed mid-think; resign() set result/clock
    if (session.movePlayed && clock) clock = press(clock, botSide);
    // Run the end-check side effects (result string + fold/persist); the controller already set
    // status to 'over'/'playing' but Play owns those side effects (AP-CTRL-9).
    if (!checkEnd()) status = 'playing';
  }

  /** Recover from a bot-move engine error: drop any stuck search and try the move again (P1-05).
   *  Mirrors the original orchestration exactly: interrupt the engine, then re-run engineMove (which
   *  re-sets status/thinking), so the thinking-indicator timing during recovery is unchanged. */
  async function retryEngineMove() {
    if (!session) return;
    engineError = false;
    result = '';
    await session.interruptEngine();
    await engineMove();
  }

  function checkEnd(): boolean {
    // Pure, idempotent terminal query from the controller (AP-CTRL-1/9); Play owns the result
    // string mapping + the fold/persist side effects behind its `gameFinished` guard.
    const term = session?.checkTerminal() ?? { over: false };
    if (!term.over) return false;
    status = 'over';
    stopClockLoop();
    if (clock) clock = stopClock(clock);
    const outcome: GameOutcome = term.outcome ?? 'draw';
    if (term.reason === 'checkmate') {
      result = outcome === 'win' ? t('play.checkmateWin') : t('play.checkmateLost');
    } else {
      result = t('play.drawReason', { reason: term.reason ?? '' });
    }
    void finishGame(outcome);
    return true;
  }

  async function finishGame(outcome: GameOutcome) {
    if (gameFinished) return; // idempotent: onFlag and checkEnd can both fire (audit W6)
    gameFinished = true;
    const m = model;
    const opp = opponent;
    if (!m || !opp) return;
    const botElo = opp.state.targetElo;

    if (variant === 'chess960') {
      // Update the chess960 pool — seeded lazily on the first 960 game from classical (AP-960-7).
      const seed = m.gameRatings.chess960 ?? m.gameRatings.classical ?? poolRating(m, 'classical');
      const { nextOpp, nextRating } = applyGameResult(seed, poolOpponent(m, 'chess960'), outcome, botElo);
      m.opponentByPool.chess960 = nextOpp;
      opp.state = nextOpp;
      await opp.applyStrength().catch(() => {});
      m.gameRatings.chess960 = nextRating;
    } else {
      // Standard path: adjust the SELECTED pool's adaptive bot toward the 55% band (AP-TC-3).
      const pool = selectedPool;
      const { nextOpp, nextRating } = applyGameResult(poolRating(m, pool), poolOpponent(m, pool), outcome, botElo);
      m.opponentByPool[pool] = nextOpp;
      opp.state = nextOpp;
      await opp.applyStrength().catch(() => {});
      m.gameRatings[pool] = nextRating;
    }

    const now = Date.now();
    const rec: GameRecord = {
      id: `g:${now}`,
      pgn: game.pgn(),
      result: outcome,
      botElo,
      playedAt: now,
      coached,
      playerColor: playerColor[0] as 'w' | 'b', // F5: persist side for correct history re-analysis
      ...(variant === 'chess960'
        ? { variant: 'chess960', startFen: startFen960 ?? undefined }
        : {
            timeControl: selectedTC.untimed
              ? { initialSec: 0, incrementSec: 0, category: 'classical', untimed: true }
              : {
                  initialSec: initialSecOf(selectedTC),
                  incrementSec: incrementSecOf(selectedTC),
                  category: categoryFor(initialSecOf(selectedTC), incrementSecOf(selectedTC)),
                },
          }),
    };
    await putGame(rec);
    lastGame = { id: rec.id, pgn: rec.pgn, playedAt: rec.playedAt, result: rec.result };
    await app.persistModel(now);
  }

  /** One-click analysis of the game just played — same pipeline as Import, no paste. */
  async function analyzePlayed() {
    if (!lastGame || !model) return;
    aStatus = 'analyzing';
    aProgress = 0;
    try {
      const existing = await getAnalysis(lastGame.id);
      if (existing) {
        aResult = existing;
        aPuzzles = 0;
        aStatus = 'done';
        return;
      }
      // Analysis forces full strength per call (the fullStrength flag, audit v2 W1/F4); here we
      // only clear 960 mode so analysis never runs in 960 (AP-960-4). resetVariant boots if needed.
      await app.engine.resetVariant();

      const res = await runAnalysis(app.engine, app.puzzles, {
        gameId: lastGame.id,
        pgn: lastGame.pgn,
        playerColor: playerColor[0] as 'w' | 'b',
        source: 'played',
        baseRating: Math.round(model.puzzleRating.rating),
        now: Date.now(),
        movetimeMs: 200,
        onProgress: (d, t) => {
          aProgress = d;
          aTotal = t;
        },
      });
      aResult = res.analysis;
      aPuzzles = res.puzzles.length;
      aStatus = 'done';
    } catch (e) {
      result = t('play.analysisFailed') + String(e);
      aStatus = 'idle';
    }
  }

  function resign() {
    if (status === 'playing' || status === 'thinking') {
      // Tell the controller first so any in-flight engineReply sees status 'over' and drops its late
      // move (P1-14 resign-during-think guard); then run Play's view + clock side effects.
      session?.resign();
      status = 'over';
      stopClockLoop();
      if (clock) clock = stopClock(clock);
      result = t('play.youResigned');
      void finishGame('loss');
    }
  }
</script>

<section class="col center">
  <h2>{t('play.title')}</h2>
  {#if model}
    <p class="muted">
      {t('play.ratingLine', { pool: displayPool, rating: Math.round(poolRating(model, displayPool).rating), elo: poolOpponent(model, displayPool).targetElo })}
      {#if coached}· <span style="color:var(--accent)">{t('play.coachedOn')}</span>{/if}
    </p>
  {/if}

  <div class="row center" style="gap:1rem;flex-wrap:wrap">
    <label class="muted" style="font-size:0.85rem">
      {t('play.opponentLabel')}
      <select value={opponentStyle} onchange={(e) => setOpponentStyle(e.currentTarget.value === 'engine' ? 'engine' : 'human')}>
        <option value="human">{t('play.opponentHuman')}</option>
        <option value="engine">{t('play.opponentEngine')}</option>
      </select>
    </label>

    <label class="muted" style="font-size:0.85rem">
      {t('play.modeLabel')}
      <select value={variant} disabled={live}
              onchange={(e) => (variant = e.currentTarget.value === 'chess960' ? 'chess960' : 'standard')}>
        <option value="standard">{t('play.modeStandard')}</option>
        <option value="chess960">{t('play.modeChess960')}</option>
      </select>
    </label>

    {#if variant !== 'chess960'}
      <ColorPicker bind:value={colorChoice} disabled={live} />
    {/if}

    {#if variant === 'chess960'}
      <label class="muted" style="font-size:0.85rem">
        {t('play.startLabel')}
        <input type="number" min="0" max="959" placeholder={t('play.startPlaceholder')} bind:value={sp960Input}
               disabled={live} style="width:6rem" />
      </label>
    {/if}

    {#if variant !== 'chess960'}
      <label class="muted" style="font-size:0.85rem">
        {t('play.timeLabel')}
        <select
          value={selectedTC.id}
          disabled={live}
          onchange={(e) => { selectedTC = TIME_CONTROL_PRESETS.find((p) => p.id === e.currentTarget.value) ?? selectedTC; }}
        >
          {#each TIME_CONTROL_PRESETS as p (p.id)}
            <option value={p.id}>{p.label}</option>
          {/each}
        </select>
      </label>

      {#if selectedTC.id === 'custom'}
        <label class="muted" style="font-size:0.85rem">
          {t('play.customMin')} <input type="number" min="0" style="width:3.5rem" disabled={live}
            oninput={(e) => { customInitialSec = Math.max(0, Number(e.currentTarget.value) * 60); }}
            value={customInitialSec / 60} />
        </label>
        <label class="muted" style="font-size:0.85rem">
          {t('play.customInc')} <input type="number" min="0" style="width:3.5rem" bind:value={customIncrementSec} disabled={live} />
        </label>
      {/if}
    {/if}
  </div>

  {#if clock}
    <div class="clocks">
      <div class="clock {clock.side === botSide ? 'active' : ''}">{fmtClock(botSide === 'w' ? clock.whiteMs : clock.blackMs)}</div>
      <div class="clock {clock.side === playerSideClock ? 'active' : ''}">{fmtClock(playerSideClock === 'w' ? clock.whiteMs : clock.blackMs)}</div>
    </div>
  {/if}

  {#if variant !== 'chess960'}
    <p class="muted" style="font-size:0.82rem">{playerColor === 'white' ? t('play.youPlayWhite') : t('play.youPlayBlack')}</p>
  {/if}

  <div class="board-wrap">
    <Board
      {fen}
      orientation={playerColor}
      turnColor={turnColor()}
      movableColor={status === 'playing' && turnColor() === playerColor ? playerColor : undefined}
      dests={status === 'playing' && turnColor() === playerColor ? game.dests() : new Map()}
      {lastMove}
      check={inCheck}
      {onMove}
      onMoveText={(t) => {
        if (status !== 'playing' || turnColor() !== playerColor) return false;
        const r = game.resolveMove(t);
        if (!r) return false;
        void onMove(r.from, r.to, r.promo ?? 'q');
        return true;
      }}
    />
  </div>

  <p class="feedback {status === 'over' ? 'good' : ''}">
    {#if thinking}{t('play.botThinking')}{:else}{result}{/if}
  </p>

  {#if steerNote && status !== 'idle'}
    <p class="muted" style="font-size:0.82rem">{steerNote}</p>
  {/if}

  <div class="row center">
    {#if engineError}
      <button onclick={retryEngineMove}>{t('play.retryBotMove')}</button>
    {/if}
    {#if status === 'idle' || status === 'over'}
      <button onclick={newGame}>{t('play.newGame')}</button>
    {:else}
      <button onclick={resign} style="background:var(--bad)">{t('play.resign')}</button>
    {/if}
    {#if status === 'over' && lastGame && variant !== 'chess960'}
      <button class="ghost" onclick={analyzePlayed} disabled={aStatus === 'analyzing'}>
        {aStatus === 'analyzing' ? t('play.analysing') : aResult ? t('play.reanalyse') : t('play.analyseThisGame')}
      </button>
    {/if}
    {#if status === 'over' && lastGame}
      <button class="ghost" onclick={() => lastGame && downloadPgn(lastGame.pgn, pgnFilename(lastGame.playedAt, lastGame.result))}>
        {t('play.exportPgn')}
      </button>
    {/if}
  </div>
  {#if status === 'over' && variant === 'chess960'}
    <p class="muted" style="font-size:0.8rem; max-width:440px">
      {t('play.chess960NoAnalysis')}
    </p>
  {/if}

  {#if aStatus === 'analyzing'}
    <div class="panel" style="max-width:420px">
      <p>{t('play.analysingPosition', { progress: aProgress, total: aTotal })}</p>
      <div class="bar"><div class="bar-fill" style="width:{aTotal ? (aProgress / aTotal) * 100 : 0}%"></div></div>
    </div>
  {/if}

  {#if aResult}
    <div class="panel col" style="max-width:680px;width:100%">
      <AnalysisResult analysis={aResult} puzzlesMade={aPuzzles} />
    </div>
  {/if}

  <p class="muted" style="font-size:0.8rem; max-width:440px">
    {@html t('play.tip')}
  </p>

  <ConfirmDialog
    open={coachOpen && status === 'playing'}
    title={t('play.coachTitle')}
    body={t('play.coachBody')}
    confirmLabel={t('play.coachTakeBack')}
    cancelLabel={t('play.coachKeep')}
    onConfirm={coachTakeBack}
    onCancel={coachKeep}
  />
</section>

<style>
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .bar { height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
  .bar-fill { height: 100%; background: var(--accent); transition: width 0.1s linear; }
  .clocks { display: flex; flex-direction: column; gap: 0.3rem; align-items: center; margin: 0.4rem 0; }
  .clock { font-variant-numeric: tabular-nums; font-size: 1.6rem; font-weight: 700; padding: 0.1rem 0.8rem; border-radius: 6px; background: var(--panel-2); color: var(--text); min-width: 5rem; text-align: center; }
  .clock.active { background: var(--accent); color: #000; }
</style>
