<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { TacticalTrainer } from '../trainer/TacticalTrainer';
  import {
    createSet, startCycle, currentCycle, nextIndex, recordResult, completeCycle,
    cycleStats, improvement, saveSet, listSets, deleteSet,
  } from '../woodpecker/woodpecker';
  import type { WoodpeckerSet } from '../woodpecker/types';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  let mode = $state<'list' | 'run'>('list');
  let sets = $state<WoodpeckerSet[]>([]);
  let setSize = $state(7);
  let active = $state<WoodpeckerSet | null>(null);

  let trainer = $state<TacticalTrainer | null>(null);
  let display = $state(new ChessGame());
  let fen = $state(START_FEN);
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');
  let puzzleStartedAt = 0;
  let cycleDone = $state(false);

  const model = $derived(app.model);

  async function refresh() {
    sets = await listSets();
  }
  $effect(() => {
    if (mode === 'list') void refresh();
  });

  async function makeSet() {
    if (!model) return;
    const ids: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < setSize; i++) {
      const p = app.puzzles.next({ rating: model.puzzleRating.rating, window: 400, exclude: seen });
      if (!p) break;
      seen.add(p.id);
      ids.push(p.id);
    }
    if (ids.length === 0) return;
    const now = Date.now();
    await saveSet(createSet(`wp:${now}`, `Set of ${ids.length}`, ids, now));
    await refresh();
  }

  async function beginCycle(set: WoodpeckerSet) {
    active = startCycle(set, Date.now());
    await saveSet(active);
    cycleDone = false;
    mode = 'run';
    loadCurrent();
  }

  function loadCurrent() {
    if (!active) return;
    const idx = nextIndex(active);
    if (idx < 0) {
      void finishCycle();
      return;
    }
    const p = app.puzzles.byId(active.puzzleIds[idx]);
    if (!p) {
      // A missing puzzle counts as an instant miss so the cycle still completes.
      active = recordResult(active, idx, false, 0);
      loadCurrent();
      return;
    }
    trainer = new TacticalTrainer(p, Date.now());
    display = new ChessGame(p.fen);
    fen = display.fen;
    feedback = '';
    feedbackKind = '';
    puzzleStartedAt = Date.now();
  }

  function side(): 'white' | 'black' {
    return display.turn === 'w' ? 'white' : 'black';
  }

  async function onMove(from: string, to: string) {
    if (!trainer || !active || trainer.state.status !== 'solving') return;
    const uci = from + to + (display.isPromotion(from, to) ? 'q' : '');
    const res = trainer.playUserMove(uci);
    const idx = nextIndex(active);

    if (res === 'wrong') {
      feedback = 'Missed — counts as a miss this cycle.';
      feedbackKind = 'bad';
      active = recordResult(active, idx, false, Date.now() - puzzleStartedAt);
      await saveSet(active);
      setTimeout(loadCurrent, 600);
      return;
    }
    display = new ChessGame(trainer.getFen());
    fen = display.fen;
    if (res === 'solved') {
      feedback = 'Solved ✔';
      feedbackKind = 'good';
      active = recordResult(active, idx, true, Date.now() - puzzleStartedAt);
      await saveSet(active);
      setTimeout(loadCurrent, 450);
    } else {
      feedback = 'Good — continue.';
      feedbackKind = 'good';
    }
  }

  async function finishCycle() {
    if (!active) return;
    active = completeCycle(active, Date.now());
    await saveSet(active);
    trainer = null;
    cycleDone = true;
  }

  async function remove(id: string) {
    if (!confirm('Delete this Woodpecker set?')) return;
    await deleteSet(id);
    await refresh();
  }

  function fmt(ms: number): string {
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  const lastImprovement = $derived(active ? improvement(active) : null);
</script>

<section class="col center">
  <h2>Woodpecker</h2>
  <p class="muted" style="max-width:560px">
    A <b>fixed</b> set of puzzles, solved again and again — faster each cycle — until the patterns are
    automatic. This complements spaced repetition: Review spreads many puzzles over time; Woodpecker
    drills one set to speed.
  </p>

  {#if mode === 'list'}
    <div class="row center">
      <label>Set size
        <select bind:value={setSize}>
          <option value={5}>5</option>
          <option value={7}>7</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
        </select>
      </label>
      <button onclick={makeSet} disabled={!model || app.puzzles.size === 0}>+ New set</button>
    </div>

    {#if sets.length === 0}
      <p class="muted">No sets yet — create one to start.</p>
    {:else}
      <div class="sets">
        {#each sets as s (s.id)}
          {@const completed = s.cycles.filter((c) => c.completedAt != null)}
          <div class="set-card">
            <div class="col" style="gap:0.2rem;align-items:flex-start">
              <b>{s.name}</b>
              <span class="muted" style="font-size:0.8rem">
                {s.puzzleIds.length} puzzles · {completed.length} cycle{completed.length === 1 ? '' : 's'} done
                {#if completed.length}· last {fmt(cycleStats(completed[completed.length - 1]).totalMs)}{/if}
              </span>
            </div>
            <div class="row">
              <button onclick={() => beginCycle(s)}>{completed.length ? 'Next cycle' : 'Start'}</button>
              <button class="ghost" onclick={() => remove(s.id)}>✕</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else if mode === 'run' && active}
    {@const cur = currentCycle(active)}
    {@const stats = cur ? cycleStats(cur) : null}
    <p class="muted">
      {active.name} · cycle {cur?.cycle ?? active.cycles.length}
      {#if stats}· {stats.solvedCount}/{stats.total} solved{/if}
    </p>

    {#if cycleDone}
      {@const done = active.cycles.filter((c) => c.completedAt != null)}
      <div class="panel col center">
        <h3>Cycle complete</h3>
        {#if done.length}
          {@const last = cycleStats(done[done.length - 1])}
          <p>Time: <b>{fmt(last.totalMs)}</b> · Accuracy: <b>{Math.round(last.accuracy * 100)}%</b></p>
        {/if}
        {#if lastImprovement}
          <p class={lastImprovement.fasterMs > 0 ? 'feedback good' : 'muted'}>
            {lastImprovement.fasterMs > 0
              ? `${fmt(lastImprovement.fasterMs)} faster than last cycle` +
                (lastImprovement.moreAccurate ? ' — and at least as accurate. ✔' : '.')
              : 'Not faster than last cycle yet — run it again.'}
          </p>
        {/if}
        <div class="row center">
          <button onclick={() => active && beginCycle(active)}>Run again →</button>
          <button class="ghost" onclick={() => (mode = 'list')}>← Sets</button>
        </div>
      </div>
    {:else}
      <div class="board-wrap">
        <Board
          {fen}
          orientation={side()}
          turnColor={side()}
          movableColor={trainer?.state.status === 'solving' ? side() : undefined}
          dests={trainer?.state.status === 'solving' ? display.dests() : new Map()}
          check={display.inCheck()}
          {onMove}
        />
      </div>
      <p class="feedback {feedbackKind}">{feedback}</p>
      <button class="ghost" onclick={() => (mode = 'list')}>Pause (progress saved)</button>
    {/if}
  {/if}
</section>

<style>
  .sets { display: flex; flex-direction: column; gap: 0.5rem; max-width: 560px; width: 100%; }
  .set-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem 0.9rem; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
