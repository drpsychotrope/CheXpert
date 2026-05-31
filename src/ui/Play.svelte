<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { AdaptiveOpponent, initOpponentState, type GameOutcome } from '../engine/AdaptiveOpponent';
  import { updateRating } from '../rating/glicko2';
  import { openTrainerDB, type GameRecord } from '../store/db';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let game = $state(new ChessGame());
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  let status = $state<'idle' | 'playing' | 'thinking' | 'over'>('idle');
  let result = $state('');
  let thinking = $state(false);
  let opponent: AdaptiveOpponent | null = null;
  const playerColor: 'white' | 'black' = 'white';

  const model = $derived(app.model);
  const coached = $derived(app.settings?.coachedMode ?? false);

  async function newGame() {
    if (!model) return;
    result = '';
    game = new ChessGame();
    fen = game.fen;
    lastMove = null;
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
    const san = game.move(from, to, 'q');
    if (!san) return;
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
      const uci = await opponent.pickMove(game.fen, 500);
      if (uci) {
        game.moveUci(uci);
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

  <div class="row center">
    {#if status === 'idle' || status === 'over'}
      <button onclick={newGame}>New game</button>
    {:else}
      <button onclick={resign} style="background:var(--bad)">Resign</button>
    {/if}
  </div>
  <p class="muted" style="font-size:0.8rem; max-width:420px">
    Tip: play slowly and think. After Phase 2 you'll be able to import these games for analysis and
    auto-generated puzzles from your mistakes.
  </p>
</section>
