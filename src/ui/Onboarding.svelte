<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import {
    PuzzleLadder,
    priorFromDeclarative,
    seedGameRating,
    acplToElo,
    type DeclarativeAnswers,
  } from '../calibration/Calibration';
  import { TacticalTrainer } from '../trainer/TacticalTrainer';
  import { AdaptiveOpponent, initOpponentState, type GameOutcome } from '../engine/AdaptiveOpponent';
  import { STANDARD_POOLS } from '../rating/pools';
  import ColorPicker from './ColorPicker.svelte';
  import { resolveColor, type ColorChoice } from '../game/color';
  import { t } from '../i18n';

  type Step = 'declare' | 'ladder' | 'offer-game' | 'game' | 'done';
  let step = $state<Step>('declare');

  // Declarative answers.
  let selfLevel = $state<DeclarativeAnswers['selfLevel']>('beginner');
  let priorRating = $state<string>('');

  // Ladder.
  let ladder: PuzzleLadder | null = null;
  let trainer = $state<TacticalTrainer | null>(null);
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let display = $state(new ChessGame());
  let fen = $state(START_FEN);
  let ladderOrientation = $state<'white' | 'black'>('white'); // fixed per ladder puzzle
  let ladderFeedback = $state('');
  let ladderProgress = $state(0);

  // Calibration game (Stage 2).
  let game = $state(new ChessGame());
  let gameFen = $state(START_FEN);
  let opponent: AdaptiveOpponent | null = null;
  let gameColorChoice = $state<ColorChoice>('white');
  let gameSide = $state<'w' | 'b'>('w');
  let acplSum = 0;
  let acplCount = 0;
  let gameThinking = $state(false);
  let gameInfo = $state('');
  const GAME_MOVE_LIMIT = 24; // short calibration game

  // Calibration-game board in-check highlight: `game` is mutated in place each move and Svelte 5
  // doesn't proxy the ChessGame instance, so a bare `game.inCheck()` binding never re-fires.
  // Depend on the reactive `gameFen` (reassigned every move) so it refreshes. (The ladder board
  // is fine — `display` is reassigned per puzzle.) ADR-0051.
  const gameInCheck = $derived(gameFen ? game.inCheck() : false);

  let resultPuzzleRating = $state(0);
  let resultGameRating = $state(0);

  function startLadder() {
    const prior = priorFromDeclarative({
      selfLevel,
      priorRating: priorRating ? Number(priorRating) : undefined,
    });
    ladder = new PuzzleLadder(app.puzzles, prior);
    step = 'ladder';
    nextLadderPuzzle();
  }

  async function nextLadderPuzzle() {
    if (!ladder) return;
    if (ladder.isDone()) {
      finishLadder();
      return;
    }
    const t = await ladder.next(Date.now());
    if (!t) {
      finishLadder();
      return;
    }
    trainer = t;
    display = new ChessGame(t.getFen());
    fen = display.fen;
    ladderOrientation = display.turn === 'w' ? 'white' : 'black'; // fixed per puzzle
    ladderFeedback = '';
    ladderProgress = ladder.count;
  }

  function onLadderMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!trainer || !ladder) return;
    const uci = from + to + (display.isPromotion(from, to) ? promo : '');
    const res = trainer.playUserMove(uci);
    if (res === 'wrong') {
      ladder.report(false);
      ladderFeedback = t('onboarding.ladderMissed');
      setTimeout(nextLadderPuzzle, 500);
    } else if (res === 'solved') {
      ladder.report(true);
      ladderFeedback = t('onboarding.ladderSolved');
      setTimeout(nextLadderPuzzle, 400);
    } else {
      display = new ChessGame(trainer.getFen());
      fen = display.fen;
    }
  }

  function finishLadder() {
    if (!ladder) return;
    resultPuzzleRating = Math.round(ladder.rating.rating);
    step = 'offer-game';
  }

  async function startCalibrationGame() {
    step = 'game';
    gameSide = resolveColor(gameColorChoice) === 'white' ? 'w' : 'b';
    game = new ChessGame();
    gameFen = game.fen;
    acplSum = 0;
    acplCount = 0;
    const seed = ladder ? ladder.rating.rating : 1200;
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(seed));
    gameThinking = true;
    gameInfo = t('onboarding.startingEngine');
    try {
      await opponent.applyStrength();
      gameInfo = t('onboarding.yourMovePlayNaturally');
    } catch (e) {
      gameInfo = t('onboarding.engineFailedSkipping');
      finishWithoutGame();
      return;
    }
    gameThinking = false;
    if (gameSide === 'b') await engineReply(); // engine (White) opens
  }

  async function onGameMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!opponent || game.turn !== gameSide || gameThinking) return;
    // Disable the board + show feedback across BOTH eval round-trips (not just the bot reply), so it
    // never sits silently frozen and a fast second move can't double-count ACPL (audit v2 H25/L9).
    gameThinking = true;

    // Ensure standard mode (onboarding is never 960; guard against leaked state).
    await app.engine.resetVariant();

    // Best-move eval BEFORE the user moves, to compute centipawn loss.
    let bestCp = 0;
    try {
      const before = await app.engine.evaluate(game.fen, { depth: 10, fullStrength: true });
      bestCp = before.whiteCp;
    } catch { /* ignore */ }

    const san = game.move(from, to, promo);
    if (!san) {
      gameThinking = false;
      return;
    }
    gameFen = game.fen;

    try {
      const after = await app.engine.evaluate(game.fen, { depth: 10, fullStrength: true });
      // Loss from the PLAYER's POV: White wants whiteCp high, Black wants it low.
      const loss = gameSide === 'w'
        ? Math.max(0, bestCp - after.whiteCp)
        : Math.max(0, after.whiteCp - bestCp);
      acplSum += Math.min(loss, 1000);
      acplCount += 1;
    } catch { /* ignore */ }

    if (game.terminal().over || game.history().length >= GAME_MOVE_LIMIT) {
      gameThinking = false;
      finishGame();
      return;
    }
    await engineReply();
  }

  async function engineReply() {
    if (!opponent) return;
    gameThinking = true;
    try {
      const uci = await opponent.pickMove(game.fen, 400);
      if (uci) {
        const san = game.moveUci(uci); // only advance if the engine move actually applied (P1-17)
        if (san) gameFen = game.fen;
      }
    } catch { /* ignore */ }
    gameThinking = false;
    if (game.terminal().over || game.history().length >= GAME_MOVE_LIMIT) finishGame();
  }

  function currentOutcome(): GameOutcome {
    const t = game.terminal();
    if (t.over && t.reason === 'checkmate') return t.winner === gameSide ? 'win' : 'loss';
    return 'draw';
  }

  async function finishGame() {
    const acpl = acplCount > 0 ? acplSum / acplCount : null;
    const prior = priorFromDeclarative({ selfLevel, priorRating: priorRating ? Number(priorRating) : undefined });
    const puzzleR = ladder ? ladder.rating : prior;
    const botElo = opponent?.state.targetElo ?? 1200;
    const gameRating = seedGameRating(puzzleR, prior, acpl, currentOutcome(), botElo);
    resultGameRating = Math.round(gameRating.rating);
    gameInfo = acpl != null ? t('onboarding.acplReadout', { acpl: Math.round(acpl), elo: acplToElo(acpl) }) : '';
    await commit(puzzleR, gameRating);
  }

  function finishWithoutGame() {
    const prior = priorFromDeclarative({ selfLevel, priorRating: priorRating ? Number(priorRating) : undefined });
    const puzzleR = ladder ? ladder.rating : prior;
    const gameRating = seedGameRating(puzzleR, prior, null);
    resultGameRating = Math.round(gameRating.rating);
    void commit(puzzleR, gameRating);
  }

  async function skipGame() {
    finishWithoutGame();
  }

  function skipEvaluation() {
    // Skip the whole evaluation at launch: seed provisional ratings from the declared
    // level only (wide RD; they sharpen as you play) — no ladder, no game. `ladder` is
    // null here, so finishWithoutGame() uses the declarative prior. ADR-0005 / ADR-0026.
    finishWithoutGame();
    app.go('home');
  }

  async function commit(puzzleR: { rating: number; rd: number; vol: number }, gameR: { rating: number; rd: number; vol: number }) {
    if (!app.model) return;
    app.model.puzzleRating = puzzleR;
    // Calibration seeds ALL 4 standard pools from the single measured game rating
    // (spec §4.4 contract). chess960 stays lazy. Each pool starts the bot at gameR.
    const targetElo = Math.round(gameR.rating);
    for (const pool of STANDARD_POOLS) {
      app.model.gameRatings[pool] = { ...gameR };
      app.model.opponentByPool[pool] = { targetElo, recent: [] };
    }
    app.model.onboarded = true;
    await app.persistModel(Date.now());
    step = 'done';
  }
</script>

<section class="col center" style="max-width:640px;margin:0 auto">
  <h2>{t('onboarding.title')}</h2>

  {#if step === 'declare'}
    <p class="muted">{t('onboarding.declareIntro')}</p>
    <div class="panel col" style="width:100%;max-width:380px">
      <label>
        {t('onboarding.rateYourself')}
        <select bind:value={selfLevel}>
          <option value="new">{t('onboarding.levelNew')}</option>
          <option value="beginner">{t('onboarding.levelBeginner')}</option>
          <option value="intermediate">{t('onboarding.levelIntermediate')}</option>
          <option value="advanced">{t('onboarding.levelAdvanced')}</option>
        </select>
      </label>
      <label>
        {t('onboarding.priorRatingLabel')}
        <input type="number" bind:value={priorRating} placeholder={t('onboarding.priorRatingPlaceholder')} />
      </label>
      <div class="row center">
        <button onclick={startLadder} disabled={app.puzzles.size === 0}>{t('onboarding.startLadder')}</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={skipEvaluation}>{t('onboarding.skip')}</button>
      </div>
      {#if app.puzzles.size === 0}<p class="muted">{t('onboarding.loadingPuzzles')}</p>{/if}
      <p class="muted" style="font-size:0.8rem">
        {t('onboarding.skipHint')}
      </p>
    </div>

  {:else if step === 'ladder'}
    <p class="muted">{t('onboarding.ladderPrompt', { n: ladderProgress + 1 })}</p>
    <div class="board-wrap">
      <Board
        {fen}
        orientation={ladderOrientation}
        turnColor={display.turn === 'w' ? 'white' : 'black'}
        movableColor={display.turn === 'w' ? 'white' : 'black'}
        dests={display.dests()}
        check={display.inCheck()}
        onMove={onLadderMove}
        onMoveText={(text) => {
          if (!trainer || !ladder) return false;
          const r = display.resolveMove(text);
          if (!r) return false;
          onLadderMove(r.from, r.to, r.promo ?? 'q');
          return true;
        }}
      />
    </div>
    <p class="feedback">{ladderFeedback}</p>
    <button style="background:transparent;border:1px solid var(--border)" onclick={skipEvaluation}>{t('onboarding.skipTheRest')}</button>

  {:else if step === 'offer-game'}
    <div class="panel col center">
      <h3>{t('onboarding.puzzleRatingApprox', { r: resultPuzzleRating })}</h3>
      <p class="muted">
        {@html t('onboarding.offerGameBody')}
      </p>
      <ColorPicker bind:value={gameColorChoice} />
      <div class="row center">
        <button onclick={startCalibrationGame}>{t('onboarding.playCalibrationGame')}</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={skipGame}>{t('onboarding.skip')}</button>
      </div>
    </div>

  {:else if step === 'game'}
    <p class="muted">{gameInfo}</p>
    <p class="muted" style="font-size:0.82rem">{t('onboarding.youPlay', { color: gameSide === 'w' ? t('color.white') : t('color.black') })}</p>
    <div class="board-wrap">
      <Board
        fen={gameFen}
        orientation={gameSide === 'w' ? 'white' : 'black'}
        turnColor={game.turn === 'w' ? 'white' : 'black'}
        movableColor={!gameThinking && game.turn === gameSide ? (gameSide === 'w' ? 'white' : 'black') : undefined}
        dests={!gameThinking && game.turn === gameSide ? game.dests() : new Map()}
        check={gameInCheck}
        onMove={onGameMove}
        onMoveText={(text) => {
          if (gameThinking || game.turn !== gameSide) return false;
          const r = game.resolveMove(text);
          if (!r) return false;
          void onGameMove(r.from, r.to, r.promo ?? 'q');
          return true;
        }}
      />
    </div>
    {#if gameThinking}<p class="feedback">{t('onboarding.thinking')}</p>{/if}
    <button style="background:transparent;border:1px solid var(--border)" onclick={finishWithoutGame} disabled={gameThinking}>{t('onboarding.endGameSkip')}</button>

  {:else if step === 'done'}
    <div class="panel col center">
      <h3>{t('onboarding.calibratedTitle')}</h3>
      <p>{@html t('onboarding.puzzleRatingDone', { r: resultPuzzleRating })}</p>
      <p>{@html t('onboarding.gameRatingDone', { r: resultGameRating })} <span class="muted">{t('onboarding.roughSeed')}</span></p>
      {#if gameInfo}<p class="muted" style="font-size:0.85rem">{gameInfo}</p>{/if}
      <button onclick={() => app.go('home')}>{t('onboarding.goToHome')}</button>
    </div>
  {/if}
</section>
