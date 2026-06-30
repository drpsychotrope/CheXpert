<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import SolutionReveal from './SolutionReveal.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { TacticalTrainer, gradeAttempt } from '../trainer/TacticalTrainer';
  import type { Puzzle } from '../trainer/puzzle';
  import { dueCards, reviewItem, allCards } from '../srs/SrsStore';
  import { resultToGrade, intervalLabel } from '../srs/fsrs';
  import { allAttempts } from '../store/attemptsRepo';
  import { interleave, buildLapseSet } from '../srs/schedule';
  import { createSet, saveSet } from '../woodpecker/woodpecker';
  import { missWhy } from '../concepts/concepts';
  import { t, tn, getLocale } from '../i18n';

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
  // F4: opt-in "Show solution" on a miss (Q-D / AP-TEACH-4). Reset per card so it never
  // carries over; toggled on only when the user taps the button.
  let showSolution = $state(false);

  const model = $derived(app.model);

  async function loadQueue() {
    loading = true;
    const now = Date.now();
    const due = await dueCards(now, 'puzzle', 100);
    // Interleave by theme (desirable difficulty) so consecutive cards differ where possible.
    const ids = due.map((c) => c.refId);
    // byId is async now (working set + DB fallback); prefetch themes so interleave's key stays sync (W3).
    const themeById = new Map<string, string>();
    await Promise.all(ids.map(async (id) => themeById.set(id, (await app.puzzles.byId(id))?.themes?.[0] ?? '')));
    queue = interleave(ids, (id) => themeById.get(id) ?? '');
    index = 0;
    reviewed = 0;
    // Schedule transparency for the empty state: how many puzzle cards exist + when the next is due.
    const puz = (await allCards()).filter((c) => c.kind === 'puzzle');
    scheduledCount = puz.length;
    const soonest = puz.filter((c) => c.due > now).sort((a, b) => a.due - b.due)[0];
    nextDue = soonest ? intervalLabel(soonest, now) : '';
    if (queue.length) await loadCurrent();
    loading = false;
  }

  async function findPuzzle(id: string): Promise<Puzzle | null> {
    return app.puzzles.byId(id);
  }

  async function loadCurrent() {
    feedback = '';
    feedbackKind = '';
    showSolution = false;
    while (index < queue.length) {
      const p = await findPuzzle(queue[index]);
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

  async function onMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!trainer || !puzzle || trainer.state.status !== 'solving') return;
    const uci = from + to + (display.isPromotion(from, to) ? promo : '');
    const res = trainer.playUserMove(uci);

    if (res === 'wrong') {
      feedback = t('review.missed');
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
      feedback = t('review.solved');
      feedbackKind = 'good';
      await grade(true);
    } else {
      feedback = t('review.keepGoing');
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
      // Snapshot the $state puzzle — a proxy can't be structured-cloned by IndexedDB.
      await app.puzzles.savePuzzle({ ...$state.snapshot(puzzle), rating: Math.round(graded.puzzle.rating), ratingDeviation: Math.round(graded.puzzle.rd) });
      await app.persistModel(Date.now());
    }
    reviewed += 1;
  }

  function nextCard() {
    index += 1;
    if (index < queue.length) void loadCurrent();
    else {
      trainer = null;
      puzzle = null;
    }
  }

  /** Build a fixed "Your misses" Woodpecker set from the puzzles you fail most (any source). */
  async function buildMissesSet() {
    const attempts = (await allAttempts()) as Array<{ puzzleId: string; solved: boolean }>;
    const ids = buildLapseSet(attempts, 12);
    if (!ids.length) {
      missesMsg = t('review.noFailedPuzzles');
      return;
    }
    await saveSet(createSet('wp:lapses', 'Your misses', ids, Date.now()));
    missesMsg = t('review.builtMissesSet', { n: ids.length });
  }

  $effect(() => {
    if (model && loading) void loadQueue();
  });
</script>

<section class="col center">
  <h2>{t('review.title')}</h2>
  <p class="muted">{t('review.subtitle')}</p>

  {#if loading}
    <p class="muted">{t('review.loadingQueue')}</p>
  {:else if queue.length === 0}
    <div class="panel col center">
      <p>{t('review.nothingDue')}</p>
      {#if scheduledCount > 0}
        <p class="muted">{tn(scheduledCount, 'review.scheduledOne', 'review.scheduledMany')}{nextDue ? t('review.nextDueSuffix', { when: nextDue }) : ''}{t('review.scheduledTail')}</p>
      {:else}
        <p class="muted">{t('review.emptyHint')}</p>
      {/if}
      <button onclick={() => app.go('tactics')}>{t('review.goToTactics')}</button>
      <button class="ghost" onclick={buildMissesSet}>{t('review.buildMisses')}</button>
      {#if missesMsg}<p class="muted" style="font-size:0.85rem">{missesMsg}</p>{/if}
    </div>
  {:else if !trainer}
    <div class="panel col center">
      <p>{tn(reviewed, 'review.completeOne', 'review.completeMany')}</p>
      <button onclick={loadQueue}>{t('review.checkForMore')}</button>
      <button class="ghost" onclick={buildMissesSet}>{t('review.buildMisses')}</button>
      {#if missesMsg}<p class="muted" style="font-size:0.85rem">{missesMsg}</p>{/if}
    </div>
  {:else}
    <p class="muted">{t('review.cardProgress', { index: index + 1, total: queue.length, reviewed })}</p>
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
        onMoveText={(t) => {
          if (!trainer || !puzzle || trainer.state.status !== 'solving') return false;
          const r = display.resolveMove(t);
          if (!r) return false;
          void onMove(r.from, r.to, r.promo ?? 'q');
          return true;
        }}
      />
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    {#if trainer.state.status === 'failed' && puzzle}
      <!-- F4: opt-in "Show solution" on a miss (Q-D), identical to Tactics. Non-blocking;
           theme-derived pattern hint via missWhy (null when no high-confidence motif). -->
      <button class="link" onclick={() => (showSolution = !showSolution)}>
        {showSolution ? t('reveal.hideSolution') : t('reveal.showSolution')}
      </button>
      {#if showSolution}
        <SolutionReveal
          fen={puzzle.fen}
          moves={puzzle.moves}
          {orientation}
          why={missWhy(puzzle.themes, getLocale())}
          autoplay
        />
      {/if}
    {/if}
    {#if trainer.state.status !== 'solving'}
      <button onclick={nextCard}>{t('review.next')}</button>
    {/if}
  {/if}
</section>

<style>
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  button.link { background: none; border: none; color: var(--accent); padding: 0 0 0 0.4rem; text-decoration: underline; cursor: pointer; }
</style>
