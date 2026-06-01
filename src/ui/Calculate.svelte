<script lang="ts">
  // Calculation trainer (spec C / 3a): solve a tactic with NO hints — you must see the
  // whole line before you move. The line is validated against the puzzle's stored
  // solution (gradeCalcLine); a final verdict reports how far you calculated.
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { TacticalTrainer } from '../trainer/TacticalTrainer';
  import { gradeCalcLine } from '../calc/calc';
  import type { Puzzle } from '../trainer/puzzle';

  let puzzle = $state<Puzzle | null>(null);
  let trainer = $state<TacticalTrainer | null>(null);
  let display = $state(new ChessGame());
  let fen = $state('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  let orientation = $state<'white' | 'black'>('white');
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');
  let userMoves: string[] = [];
  const seen = new Set<string>();
  const model = $derived(app.model);

  function load() {
    if (!model) return;
    const p =
      app.puzzles.next({ rating: model.puzzleRating.rating, window: 400, exclude: seen, source: 'personal' }) ??
      app.puzzles.next({ rating: model.puzzleRating.rating, window: 300, exclude: seen });
    if (!p) { feedback = 'No puzzles in range.'; return; }
    seen.add(p.id);
    puzzle = p;
    trainer = new TacticalTrainer(p, Date.now());
    display = new ChessGame(p.fen);
    fen = display.fen;
    orientation = display.turn === 'w' ? 'white' : 'black';
    userMoves = [];
    feedback = 'Calculate the whole line in your head, then play it. No hints.';
    feedbackKind = '';
  }

  function sideToMove(): 'white' | 'black' {
    return display.turn === 'w' ? 'white' : 'black';
  }

  function onMove(from: string, to: string) {
    if (!trainer || !puzzle || trainer.state.status !== 'solving') return;
    const uci = from + to + (display.isPromotion(from, to) ? 'q' : '');
    const res = trainer.playUserMove(uci);
    userMoves.push(uci);
    if (res === 'wrong') {
      const g = gradeCalcLine(puzzle.moves, userMoves);
      feedback = `Miss — you calculated ${g.solvedPlies} correct ${g.solvedPlies === 1 ? 'ply' : 'plies'}. Solution: ${puzzle.moves.join(' ')}`;
      feedbackKind = 'bad';
      display = new ChessGame(puzzle.fen);
      fen = display.fen;
      return;
    }
    display = new ChessGame(trainer.getFen());
    fen = display.fen;
    if (res === 'solved') {
      const g = gradeCalcLine(puzzle.moves, userMoves);
      feedback = `Calculated the full line (${g.solvedPlies} plies)! ✔`;
      feedbackKind = 'good';
    } else {
      feedback = 'Keep going — play the rest of your line.';
      feedbackKind = '';
    }
  }

  $effect(() => {
    if (model && !trainer && app.puzzles.size > 0) load();
  });
</script>

<section class="col center">
  <h2>Calculation</h2>
  <p class="muted" style="max-width:420px;font-size:0.85rem">
    No hints. See the whole forcing line before you touch a piece, then play it out.
  </p>
  <div class="board-wrap">
    <Board
      {fen}
      {orientation}
      turnColor={sideToMove()}
      movableColor={trainer?.state.status === 'solving' ? sideToMove() : undefined}
      dests={trainer?.state.status === 'solving' ? display.dests() : new Map()}
      check={display.inCheck()}
      {onMove}
    />
  </div>
  <p class="feedback {feedbackKind}">{feedback}</p>
  <div class="row center">
    <button onclick={load}>Next position →</button>
  </div>
</section>
