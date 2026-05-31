<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { AdaptiveOpponent, initOpponentState, type GameOutcome } from '../engine/AdaptiveOpponent';
  import { updateRating } from '../rating/glicko2';
  import { openTrainerDB, type GameRecord } from '../store/db';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { buildWeaknessProfile, type Dimension } from '../analysis/weakness';
  import { selectOpening, nextBookMove, steeringNote, type OpeningEntry } from '../opening/openingBook';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let game = $state(new ChessGame());
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  let status = $state<'idle' | 'playing' | 'thinking' | 'over'>('idle');
  let result = $state('');
  let thinking = $state(false);
  let steerNote = $state('');
  let opponent: AdaptiveOpponent | null = null;
  const playerColor: 'white' | 'black' = 'white';

  // Loop closure: the bot (Black here) opens toward the player's weakest area.
  let opening: OpeningEntry | null = null;
  let playedUci: string[] = [];

  const model = $derived(app.model);
  const coached = $derived(app.settings?.coachedMode ?? false);

  async function newGame() {
    if (!model) return;
    result = '';
    game = new ChessGame();
    fen = game.fen;
    lastMove = null;
    playedUci = [];

    // Read the weakness profile (from analysed games) and steer the opening.
    let weakest: Dimension | null = null;
    try {
      const analyses = await loadAllAnalyses();
      if (analyses.length) weakest = buildWeaknessProfile(analyses, model.gameRating.rating).weakest;
    } catch {
      /* no analyses yet → neutral variety */
    }
    opening = selectOpening('b', weakest, Math.random());
    steerNote = steeringNote(opening, weakest);

    const state = initOpponentState(model.opponentTargetElo);
    opponent = new AdaptiveOpponent(app.engine, state);
    status = 'thinking';
    try {
      await opponent.applyStrength();
      status = 'playing';
    } catch (e) {
      result = 'Engine failed to start: ' + String(e);
      status = 'idle';
    }
  }

  function turnColor(): 'white' | 'black' {
    return game.turn === 'w' ? 'white' : 'black';
  }

  async function onMove(from: string, to: string) {
    if (status !== 'playing' || turnColor() !== playerColor) return;
    const uci = from + to + (game.isPromotion(from, to) ? 'q' : '');
    const san = game.move(from, to, 'q');
    if (!san) return;
    playedUci.push(uci);
    fen = game.fen;
    lastMove = [from, to];

    if (coached) await coachCheck();

    if (checkEnd()) return;
    await engineMove();
  }

  async function engineMove() {
    if (!opponent) return;
    status = 'thinking';
    thinking = true;
    try {
      // Loop closure: play the steering opening's book move if still on the line;
      // otherwise the engine takes over at the calibrated ~55% Elo (band intact).
      let uci = opening ? nextBookMove(opening, playedUci) : null;
      if (!uci) uci = await opponent.pickMove(game.fen, 500);
      if (uci) {
        game.moveUci(uci);
        playedUci.push(uci);
        fen = game.fen;
        lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
      }
    } catch (e) {
      result = 'Engine error: ' + String(e);
    }
    thinking = false;
    if (!checkEnd()) status = 'playing';
  }

  /** Coached mode (Phase 1, best-effort): quick shallow eval; warn on a big drop. */
  async function coachCheck() {
    try {
      const evalRes = await app.engine.evaluate(game.fen, { depth: 8 });
      // After the player's move it is the opponent's turn; a very negative
      // White-POV score (for a white player) means the move likely blundered.
      const cp = evalRes.whiteCp;
      const bad = playerColor === 'white' ? cp < -250 : cp > 250;
      if (bad) {
        const undo = confirm('Coach: that move looks like it loses material or worse. Take it back?');
        if (undo) {
          game.undo();
          fen = game.fen;
          lastMove = null;
          status = 'playing';
          throw new Error('__takeback__');
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message === '__takeback__') throw e;
      // eval failure shouldn't block play
    }
  }

  function checkEnd(): boolean {
    const t = game.terminal();
    if (!t.over) return false;
    status = 'over';
    let outcome: GameOutcome;
    if (t.reason === 'checkmate') {
      outcome = t.winner === playerColor[0] ? 'win' : 'loss';
      result = outcome === 'win' ? 'Checkmate — you win! ♚' : 'Checkmate — you lost.';
    } else {
      outcome = 'draw';
      result = `Draw (${t.reason}).`;
    }
    void finishGame(outcome);
    return true;
  }

  async function finishGame(outcome: GameOutcome) {
    const m = model;
    const opp = opponent;
    if (!m || !opp) return;
    const botElo = opp.state.targetElo;
    // Adjust opponent strength toward the 55% band and persist.
    const newState = await opp.finishGame(outcome).catch(() => opp.state);
    m.opponentTargetElo = newState.targetElo;
    m.recentOutcomes = newState.recent;

    // Update the player's GAME rating via one Glicko match vs the bot Elo.
    const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
    m.gameRating = updateRating(m.gameRating, [{ opponentRating: botElo, opponentRd: 60, score }]);

    const now = Date.now();
    const db = await openTrainerDB();
    const rec: GameRecord = {
      id: `g:${now}`,
      pgn: game.pgn(),
      result: outcome,
      botElo,
      playedAt: now,
      coached,
    };
    await db.put('games', rec);
    await app.persistModel(now);
  }

  function resign() {
    if (status === 'playing' || status === 'thinking') {
      status = 'over';
      result = 'You resigned.';
      void finishGame('loss');
    }
  }
</script>

<section class="col center">
  <h2>Play the adaptive bot</h2>
  {#if model}
    <p class="muted">
      Your game rating {Math.round(model.gameRating.rating)} · bot ≈ {model.opponentTargetElo} Elo
      {#if coached}· <span style="color:var(--accent)">coached on</span>{/if}
    </p>
  {/if}

  <div class="board-wrap">
    <Board
      {fen}
      orientation={playerColor}
      turnColor={turnColor()}
      movableColor={status === 'playing' && turnColor() === playerColor ? playerColor : undefined}
      dests={status === 'playing' && turnColor() === playerColor ? game.dests() : new Map()}
      {lastMove}
      check={game.inCheck()}
      {onMove}
    />
  </div>

  <p class="feedback {status === 'over' ? 'good' : ''}">
    {#if thinking}Bot is thinking…{:else}{result}{/if}
  </p>

  {#if steerNote && status !== 'idle'}
    <p class="muted" style="font-size:0.82rem">{steerNote}</p>
  {/if}

  <div class="row center">
    {#if status === 'idle' || status === 'over'}
      <button onclick={newGame}>New game</button>
    {:else}
      <button onclick={resign} style="background:var(--bad)">Resign</button>
    {/if}
  </div>
  <p class="muted" style="font-size:0.8rem; max-width:420px">
    Tip: play slowly and think, then import the game in <b>Analyse</b> to turn your mistakes into puzzles —
    the bot will then steer future openings toward whatever you're weakest at.
  </p>
</section>
