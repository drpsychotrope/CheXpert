<script lang="ts">
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { MASTER_GAMES, type MasterGame } from '../guess/games';
  import { GuessGame } from '../guess/guess';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  let mode = $state<'pick' | 'play'>('pick');
  let chosen = $state<MasterGame | null>(null);
  let guess = $state<GuessGame | null>(null);
  let display = $state(new ChessGame());
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');

  function start(g: MasterGame) {
    chosen = g;
    guess = new GuessGame(g.pgn, g.guessColor);
    sync();
    feedback = `You are ${g.guessColor === 'w' ? 'White' : 'Black'}. Find each move.`;
    feedbackKind = '';
    mode = 'play';
  }

  function sync() {
    if (!guess) return;
    display = new ChessGame(guess.fen());
    fen = display.fen;
  }

  function side(): 'white' | 'black' {
    return chosen?.guessColor === 'b' ? 'black' : 'white';
  }

  function onMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!guess || guess.done) return;
    const uci = from + to + (display.isPromotion(from, to) ? promo : '');
    const before = guess.fen();
    const res = guess.guess(uci);
    if (res === 'wrong') {
      feedback = 'Not the move that was played — try again, or Reveal.';
      feedbackKind = 'bad';
      display = new ChessGame(before); // no advance
      fen = display.fen;
      return;
    }
    sync();
    lastMove = [from, to];
    feedback = guess.done
      ? `Game over — you matched ${guess.score}/${guess.guesses} (${Math.round(guess.accuracy() * 100)}%).`
      : 'Correct! ✔';
    feedbackKind = 'good';
  }

  function reveal() {
    if (!guess || guess.done) return;
    const shown = guess.reveal();
    sync();
    if (shown) {
      lastMove = [shown.uci.slice(0, 2), shown.uci.slice(2, 4)];
      feedback = `The move was ${shown.san}.`;
      feedbackKind = '';
    }
    if (guess.done) feedback = `Game over — you matched ${guess.score}/${guess.guesses}.`;
  }
</script>

<section class="col center">
  <h2>Guess the move</h2>
  <p class="muted" style="max-width:560px">
    Step through a master game and find the move that was actually played. Active recall on real
    brilliancies — guessing trains the same prediction you do over the board.
  </p>

  {#if mode === 'pick'}
    <div class="games">
      {#each MASTER_GAMES as g}
        <button class="game-card" onclick={() => start(g)}>
          <b>{g.name}</b>
          <span class="muted">{g.white} vs {g.black}</span>
          <span class="muted note">{g.note}</span>
        </button>
      {/each}
    </div>
  {:else if mode === 'play' && guess && chosen}
    <p class="muted">
      {chosen.name} — {chosen.white} vs {chosen.black} · matched {guess.score}/{guess.guesses}
    </p>
    <div class="board-wrap">
      <Board
        {fen}
        orientation={side()}
        turnColor={display.turn === 'w' ? 'white' : 'black'}
        showTurn={!guess.done}
        turnLabel="play"
        movableColor={guess.done ? undefined : side()}
        dests={guess.done ? new Map() : display.dests()}
        {lastMove}
        check={display.inCheck()}
        {onMove}
      />
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    <div class="row center">
      {#if !guess.done}
        <button class="ghost" onclick={reveal}>Reveal move</button>
      {/if}
      <button class="ghost" onclick={() => (mode = 'pick')}>← Games</button>
    </div>
  {/if}
</section>

<style>
  .games { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; max-width: 720px; }
  .game-card { display: flex; flex-direction: column; gap: 0.3rem; text-align: left; align-items: flex-start; background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 0.8rem 1rem; border-radius: 10px; cursor: pointer; }
  .game-card .muted { font-size: 0.8rem; font-weight: 400; }
  .game-card .note { font-style: italic; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
