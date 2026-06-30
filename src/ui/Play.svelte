<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { AdaptiveOpponent, initOpponentState, type GameOutcome } from '../engine/AdaptiveOpponent';
  import type { GameRecord } from '../store/db';
  import { putGame, getAllGames, getAnalyzedGameIds } from '../store/gamesRepo';
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
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { analyzeOnePlayedGame, analyzeBacklog } from '../analysis/analyzeBacklog';
  import { unanalyzedPlayedGames } from '../analysis/unanalyzedGames';
  import { buildWeaknessProfile, type Dimension } from '../analysis/weakness';
  import { selectOpening, nextBookMove, steeringNote, type OpeningEntry } from '../opening/openingBook';
  import AnalysisResult from './AnalysisResult.svelte';
  import type { GameAnalysis } from '../analysis/types';
  import { chess960Position, chess960PositionById } from '../variant/chess960';
  import ColorPicker from './ColorPicker.svelte';
  import { resolveColor, type ColorChoice } from '../game/color';
  import { applyGameResult, botMovetime, flagOutcome, shouldRate, canTakeBackInPlay } from '../game/playSession';
  import {
    difficultyTargetElo, decideResign, decideAcceptDraw, resignThreshold, coachedBlunderThreshold,
    adaptationDirection, gameAdaptsPool, DRAW_CP, type DifficultyMode,
  } from '../engine/opponentAgency';
  import { toMovePairs } from '../game/moveList';
  import { createGameSession, type GameSession } from '../game/gameSession';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { downloadPgn, pgnFilename } from './pgnDownload';
  import { t, tn } from '../i18n';

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
  // P2 (play-in-game-ux): confirm-before-resign gate, on-demand blunder-check verdict, and the
  // un-rated marker set when the player uses an in-play takeback (ADR-0058). All additive UI state.
  let resignOpen = $state(false);
  let unrated = $state(false);
  let checkVerdict = $state<'risky' | 'fine' | null>(null);
  // The FEN a check verdict was computed for, so a verdict maps to the current position only and a
  // second click on the same position is a no-op (one check per position — AP-PLAYUX-5).
  let checkedFen = $state<string | null>(null);
  // The move-list scroll container, so a tiny $effect can auto-follow the latest ply into view.
  let moveListEl = $state<HTMLDivElement | undefined>(undefined);
  let steerNote = $state('');
  let opponent: AdaptiveOpponent | null = null;
  let colorChoice = $state<ColorChoice>('white');
  let playerColor = $state<'white' | 'black'>('white');

  // P3 (play-opponent-agency): difficulty control + bot resign/draw + adaptation feedback.
  // Local state restored on mount from settings + persisted in the handlers (mirrors selectedTC).
  // `difficultyMode` defaults to 'adaptive' = today's behaviour (zero regression — AP-OPPAGENCY-1).
  let difficultyMode = $state<DifficultyMode>('adaptive');
  // The explicit Elo for the Fixed mode; seeded from the current pool Elo when Fixed is first
  // selected so the input is never blank/NaN (E4). null until seeded/restored.
  let fixedElo = $state<number | null>(null);
  // Consecutive bot-decision plies the position has been decisively lost / dead-equal (resign/draw
  // counters, AP-OPPAGENCY-2/4). Reset each newGame and on a thrown agency eval (E3).
  let consecutiveLostPlies = 0;
  let consecutiveEqualPlies = 0;
  // A live player draw-offer awaiting the bot's next decision (E2). Cleared on accept/decline/newGame.
  let drawOffered = $state(false);
  // Post-game adaptation line (Q-D), adaptive games only; '' (suppressed) for override games.
  let adaptLine = $state('');

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
  // The full stored record of the just-finished game — fed to the shared analysis core for the
  // single-game button + the opt-in auto-run (P1, play-loop-closure §4.6). Its playerColor is in
  // scope at write so no provenance issue (AP-PLAYLOOP-12).
  let lastGameRec = $state<GameRecord | null>(null);
  let aStatus = $state<'idle' | 'analyzing' | 'done'>('idle');
  let aResult = $state<GameAnalysis | null>(null);
  let aPuzzles = $state(0);
  let aProgress = $state(0);
  let aTotal = $state(0);
  // Quiet "analysed ✓" shown when the opt-in auto-run succeeds (no toast clutter; F-P1-2).
  let autoAnalyzed = $state(false);
  // P2 (FOLD A4): a generation token bumped on every newGame()/rematch(). An in-flight analysis
  // promise reads its token at start and discards its result if a new game began meanwhile, so a
  // stale `runAnalysis` can't write `aResult` over a fresh game started via Rematch (AP-PLAYUX-10).
  let analyzeGen = 0;

  // Loop closure (P1): the unanalysed-backlog count, derived from the persisted stores (F5 reads)
  // so it survives navigation — NOT a transient field (AP-PLAYLOOP-1). Exactly
  // unanalyzedPlayedGames(...).length, so the count never overstates what the batch runs
  // (AP-PLAYLOOP-13). Recomputed on mount, after finishGame, and after a batch run.
  let backlogN = $state(0);
  let backlogGames = $state<GameRecord[]>([]);
  let batchCancelled = $state(false);
  let batchRunning = $state(false); // true only during a multi-game batch (drives the cancel UI)

  // Loop closure: the bot (Black here) opens toward the player's weakest area. The played-UCI list
  // that book steering consults now lives in the controller (F6); `opening` stays here (view).
  let opening: OpeningEntry | null = null;
  // Guard against finishGame() running twice (onFlag + checkEnd race, audit W6).
  let gameFinished = false;

  const model = $derived(app.model);
  const coached = $derived(app.settings?.coachedMode ?? false);
  const opponentStyle = $derived(app.settings?.opponentStyle ?? 'human');
  const autoAnalyzeOnFinish = $derived(app.settings?.autoAnalyzeOnFinish ?? false);
  // P2: opt-in on-demand takeback during a normal game (default OFF → today's behaviour unchanged).
  const takebackEnabled = $derived(app.settings?.takebackInPlay ?? false);
  const live = $derived(status === 'playing' || status === 'thinking');

  // P3: the pool's adaptive bot Elo (what `ratingLine` shows today) and the EFFECTIVE bot Elo under
  // the active difficulty (what's actually applied). Adaptive → identical, so the line is
  // byte-identical; an override shows the effective value + a mode tag so the line never lies (E1,
  // AP-OPPAGENCY-14). `?? fixedElo ?? adaptive` keeps the Fixed display honest before a game starts.
  const adaptiveBotElo = $derived(model ? poolOpponent(model, displayPool).targetElo : 1500);
  const effectiveBotElo = $derived(difficultyTargetElo(difficultyMode, adaptiveBotElo, fixedElo ?? adaptiveBotElo));
  const difficultyTag = $derived(
    difficultyMode === 'easier' ? t('play.difficultyTagEasier')
    : difficultyMode === 'harder' ? t('play.difficultyTagHarder')
    : difficultyMode === 'fixed' ? t('play.difficultyTagFixed')
    : '',
  );
  // Offering a draw is only meaningful on the player's live turn (mirrors the takeback/check gates).
  const canOfferDraw = $derived(status === 'playing' && turnColor() === playerColor && !coachOpen && !thinking && !drawOffered);

  // Recompute the unanalysed-backlog count from the persisted stores (F5 reads). Pure selector on
  // top — excludes 960 + color-less legacy records so the count == what the batch will run.
  async function refreshBacklog() {
    try {
      const [games, analyzed] = await Promise.all([getAllGames(), getAnalyzedGameIds()]);
      backlogGames = unanalyzedPlayedGames(games, analyzed);
      backlogN = backlogGames.length;
    } catch {
      /* storage unavailable — leave the backlog at its last value */
    }
  }

  // Surface the backlog when the view mounts (durable re-entry after navigation).
  $effect(() => {
    void refreshBacklog();
  });

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

  // P3: restore the persisted difficulty mode + fixed Elo on mount (mirrors lastTimeControl). Absent
  // reads as 'adaptive' (zero regression); a stored fixedElo is restored for the Fixed input.
  $effect(() => {
    const s = app.settings;
    if (!s) return;
    if (s.difficultyMode) difficultyMode = s.difficultyMode;
    if (typeof s.fixedElo === 'number') fixedElo = s.fixedElo;
  });

  async function setOpponentStyle(s: 'human' | 'engine') {
    if (app.settings) {
      app.settings.opponentStyle = s;
      await app.persistSettings();
    }
  }

  /** P3: change the difficulty mode. When Fixed is first chosen, seed the Elo input from the current
   *  pool/adaptive Elo so it's never blank/NaN (E4). Persisted like opponentStyle (additive optional,
   *  no DB_VERSION bump). */
  async function setDifficultyMode(m: DifficultyMode) {
    difficultyMode = m;
    if (m === 'fixed' && fixedElo == null) fixedElo = adaptiveBotElo;
    if (app.settings) {
      app.settings.difficultyMode = m;
      if (fixedElo != null) app.settings.fixedElo = fixedElo;
      await app.persistSettings();
    }
  }

  /** P3: the Fixed-Elo input changed. Keep a sane number (the bot Elo is clamped to [1320,3190] at
   *  apply time via difficultyTargetElo) and persist it. */
  async function setFixedElo(v: number) {
    if (!Number.isFinite(v)) return;
    fixedElo = Math.round(v);
    if (app.settings) {
      app.settings.fixedElo = fixedElo;
      await app.persistSettings();
    }
  }

  async function newGame() {
    if (!model) return;
    // Chess960 stays White (no opening theory / color choice — ADR-0041/0047).
    playerColor = variant === 'chess960' ? 'white' : resolveColor(colorChoice);
    result = '';
    lastGame = null;
    lastGameRec = null;
    autoAnalyzed = false;
    aResult = null;
    aStatus = 'idle';
    aPuzzles = 0;
    // Invalidate any in-flight analysis so its late result can't write over this fresh game (P2).
    analyzeGen++;
    startFen960 = null;
    castle960 = null;
    lastMove = null;
    gameFinished = false;
    coachOpen = false;
    engineError = false;
    // P2 resets: a fresh game is rated again, the resign dialog is closed, and any prior move-check
    // verdict is cleared (the rematch path call-throughs here, so this resets the rematch too).
    unrated = false;
    resignOpen = false;
    checkVerdict = null;
    checkedFen = null;
    // P3 resets: clear the resign/draw counters, any pending draw offer, and last game's adaptation
    // line so a new game starts clean (AP-OPPAGENCY-2/4; rematch flows through here too).
    consecutiveLostPlies = 0;
    consecutiveEqualPlies = 0;
    drawOffered = false;
    adaptLine = '';

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
    const adaptiveSeed = poolOpponent(model, activePool).targetElo;
    // P3 (A2): apply the chosen difficulty to the bot's target Elo BEFORE applyStrength(). Adaptive
    // reproduces today exactly (difficultyTargetElo('adaptive',…) === clampElo(adaptiveSeed)); an
    // override offsets/overrides it. Fixed uses the seeded fixedElo (clamped inside the helper).
    const state = initOpponentState(difficultyTargetElo(difficultyMode, adaptiveSeed, fixedElo ?? adaptiveSeed));
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
        // controller uses pickHumanMove's 300ms default / pickMove's 500ms, exactly as today. P3/Q-F:
        // fold the clock increment into the budget (a real opponent uses its increment).
        movetime: (g, side) =>
          clock
            ? botMovetime(
                side === 'w' ? clock.whiteMs : clock.blackMs,
                g.history().length,
                selectedPool as Category,
                undefined,
                incrementSecOf(selectedTC) * 1000,
              )
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

  // ── P2 move list (PL3, Q-A=a) ──
  // SAN history, re-derived on every move via the reactive `fen` (same ADR-0051 dependency `inCheck`
  // uses; `game` is mutated in place and is not deep-proxied). Play stores UCI in the controller, so
  // the list reads SAN from `game.history()` — the single numbering authority is `toMovePairs`, never
  // a parallel list from playedUci (AP-PLAYUX-1).
  const moveSan = $derived(fen && session ? game.history() : []);
  // Start side / move number for correct numbering of a Black-first or loaded mid-game start. Play's
  // standard + 960 starts are both White-to-move at move 1, but derive from the start FEN so the
  // formatter stays honest (mirrors ChessGame.pgn()'s body builder).
  const startFenForList = $derived(variant === 'chess960' ? (startFen960 ?? START_FEN) : START_FEN);
  const startSide = $derived<'w' | 'b'>(startFenForList.split(' ')[1] === 'b' ? 'b' : 'w');
  const startMoveNo = $derived(Number(startFenForList.split(' ')[5] || '1'));
  const movePairs = $derived(toMovePairs(moveSan, startSide, startMoveNo));
  // The latest played ply index (for the highlight); -1 before the first move.
  const latestPly = $derived(moveSan.length - 1);

  // ── P2 takeback gating (PL7, Q-B=a) ──
  // The pure half (`canTakeBackInPlay`: the player has actually moved) ANDed with the live/turn gates
  // and the in-flight-analysis guard. Disabled during analysis so a stale result can't land on a
  // post-undo position; never available on the bot's turn / while thinking / coached dialog open.
  const canTakeBack = $derived(
    takebackEnabled &&
      status === 'playing' &&
      turnColor() === playerColor &&
      !coachOpen &&
      !thinking &&
      aStatus !== 'analyzing' &&
      !!session &&
      canTakeBackInPlay(moveSan.length, playerColor),
  );
  // The on-demand blunder check is offered on the player's turn while the game is live.
  const canCheckMove = $derived(status === 'playing' && turnColor() === playerColor && !coachOpen && !thinking);

  // Auto-follow the latest ply: keyed on the move count so it scrolls the newest row into view as the
  // game progresses (and when reading back after it ends). `block:'nearest'` avoids jumping the page.
  $effect(() => {
    void moveSan.length; // dependency: re-run on every new ply
    const last = moveListEl?.lastElementChild as HTMLElement | null;
    last?.scrollIntoView({ block: 'nearest' });
  });

  async function onMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!session || status !== 'playing' || turnColor() !== playerColor) return;
    // A new move invalidates any prior on-demand blunder-check verdict (P2, AP-PLAYUX-5).
    checkVerdict = null;
    checkedFen = null;
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
   *  NOT block or touch the clock — onMove decides what to do with the verdict (audit v2 W12). P3/Q-G:
   *  the blunder gate scales with the active bot Elo (coachedBlunderThreshold) — a tighter gate vs a
   *  stronger chosen opponent, looser vs a weaker one; ≈ the legacy 250 at a typical pool Elo. */
  async function coachEvalBad(): Promise<boolean> {
    try {
      const evalRes = await app.engine.evaluate(
        variant === 'chess960' ? game.fenForEngine() : game.fen,
        { depth: 8, fullStrength: true },
      );
      const cp = evalRes.whiteCp;
      const gate = coachedBlunderThreshold(opponent?.state.targetElo ?? effectiveBotElo);
      return playerColor === 'white' ? cp < -gate : cp > gate;
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
    // P3 (A3): after a real bot move that did NOT end the game, run ONE full-strength eval and decide
    // resign / accept-draw. This runs in the caller-orchestrated engineReply path, NOT by fusing
    // applyPlayerMove→engineReply (AP-OPPAGENCY-9). Skipped on error/illegal-halt/terminal so a
    // finished or stranded game never triggers a concession.
    // (status as string): applyEngineReply mutates `status` opaquely to TS's control-flow analysis,
    // which still sees the 'thinking' set above — the cast matches the existing P1-14 guard idiom.
    if (session.movePlayed && (status as string) === 'playing') await evaluateAgency();
  }

  /** P3 (A3): the bot's resign / accept-draw decision for the just-played bot move. Runs ONE
   *  full-strength eval and feeds BOTH decisions (one eval per bot decision — AP-OPPAGENCY-10). The
   *  eval is a serialized worker round-trip that can throw; on throw we reset the counters and let
   *  the bot play on — never a spurious resign/auto-accept, never a frozen hot path (E3,
   *  AP-OPPAGENCY-13, mirrors coachEvalBad's catch→false). The decision uses a full-strength eval, not
   *  the throttled UCI_Elo search, so a weak bot's deliberately-bad search never drives its concession
   *  (AP-OPPAGENCY-3). */
  async function evaluateAgency() {
    if (!session || !opponent) return;
    const botElo = opponent.state.targetElo;
    let whiteCp: number;
    try {
      const evalRes = await app.engine.evaluate(
        variant === 'chess960' ? game.fenForEngine() : game.fen,
        { depth: 10, fullStrength: true },
      );
      whiteCp = evalRes.whiteCp;
    } catch {
      consecutiveLostPlies = 0;
      consecutiveEqualPlies = 0;
      return; // failed eval → no resign, no auto-accept, bot plays on (E3)
    }
    // The game may have ended (flag/resign) or a new game started while the eval was in flight.
    if (status !== 'playing' || !session) return;
    const botPovCp = botSide === 'w' ? whiteCp : -whiteCp;
    // Counters track CONSECUTIVE bot-decision plies past the gate (a single noisy ply resets the
    // count → never resigns on one swing — AP-OPPAGENCY-2). The gate magnitudes are owned by the pure
    // core (single source of truth); the call site only feeds the running count + the eval cp.
    consecutiveLostPlies = botPovCp <= -resignThreshold(botElo) ? consecutiveLostPlies + 1 : 0;
    consecutiveEqualPlies = Math.abs(whiteCp) <= DRAW_CP ? consecutiveEqualPlies + 1 : 0;

    if (decideResign({ botPovCp, consecutiveLostPlies, botElo })) {
      endByAgency('win', t('play.botResigns'));
      return;
    }
    if (drawOffered) {
      if (decideAcceptDraw({ whiteCp, botSide, consecutiveEqualPlies })) {
        drawOffered = false;
        endByAgency('draw', t('play.drawAgreed'));
      } else {
        drawOffered = false; // declined — clear the pending indicator, the game continues
        result = t('play.drawDeclined');
      }
    }
  }

  /** P3: end the game from a bot agency decision (resign / draw-by-agreement). Mirrors checkEnd's
   *  side effects: mark the controller over (so nothing else moves), stop the clock, set the result
   *  string, then fold via finishGame (honesty branch + idempotency guard live there). */
  function endByAgency(outcome: GameOutcome, resultStr: string) {
    if (!session) return;
    session.markOver();
    status = 'over';
    stopClockLoop();
    if (clock) clock = stopClock(clock);
    result = resultStr;
    void finishGame(outcome);
  }

  /** P3 (A3/Q-C): the player offers a draw. The offer rides along to the bot's next decision, where
   *  the same full-strength agency eval decides accept (near-0, not winning) or decline. A persistent
   *  "draw offered" line (E2) keeps it legible until resolved. Player-offer only — bot-initiated
   *  offers are deferred (AP-OPPAGENCY-12). */
  function offerDraw() {
    if (!canOfferDraw) return;
    drawOffered = true;
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

    // Rating-integrity policy (P2/ADR-0058): a game the player took a move back in is un-counted —
    // skip the whole rating-write block (no updateRating / no opponent-pool / no gameRatings write)
    // and persist the record with `unrated: true`. Default OFF, so a normal game is byte-identical to
    // today. The single decision authority is the pure `shouldRate` (AP-PLAYUX-3).
    //
    // P3 honesty (Q-E / AP-OPPAGENCY-5): only an ADAPTIVE game folds into the pool + rating. An
    // override (Easier/Harder/Fixed) game still persists a flagged GameRecord below but SKIPS the fold
    // entirely — it must not move the adaptive pool or the Glicko rating. The predicate is the pure
    // `gameAdaptsPool`. The post-game adaptation line (A5) is derived from the fold's prev/next Elo.
    if (shouldRate(unrated) && gameAdaptsPool(difficultyMode)) {
      if (variant === 'chess960') {
        // Update the chess960 pool — seeded lazily on the first 960 game from classical (AP-960-7).
        const seed = m.gameRatings.chess960 ?? m.gameRatings.classical ?? poolRating(m, 'classical');
        const prevElo = poolOpponent(m, 'chess960').targetElo;
        const { nextOpp, nextRating } = applyGameResult(seed, poolOpponent(m, 'chess960'), outcome, botElo);
        m.opponentByPool.chess960 = nextOpp;
        opp.state = nextOpp;
        await opp.applyStrength().catch(() => {});
        m.gameRatings.chess960 = nextRating;
        setAdaptLine(prevElo, nextOpp.targetElo);
      } else {
        // Standard path: adjust the SELECTED pool's adaptive bot toward the 55% band (AP-TC-3).
        const pool = selectedPool;
        const prevElo = poolOpponent(m, pool).targetElo;
        const { nextOpp, nextRating } = applyGameResult(poolRating(m, pool), poolOpponent(m, pool), outcome, botElo);
        m.opponentByPool[pool] = nextOpp;
        opp.state = nextOpp;
        await opp.applyStrength().catch(() => {});
        m.gameRatings[pool] = nextRating;
        setAdaptLine(prevElo, nextOpp.targetElo);
      }
    }

    const now = Date.now();
    const rec: GameRecord = {
      id: `g:${now}`,
      pgn: game.pgn(),
      result: outcome,
      botElo,
      playedAt: now,
      coached,
      ...(unrated ? { unrated: true } : {}), // ADR-0058: persist the honest un-counted marker
      // P3 (A6/Q-E): flag the difficulty so history/analysis can tell an override game apart; only an
      // adaptive game moved the pool/rating above. Additive optional — absent reads as legacy adaptive.
      ...(difficultyMode !== 'adaptive' ? { difficultyMode } : {}),
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
    lastGameRec = rec;
    await app.persistModel(now);
    await refreshBacklog(); // the just-finished game is now counted until analysed (F-P1-3)
    // Opt-in: analyse JUST this game on finish (never the backlog — Q-C / AP-PLAYLOOP-3). 960 never
    // auto-runs (it's not in the backlog and the core resets the variant anyway, AP-960-4).
    if (autoAnalyzeOnFinish && variant !== 'chess960') void autoAnalyzeFinished();
  }

  /** P3 (A5): set the post-game adaptation line from the pool's prev/next bot Elo. Pure selection via
   *  `adaptationDirection` — returns null for override games, so an Easier/Harder/Fixed game shows no
   *  line (Q-D, suppressed). Only called from inside the adaptive fold, so the values are the real ones
   *  `applyGameResult` produced. */
  function setAdaptLine(prevElo: number, nextElo: number) {
    const dir = adaptationDirection(difficultyMode, prevElo, nextElo);
    const delta = Math.abs(nextElo - prevElo);
    adaptLine =
      dir === 'tougher' ? t('play.adaptTougher', { delta })
      : dir === 'easier' ? t('play.adaptEasier', { delta })
      : dir === 'unchanged' ? t('play.adaptUnchanged')
      : '';
  }

  /** Opt-in post-finish hook (F-P1-2): analyse only the just-finished game via the shared core.
   *  Best-effort + non-blocking — on success show a quiet "analysed ✓"; on failure stay silent and
   *  leave the game in the visible backlog (the count IS the failure signal — AP-PLAYLOOP-11). */
  async function autoAnalyzeFinished() {
    const rec = lastGameRec;
    if (!rec || !model) return;
    try {
      await analyzeOnePlayedGame(app.engine, app.puzzles, model, rec);
      autoAnalyzed = true;
      await refreshBacklog();
    } catch {
      /* silent — the game stays counted in the backlog for a later user-initiated run */
    }
  }

  /** One-click analysis of the game just played — same pipeline as Import, no paste (ADR-0022).
   *  Reuses the shared single-game core (F-P1-5) so the Play-tail button, the batch loop, and
   *  auto-run all run the identical idempotent sequence. */
  async function analyzePlayed() {
    if (!lastGameRec || !model) return;
    const gen = analyzeGen; // capture; a rematch/newGame bumps it and we must discard a stale result
    aStatus = 'analyzing';
    aProgress = 0;
    aTotal = 0;
    try {
      const analysis = await analyzeOnePlayedGame(app.engine, app.puzzles, model, lastGameRec, {
        onProgress: (d, t) => {
          aProgress = d;
          aTotal = t;
        },
      });
      if (gen !== analyzeGen) return; // a new game started while analysing — drop the stale result
      aResult = analysis;
      // The persisted count (set by generatePuzzles, BatchAnalyzer stamps it) — correct even on the
      // idempotent cached-result branch, unlike the old hard 0 (audit P3-16).
      aPuzzles = analysis.puzzlesGenerated;
      aStatus = 'done';
      await refreshBacklog();
    } catch (e) {
      if (gen !== analyzeGen) return;
      result = t('play.analysisFailed') + String(e);
      aStatus = 'idle';
    }
  }

  /** Clear the unanalysed backlog in one user-initiated, SEQUENTIAL, cancellable, capped run
   *  (Q-C=b). The displayed N == backlogGames.length == what runs (F-P1-3). */
  async function analyzeBacklogNow() {
    if (!model || backlogGames.length === 0) return;
    const gen = analyzeGen; // capture; discard a stale batch result if a new game starts meanwhile
    batchCancelled = false;
    batchRunning = true;
    aStatus = 'analyzing';
    aProgress = 0;
    aTotal = backlogGames.length;
    try {
      const res = await analyzeBacklog(app.engine, app.puzzles, model, backlogGames, {
        isCancelled: () => batchCancelled,
        onGameStart: (_id, done, total) => {
          aProgress = done; // game-level progress for the bar (one tick per finished game)
          aTotal = total;
        },
        onPositionProgress: () => {
          /* per-position ticks are noisy across many games; the bar tracks games via onGameStart */
        },
      });
      if (gen !== analyzeGen) return; // a new game started while analysing — drop the stale result
      aResult = res.last;
      aPuzzles = res.last?.puzzlesGenerated ?? 0;
      aStatus = res.last ? 'done' : 'idle';
      await refreshBacklog();
    } catch (e) {
      if (gen !== analyzeGen) return;
      result = t('play.analysisFailed') + String(e);
      aStatus = 'idle';
    } finally {
      batchRunning = false;
    }
  }

  function cancelBatch() {
    batchCancelled = true; // honoured between games by analyzeBacklog (clean stop, never mid-game)
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

  // ── P2 handlers (play-in-game-ux §4 A4) ──

  /** Confirm-before-resign (PL8, AP-PLAYUX-4): the Resign button opens a ConfirmDialog instead of
   *  ending the game directly. The clock keeps running while the dialog is open — it's the player's
   *  own time. Only confirmResign() may call the real resign(). */
  function requestResign() {
    if (status === 'playing' || status === 'thinking') resignOpen = true;
  }
  function confirmResign() {
    resignOpen = false;
    resign();
  }
  function cancelResign() {
    resignOpen = false;
  }

  /** On-demand in-play take-back (PL7, Q-B=a, ADR-0058). Opt-in (gated by `canTakeBack`). Undoes the
   *  bot's reply + the player's move so it's the player's turn again. If the game is rated (every
   *  Play game is today), exercising the takeback forfeits the rating for this game — surfaced
   *  immediately via the "won't count" note, applied in finishGame via shouldRate. NEVER fires the
   *  engine (the loop resumes on the player's next move — AP-PLAYUX-10); the clock is NOT rewound
   *  (the time was honestly spent). */
  function takeBack() {
    if (!canTakeBack || !session) return;
    unrated = true; // ADR-0058: a takeback in a rated game un-counts it (visible before it ends)
    const snap = session.takeBackPlayerMove(); // undoes bot reply + player move; recomputes lastMove
    fen = snap.fen;
    lastMove = snap.lastMove;
    // The position changed under the player — invalidate any prior on-demand check verdict.
    checkVerdict = null;
    checkedFen = null;
  }

  /** Rematch (PL10, Q-D=a): start a fresh game with the SAME color / time control / variant — a thin
   *  call-through to newGame() (the in-memory colorChoice/variant/selectedTC are reused). Distinct
   *  button so the intent reads clearly. newGame() bumps the analysis generation token, so any
   *  in-flight "Analyse this game" result is discarded rather than landing on the fresh game
   *  (FOLD A4 / AP-PLAYUX-10). */
  function rematch() {
    void newGame();
  }

  /** On-demand blunder check (PL7, Q-C=a, FOLD A8): run the existing shallow depth-8 coachEvalBad and
   *  show a non-blocking advisory verdict. One check per position (guard on game.fen — AP-PLAYUX-5);
   *  available regardless of coached mode. NEVER moves, undoes, presses the clock, or touches the
   *  rating. The verdict is a best-effort hint that can disagree with the full-strength post-game
   *  analysis (the copy frames it as "looks risky/fine", not a definitive judgement). */
  async function checkMove() {
    if (!canCheckMove) return;
    if (checkedFen === game.fen) return; // already checked this position — no-op (no engine spam)
    checkedFen = game.fen;
    checkVerdict = (await coachEvalBad()) ? 'risky' : 'fine';
  }
</script>

<section class="col center">
  <h2>{t('play.title')}</h2>
  {#if model}
    <p class="muted">
      <!-- P3 (E1, AP-OPPAGENCY-14): the Adaptive line is byte-identical to before (elo = the pool's
           adaptive value); under an override show the EFFECTIVE bot Elo + a mode tag so the line never
           misstates who you're playing. -->
      {#if difficultyMode === 'adaptive'}
        {t('play.ratingLine', { pool: displayPool, rating: Math.round(poolRating(model, displayPool).rating), elo: poolOpponent(model, displayPool).targetElo })}
      {:else}
        {t('play.ratingLineOverride', { pool: displayPool, rating: Math.round(poolRating(model, displayPool).rating), elo: effectiveBotElo, mode: difficultyTag })}
      {/if}
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

    <!-- P3 (A2): difficulty control {Adaptive (default) · Easier · Harder · Fixed Elo}. Disabled while
         a game is live (mirrors the mode/time selects). Adaptive = today's behaviour (zero regression). -->
    <label class="muted" style="font-size:0.85rem">
      {t('play.difficultyLabel')}
      <select value={difficultyMode} disabled={live}
              onchange={(e) => setDifficultyMode(e.currentTarget.value as DifficultyMode)}>
        <option value="adaptive">{t('play.difficultyAdaptive')}</option>
        <option value="easier">{t('play.difficultyEasier')}</option>
        <option value="harder">{t('play.difficultyHarder')}</option>
        <option value="fixed">{t('play.difficultyFixed')}</option>
      </select>
    </label>

    {#if difficultyMode === 'fixed'}
      <!-- E4: seeded from the current Elo when Fixed is selected, so it's never blank; the bot Elo is
           clamped to [1320,3190] at apply time via difficultyTargetElo. -->
      <label class="muted" style="font-size:0.85rem">
        {t('play.fixedEloLabel')}
        <input type="number" min="1320" max="3190" step="10" style="width:5rem" disabled={live}
               value={fixedElo ?? adaptiveBotElo}
               onchange={(e) => setFixedElo(Number(e.currentTarget.value))} />
      </label>
    {/if}

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

  <div class="play-area">
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

    <!-- P2 move list (PL3, Q-A=a): scrollable, auto-following SAN list rendered beside the board (or
         below it on narrow screens). History log — aria-live="off" so it does NOT announce every ply
         (AP-PLAYUX-9); the latest ply carries aria-current as the orientation cue. View-only; the
         single numbering authority is toMovePairs (AP-PLAYUX-1/2 — no click navigation here). -->
    {#if status !== 'idle'}
      <div class="move-list" role="log" aria-live="off" aria-label={t('play.moveListLabel')} bind:this={moveListEl}>
        {#if movePairs.length === 0}
          <p class="muted move-empty">{t('play.moveListEmpty')}</p>
        {:else}
          {#each movePairs as pair (pair.no)}
            <div class="move-row">
              <span class="move-no">{pair.no}.</span>
              {#if pair.white}
                <span class="move-san" class:latest={pair.whitePly === latestPly}
                      aria-current={pair.whitePly === latestPly ? 'true' : undefined}>{pair.white}</span>
              {:else}
                <span class="move-san move-skip">…</span>
              {/if}
              {#if pair.black}
                <span class="move-san" class:latest={pair.blackPly === latestPly}
                      aria-current={pair.blackPly === latestPly ? 'true' : undefined}>{pair.black}</span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <p class="feedback {status === 'over' ? 'good' : ''}">
    {#if thinking}{t('play.botThinking')}{:else}{result}{/if}
  </p>

  <!-- P2 on-demand check verdict (non-blocking, advisory; cleared on the next move / takeback). -->
  {#if checkVerdict && status !== 'idle'}
    <p class="muted" style="font-size:0.82rem">{checkVerdict === 'risky' ? t('play.checkRisky') : t('play.checkFine')}</p>
  {/if}
  <!-- P2 un-rated note (ADR-0058): surfaced the moment a takeback un-counts the game, before it ends. -->
  {#if unrated && status !== 'idle'}
    <p class="muted" style="font-size:0.82rem; color:var(--bad)">{t('play.unratedNote')}</p>
  {/if}
  <!-- P3 (E2): persistent "draw offered" indicator while the offer is in flight (until accept/decline). -->
  {#if drawOffered && live}
    <p class="muted" style="font-size:0.82rem; color:var(--accent)">{t('play.drawOfferedPending')}</p>
  {/if}
  <!-- P3 (A5): post-game adaptation line (adaptive games only; suppressed for override games). -->
  {#if adaptLine && status === 'over'}
    <p class="muted" style="font-size:0.82rem">{adaptLine}</p>
  {/if}

  {#if steerNote && status !== 'idle'}
    <p class="muted" style="font-size:0.82rem">{steerNote}</p>
  {/if}

  <div class="row center">
    {#if engineError}
      <button onclick={retryEngineMove}>{t('play.retryBotMove')}</button>
    {/if}
    {#if status === 'idle' || status === 'over'}
      <button onclick={newGame}>{t('play.newGame')}</button>
      {#if status === 'over'}
        <!-- P2 Rematch (PL10, Q-D=a): same color / time control / variant; thin call-through. -->
        <button onclick={rematch}>{t('play.rematch')}</button>
      {/if}
    {:else}
      <button onclick={requestResign} style="background:var(--bad)">{t('play.resign')}</button>
      <!-- P3 (A3/Q-C): offer a draw on the player's turn; resolved at the bot's next decision. -->
      {#if canOfferDraw}
        <button class="ghost" onclick={offerDraw}>{t('play.offerDraw')}</button>
      {/if}
      <!-- P2 on-demand blunder check (PL7, Q-C=a): advisory shallow eval on the player's turn. -->
      {#if canCheckMove}
        <button class="ghost" onclick={checkMove} disabled={checkedFen === fen}>{t('play.checkMove')}</button>
      {/if}
      <!-- P2 opt-in take-back (PL7, Q-B=a): only when the player has moved (canTakeBack). -->
      {#if canTakeBack}
        <button class="ghost" onclick={takeBack}>{t('play.takeBack')}</button>
      {/if}
    {/if}
    {#if status === 'over' && lastGame && variant !== 'chess960'}
      <button class="ghost" onclick={analyzePlayed} disabled={aStatus === 'analyzing'}>
        {aStatus === 'analyzing' ? t('play.analysing') : aResult ? t('play.reanalyse') : t('play.analyseThisGame')}
      </button>
    {/if}
    {#if status === 'over' && backlogN > 0}
      <!-- Loop closure (P1, F-P1-3): N == unanalyzedPlayedGames(...).length == what the batch runs.
           Sequential, cancellable, capped run over the whole backlog (AP-PLAYLOOP-2/13). -->
      <button class="ghost" onclick={analyzeBacklogNow} disabled={aStatus === 'analyzing'}>
        {tn(backlogN, 'play.loop.analyseAllOne', 'play.loop.analyseAllMany')}
      </button>
    {/if}
    {#if status === 'over' && lastGame}
      <button class="ghost" onclick={() => lastGame && downloadPgn(lastGame.pgn, pgnFilename(lastGame.playedAt, lastGame.result))}>
        {t('play.exportPgn')}
      </button>
    {/if}
  </div>

  {#if status === 'over' && autoAnalyzed && !aResult}
    <p class="muted" style="font-size:0.82rem; color:var(--good)">{t('play.loop.autoAnalysed')}</p>
  {/if}
  {#if status === 'over' && variant === 'chess960'}
    <p class="muted" style="font-size:0.8rem; max-width:440px">
      {t('play.chess960NoAnalysis')}
    </p>
  {/if}

  {#if aStatus === 'analyzing'}
    <div class="panel" style="max-width:420px">
      {#if batchRunning}
        <p>{t('play.loop.queueProgress', { done: aProgress, total: aTotal })}</p>
      {:else}
        <p>{t('play.analysingPosition', { progress: aProgress, total: aTotal })}</p>
      {/if}
      <div class="bar"><div class="bar-fill" style="width:{aTotal ? (aProgress / aTotal) * 100 : 0}%"></div></div>
      {#if batchRunning}
        <button class="ghost" style="margin-top:0.5rem" onclick={cancelBatch} disabled={batchCancelled}>
          {batchCancelled ? t('play.loop.cancelling') : t('play.loop.cancel')}
        </button>
      {/if}
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

  <!-- P2 confirm-before-resign (PL8, AP-PLAYUX-4): a second ConfirmDialog instance, danger-styled.
       Confirm → the existing resign()/finishGame('loss') path; cancel → nothing changes (clock keeps
       running — it's the player's time). Escape cancels (ConfirmDialog behaviour). -->
  <ConfirmDialog
    open={resignOpen}
    danger
    title={t('play.resignConfirmTitle')}
    body={t('play.resignConfirmBody')}
    confirmLabel={t('play.resignConfirmYes')}
    cancelLabel={t('play.resignConfirmNo')}
    onConfirm={confirmResign}
    onCancel={cancelResign}
  />
</section>

<style>
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .bar { height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
  .bar-fill { height: 100%; background: var(--accent); transition: width 0.1s linear; }
  .clocks { display: flex; flex-direction: column; gap: 0.3rem; align-items: center; margin: 0.4rem 0; }
  .clock { font-variant-numeric: tabular-nums; font-size: 1.6rem; font-weight: 700; padding: 0.1rem 0.8rem; border-radius: 6px; background: var(--panel-2); color: var(--text); min-width: 5rem; text-align: center; }
  .clock.active { background: var(--accent); color: #000; }

  /* P2 move list: beside the board on wide screens, below it on narrow ones (wrap). */
  .play-area { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-start; justify-content: center; }
  .move-list {
    min-width: 9rem;
    max-width: 14rem;
    max-height: 60vh;
    overflow-y: auto;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
    line-height: 1.5;
    text-align: left;
  }
  .move-empty { margin: 0; font-size: 0.82rem; }
  .move-row { display: grid; grid-template-columns: 2.2rem 1fr 1fr; gap: 0.3rem; align-items: baseline; }
  .move-no { color: var(--muted); }
  .move-san { color: var(--text); }
  .move-san.move-skip { color: var(--muted); }
  .move-san.latest { background: var(--accent); color: #000; border-radius: 4px; padding: 0 0.25rem; font-weight: 700; }
</style>
