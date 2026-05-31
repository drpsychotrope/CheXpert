<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { TacticalTrainer, gradeAttempt } from '../trainer/TacticalTrainer';
  import type { Puzzle } from '../trainer/puzzle';
  import { openTrainerDB } from '../store/db';

  let trainer = $state<TacticalTrainer | null>(null);
  let puzzle = $state<Puzzle | null>(null);
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let display = $state(new ChessGame());
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');
  let solvedThisSession = $state(0);
  let attemptedThisSession = $state(0);
  let mode = $state<'mixed' | 'personal' | 'themed'>('mixed');
  const seen = new Set<string>();

  const model = $derived(app.model);
  // Theme filter handed over by the dashboard's "Drill" buttons (loop closure).
  const drillThemes = $derived(app.tacticsFilterThemes);

  function loadNext() {
    if (!model) return;
    feedback = '';
    feedbackKind = '';

    // Selection priority closes the loop: a dashboard drill filter wins; else
    // prefer the player's own personal puzzles (from their real mistakes); else
    // fall back to the curated set in the player's rating zone.
    let p =
      drillThemes && drillThemes.length
        ? app.puzzles.next({ rating: model.puzzleRating.rating, window: 400, exclude: seen, themes: drillThemes })
        : null;
    if (p) mode = 'themed';

    if (!p) {
      p = app.puzzles.next({ rating: model.puzzleRating.rating, window: 600, exclude: seen, source: 'personal' });
      if (p) mode = 'personal';
    }
    if (!p) {
      p = app.puzzles.next({ rating: model.puzzleRating.rating, window: 250, exclude: seen });
      if (p) mode = 'mixed';
    }

    if (!p) {
      feedback = 'No more puzzles available in your range.';
      return;
    }
    seen.add(p.id);
    puzzle = p;
    trainer = new TacticalTrainer(p, Date.now());
    display = new ChessGame(p.fen);
    fen = display.fen;
    lastMove = null;
  }

  function clearDrill() {
    app.tacticsFilterThemes = null;
    seen.clear();
    trainer = null;
    loadNext();
  }

  function sideToMove(): 'white' | 'black' {
    return display.turn === 'w' ? 'white' : 'black';
  }

  async function onMove(from: string, to: string) {
    if (!trainer || !puzzle || trainer.state.status !== 'solving') return;
    const promo = display.isPromotion(from, to) ? 'q' : 'q';
    const uci = from + to + (display.isPromotion(from, to) ? promo : '');
    const result = trainer.playUserMove(uci);

    if (result === 'wrong') {
      feedback = 'Not the move — this one is failed. Try the next.';
      feedbackKind = 'bad';
      await finish(false);
      // Reflect the attempted (wrong) move briefly is skipped; reset to puzzle pos.
      display = new ChessGame(puzzle.fen);
      fen = display.fen;
      return;
    }

    // Correct: sync the display board to the trainer's internal position
    // (which already applied the user move + any auto opponent reply).
    display = new ChessGame(trainer.getFen());
    fen = display.fen;
    lastMove = [from, to];

    if (result === 'solved') {
      feedback = 'Solved! ✔';
      feedbackKind = 'good';
      await finish(true);
    } else {
      feedback = 'Correct — keep going.';
      feedbackKind = 'good';
    }
  }

  async function finish(solved: boolean) {
    if (!model || !puzzle || !trainer) return;
    attemptedThisSession += 1;
    if (solved) solvedThisSession += 1;

    const graded = gradeAttempt(model.puzzleRating, puzzle, solved);
    model.puzzleRating = graded.player;

    // Track a nascent weakness counter when failing (Phase 2 builds on this).
    if (!solved) {
      for (const t of puzzle.themes) {
        model.weaknessCounters[t] = (model.weaknessCounters[t] ?? 0) + 1;
      }
    }

    const now = Date.now();
    const db = await openTrainerDB();
    await db.put('puzzleAttempts', {
      id: `${puzzle.id}:${now}`,
      puzzleId: puzzle.id,
      solved,
      ms: trainer.elapsedMs(now),
      themes: puzzle.themes,
      ratingBefore: graded.player.rating,
      ratingAfter: model.puzzleRating.rating,
      playedAt: now,
      source: puzzle.source,
    });
    // Persist the updated puzzle rating into the puzzle row too (it drifts down).
    await db.put('puzzles', { ...puzzle, rating: Math.round(graded.puzzle.rating), ratingDeviation: Math.round(graded.puzzle.rd) });
    await app.persistModel(now);
  }

  // Load the first puzzle once the model is ready.
  $effect(() => {
    if (model && !trainer && app.puzzles.size > 0) loadNext();
  });

  function hint() {
    if (trainer) {
      const m = trainer.expectedMove();
      if (m) {
        feedback = `Hint: a strong piece moves from ${m.slice(0, 2)}.`;
        feedbackKind = '';
      }
    }
  }
</script>

<section class="col center">
  <h2>Tactics</h2>
  {#if model}
    <p class="muted">
      Puzzle rating {Math.round(model.puzzleRating.rating)} ±{Math.round(model.puzzleRating.rd)}
      · session {solvedThisSession}/{attemptedThisSession}
    </p>
  {/if}
  {#if drillThemes && drillThemes.length}
    <p class="feedback">
      Drilling your weakness: {drillThemes.slice(0, 3).join(', ')}
      <button class="link" onclick={clearDrill}>clear</button>
    </p>
  {:else if mode === 'personal'}
    <p class="muted" style="font-size:0.85rem">★ From your own games</p>
  {/if}

  <div class="board-wrap">
    <Board
      {fen}
      orientation={sideToMove()}
      turnColor={sideToMove()}
      movableColor={trainer?.state.status === 'solving' ? sideToMove() : undefined}
      dests={trainer?.state.status === 'solving' ? display.dests() : new Map()}
      {lastMove}
      check={display.inCheck()}
      {onMove}
    />
  </div>

  <p class="feedback {feedbackKind}">{feedback}</p>

  <div class="row center">
    <button onclick={hint} disabled={trainer?.state.status !== 'solving'}>Hint</button>
    <button onclick={loadNext}>Next puzzle →</button>
  </div>
  {#if puzzle}
    <p class="muted" style="font-size:0.8rem">
      Themes: {puzzle.themes.join(', ') || '—'}
      {#if puzzle.source === 'personal'} · ★ from your game{/if}
    </p>
  {/if}
</section>

<style>
  button.link { background: none; border: none; color: var(--accent); padding: 0 0 0 0.4rem; text-decoration: underline; cursor: pointer; }
</style>
