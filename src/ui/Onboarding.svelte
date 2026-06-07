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

  function nextLadderPuzzle() {
    if (!ladder) return;
    if (ladder.isDone()) {
      finishLadder();
      return;
    }
    const t = ladder.next(Date.now());
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

  function onLadderMove(from: string, to: string) {
    if (!trainer || !ladder) return;
    const uci = from + to + (display.isPromotion(from, to) ? 'q' : '');
    const res = trainer.playUserMove(uci);
    if (res === 'wrong') {
      ladder.report(false);
      ladderFeedback = 'Missed.';
      setTimeout(nextLadderPuzzle, 500);
    } else if (res === 'solved') {
      ladder.report(true);
      ladderFeedback = 'Solved ✔';
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
    gameInfo = 'Starting engine…';
    try {
      await opponent.applyStrength();
      gameInfo = 'Your move. Play naturally — this calibrates your game rating.';
    } catch (e) {
      gameInfo = 'Engine failed; skipping to results.';
      finishWithoutGame();
      return;
    }
    gameThinking = false;
    if (gameSide === 'b') await engineReply(); // engine (White) opens
  }

  async function onGameMove(from: string, to: string) {
    if (!opponent || game.turn !== gameSide || gameThinking) return;

    // Ensure standard mode (onboarding is never 960; guard against leaked state).
    await app.engine.resetVariant();

    // Best-move eval BEFORE the user moves, to compute centipawn loss.
    let bestCp = 0;
    try {
      const before = await app.engine.evaluate(game.fen, { depth: 10 });
      bestCp = before.whiteCp;
    } catch { /* ignore */ }

    const san = game.move(from, to, 'q');
    if (!san) return;
    gameFen = game.fen;

    try {
      const after = await app.engine.evaluate(game.fen, { depth: 10 });
      // Loss from the PLAYER's POV: White wants whiteCp high, Black wants it low.
      const loss = gameSide === 'w'
        ? Math.max(0, bestCp - after.whiteCp)
        : Math.max(0, after.whiteCp - bestCp);
      acplSum += Math.min(loss, 1000);
      acplCount += 1;
    } catch { /* ignore */ }

    if (game.terminal().over || game.history().length >= GAME_MOVE_LIMIT) {
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
        game.moveUci(uci);
        gameFen = game.fen;
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
    gameInfo = acpl != null ? `Average centipawn loss: ${Math.round(acpl)} (~${acplToElo(acpl)} Elo)` : '';
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
  <h2>Skill evaluation</h2>

  {#if step === 'declare'}
    <p class="muted">A few quick questions, then a short adaptive puzzle ladder to find your level.</p>
    <div class="panel col" style="width:100%;max-width:380px">
      <label>
        How would you rate yourself?
        <select bind:value={selfLevel}>
          <option value="new">Brand new to chess</option>
          <option value="beginner">Beginner (casual)</option>
          <option value="intermediate">Intermediate (club level)</option>
          <option value="advanced">Advanced (1800+)</option>
        </select>
      </label>
      <label>
        Rating on another site? (optional)
        <input type="number" bind:value={priorRating} placeholder="e.g. 1450" />
      </label>
      <div class="row center">
        <button onclick={startLadder} disabled={app.puzzles.size === 0}>Start the ladder →</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={skipEvaluation}>Skip</button>
      </div>
      {#if app.puzzles.size === 0}<p class="muted">Loading puzzles…</p>{/if}
      <p class="muted" style="font-size:0.8rem">
        Skip to seed a rough rating from your self-assessment above — it sharpens as you play. Re-run
        anytime from Settings.
      </p>
    </div>

  {:else if step === 'ladder'}
    <p class="muted">Puzzle {ladderProgress + 1} — solve it. The difficulty adapts to you.</p>
    <div class="board-wrap">
      <Board
        {fen}
        orientation={ladderOrientation}
        turnColor={display.turn === 'w' ? 'white' : 'black'}
        movableColor={display.turn === 'w' ? 'white' : 'black'}
        dests={display.dests()}
        check={display.inCheck()}
        onMove={onLadderMove}
      />
    </div>
    <p class="feedback">{ladderFeedback}</p>

  {:else if step === 'offer-game'}
    <div class="panel col center">
      <h3>Puzzle rating ≈ {resultPuzzleRating}</h3>
      <p class="muted">
        Optional: play a short game vs the engine so we can also estimate your <b>game</b> rating
        (puzzle skill and playing strength differ). About 12 moves.
      </p>
      <ColorPicker bind:value={gameColorChoice} />
      <div class="row center">
        <button onclick={startCalibrationGame}>Play the calibration game →</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={skipGame}>Skip</button>
      </div>
    </div>

  {:else if step === 'game'}
    <p class="muted">{gameInfo}</p>
    <p class="muted" style="font-size:0.82rem">You play {gameSide === 'w' ? 'White' : 'Black'}</p>
    <div class="board-wrap">
      <Board
        fen={gameFen}
        orientation={gameSide === 'w' ? 'white' : 'black'}
        turnColor={game.turn === 'w' ? 'white' : 'black'}
        movableColor={!gameThinking && game.turn === gameSide ? (gameSide === 'w' ? 'white' : 'black') : undefined}
        dests={!gameThinking && game.turn === gameSide ? game.dests() : new Map()}
        check={gameInCheck}
        onMove={onGameMove}
      />
    </div>
    {#if gameThinking}<p class="feedback">Bot thinking…</p>{/if}

  {:else if step === 'done'}
    <div class="panel col center">
      <h3>You're calibrated</h3>
      <p>Puzzle rating ≈ <b>{resultPuzzleRating}</b></p>
      <p>Game rating ≈ <b>{resultGameRating}</b> <span class="muted">(rough seed — it sharpens as you play)</span></p>
      {#if gameInfo}<p class="muted" style="font-size:0.85rem">{gameInfo}</p>{/if}
      <button onclick={() => app.go('home')}>Go to home →</button>
    </div>
  {/if}
</section>
