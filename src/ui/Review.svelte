<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { TacticalTrainer, gradeAttempt } from '../trainer/TacticalTrainer';
  import type { Puzzle } from '../trainer/puzzle';
  import { dueCards, reviewItem, allCards } from '../srs/SrsStore';
  import { resultToGrade, intervalLabel } from '../srs/fsrs';
  import { openTrainerDB } from '../store/db';
  import { interleave, buildLapseSet } from '../srs/schedule';
  import { createSet, saveSet } from '../woodpecker/woodpecker';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  let loading = $state(true);
  let queue = $state<string[]>([]); // puzzle ids due now
  let index = $state(0);
  let trainer = $state<TacticalTrainer | null>(null);
  let puzzle = $state<Puzzle | null>(null);
  let display = $state(new ChessGame());
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  // Solver's side, fixed for the whole puzzle (board must not flip mid-solve).
  let orientation = $state<'white' | 'black'>('white');
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');
  let reviewed = $state(0);
  let startedAt = 0;
  let missesMsg = $state('');
  let scheduledCount = $state(0);
  let nextDue = $state('');

  const model = $derived(app.model);

  async function loadQueue() {
    loading = true;
    const now = Date.now();
    const due = await dueCards(now, 'puzzle', 100);
    // Interleave by theme (desirable difficulty) so consecutive cards differ where possible.
    queue = interleave(due.map((c) => c.refId), (id) => app.puzzles.byId(id)?.themes?.[0] ?? '');
    index = 0;
    reviewed = 0;
    // Schedule transparency for the empty state: how many puzzle cards exist + when the next is due.
    const puz = (await allCards()).filter((c) => c.kind === 'puzzle');
    scheduledCount = puz.length;
    const soonest = puz.filter((c) => c.due > now).sort((a, b) => a.due - b.due)[0];
    nextDue = soonest ? intervalLabel(soonest, now) : '';
    if (queue.length) loadCurrent();
    loading = false;
  }

  function findPuzzle(id: string): Puzzle | null {
    // PuzzleRepo caches all puzzles in memory; reuse its selection by id.
    return app.puzzles.byId(id);
  }

  function loadCurrent() {
    feedback = '';
    feedbackKind = '';
    while (index < queue.length) {
      const p = findPuzzle(queue[index]);
      if (p) {
        puzzle = p;
        trainer = new TacticalTrainer(p, Date.now());
        display = new ChessGame(p.fen);
        fen = display.fen;
        lastMove = null;
        orientation = display.turn === 'w' ? 'white' : 'black'; // fixed for the puzzle
        startedAt = Date.now();
        return;
      }
      index += 1; // skip cards whose puzzle is gone
    }
    trainer = null;
    puzzle = null;
  }

  function sideToMove(): 'white' | 'black' {
    return display.turn === 'w' ? 'white' : 'black';
  }

  async function onMove(from: string, to: string) {
    if (!trainer || !puzzle || trainer.state.status !== 'solving') return;
    const uci = from + to + (display.isPromotion(from, to) ? 'q' : '');
    const res = trainer.playUserMove(uci);

    if (res === 'wrong') {
      feedback = 'Missed — scheduled again soon.';
      feedbackKind = 'bad';
      display = new ChessGame(puzzle.fen);
      fen = display.fen;
      await grade(false);
      return;
    }
    display = new ChessGame(trainer.getFen());
    fen = display.fen;
    lastMove = [from, to];
    if (res === 'solved') {
      feedback = 'Solved ✔';
      feedbackKind = 'good';
      await grade(true);
    } else {
      feedback = 'Correct — keep going.';
      feedbackKind = 'good';
    }
  }

  async function grade(solved: boolean) {
    if (!puzzle) return;
    const ms = Date.now() - startedAt;
    const g = resultToGrade(solved, ms);
    await reviewItem('puzzle', puzzle.id, g, Date.now());

    // Also update the puzzle Glicko + attempt log, like normal tactics.
    if (model) {
      const graded = gradeAttempt(model.puzzleRating, puzzle, solved);
      model.puzzleRating = graded.player;
      if (!solved) for (const t of puzzle.themes) model.weaknessCounters[t] = (model.weaknessCounters[t] ?? 0) + 1;
      const db = await openTrainerDB();
      // Snapshot the $state puzzle — a proxy can't be structured-cloned by IndexedDB.
      await db.put('puzzles', { ...$state.snapshot(puzzle), rating: Math.round(graded.puzzle.rating), ratingDeviation: Math.round(graded.puzzle.rd) });
      await app.persistModel(Date.now());
    }
    reviewed += 1;
  }

  function nextCard() {
    index += 1;
    if (index < queue.length) loadCurrent();
    else {
      trainer = null;
      puzzle = null;
    }
  }

  /** Build a fixed "Your misses" Woodpecker set from the puzzles you fail most (any source). */
  async function buildMissesSet() {
    const db = await openTrainerDB();
    const attempts = (await db.getAll('puzzleAttempts')) as Array<{ puzzleId: string; solved: boolean }>;
    const ids = buildLapseSet(attempts, 12);
    if (!ids.length) {
      missesMsg = 'No failed puzzles yet — miss a few in Tactics first.';
      return;
    }
    await saveSet(createSet('wp:lapses', 'Your misses', ids, Date.now()));
    missesMsg = `Built a ${ids.length}-puzzle "Your misses" set — train it in Woodpecker.`;
  }

  $effect(() => {
    if (model && loading) void loadQueue();
  });
</script>

<section class="col center">
  <h2>Review</h2>
  <p class="muted">Spaced repetition (FSRS) of the puzzles you've seen — your weakest patterns resurface right before you'd forget them.</p>

  {#if loading}
    <p class="muted">Loading your due queue…</p>
  {:else if queue.length === 0}
    <div class="panel col center">
      <p>Nothing due right now. 🎉</p>
      {#if scheduledCount > 0}
        <p class="muted">{scheduledCount} {scheduledCount === 1 ? 'puzzle' : 'puzzles'} scheduled{nextDue ? ` · next due ${nextDue}` : ''}. Spaced repetition holds cards back until they're due — solved puzzles resurface in minutes, fast ones later.</p>
      {:else}
        <p class="muted">Solve puzzles in Tactics or analyse a game to add cards to your review schedule.</p>
      {/if}
      <button onclick={() => app.go('tactics')}>Go to Tactics →</button>
      <button class="ghost" onclick={buildMissesSet}>Build a "your misses" set →</button>
      {#if missesMsg}<p class="muted" style="font-size:0.85rem">{missesMsg}</p>{/if}
    </div>
  {:else if !trainer}
    <div class="panel col center">
      <p>Review complete — {reviewed} card{reviewed === 1 ? '' : 's'} done.</p>
      <button onclick={loadQueue}>Check for more →</button>
      <button class="ghost" onclick={buildMissesSet}>Build a "your misses" set →</button>
      {#if missesMsg}<p class="muted" style="font-size:0.85rem">{missesMsg}</p>{/if}
    </div>
  {:else}
    <p class="muted">Card {index + 1} of {queue.length} · {reviewed} reviewed</p>
    <div class="board-wrap">
      <Board
        {fen}
        {orientation}
        turnColor={sideToMove()}
        showTurn={trainer.state.status === 'solving'}
        turnLabel="play"
        movableColor={trainer.state.status === 'solving' ? sideToMove() : undefined}
        dests={trainer.state.status === 'solving' ? display.dests() : new Map()}
        {lastMove}
        check={display.inCheck()}
        {onMove}
      />
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    {#if trainer.state.status !== 'solving'}
      <button onclick={nextCard}>Next →</button>
    {/if}
  {/if}
</section>

<style>
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
