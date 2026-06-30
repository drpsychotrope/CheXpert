<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { TacticalTrainer } from '../trainer/TacticalTrainer';
  import {
    createSet, startCycle, currentCycle, nextIndex, recordResult, completeCycle,
    cycleStats, improvement, saveSet, listSets, deleteSet,
  } from '../woodpecker/woodpecker';
  import type { WoodpeckerSet } from '../woodpecker/types';
  import { t, tn, fmtPct } from '../i18n';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let pendingDelete = $state<string | null>(null); // themed delete confirm (audit v2 W14/H39)

  let mode = $state<'list' | 'run'>('list');
  let sets = $state<WoodpeckerSet[]>([]);
  let setSize = $state(7);
  let active = $state<WoodpeckerSet | null>(null);

  let trainer = $state<TacticalTrainer | null>(null);
  let display = $state(new ChessGame());
  let fen = $state(START_FEN);
  let orientation = $state<'white' | 'black'>('white'); // fixed per puzzle
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
      const p = await app.puzzles.next({ rating: model.puzzleRating.rating, window: 400, exclude: seen });
      if (!p) break;
      seen.add(p.id);
      ids.push(p.id);
    }
    if (ids.length === 0) return;
    const now = Date.now();
    await saveSet(createSet(`wp:${now}`, t('woodpecker.setName', { n: ids.length }), ids, now));
    await refresh();
  }

  async function beginCycle(set: WoodpeckerSet) {
    active = startCycle(set, Date.now());
    await saveSet(active);
    cycleDone = false;
    mode = 'run';
    void loadCurrent();
  }

  async function loadCurrent() {
    if (!active) return;
    const idx = nextIndex(active);
    if (idx < 0) {
      void finishCycle();
      return;
    }
    const p = await app.puzzles.byId(active.puzzleIds[idx]);
    if (!p) {
      // A missing puzzle counts as an instant miss so the cycle still completes.
      active = recordResult(active, idx, false, 0);
      await loadCurrent();
      return;
    }
    trainer = new TacticalTrainer(p, Date.now());
    display = new ChessGame(p.fen);
    fen = display.fen;
    orientation = display.turn === 'w' ? 'white' : 'black'; // fixed for the puzzle
    feedback = '';
    feedbackKind = '';
    puzzleStartedAt = Date.now();
  }

  function side(): 'white' | 'black' {
    return display.turn === 'w' ? 'white' : 'black';
  }

  async function onMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!trainer || !active || trainer.state.status !== 'solving') return;
    const uci = from + to + (display.isPromotion(from, to) ? promo : '');
    const res = trainer.playUserMove(uci);
    const idx = nextIndex(active);

    if (res === 'wrong') {
      feedback = t('woodpecker.missed');
      feedbackKind = 'bad';
      active = recordResult(active, idx, false, Date.now() - puzzleStartedAt);
      await saveSet(active);
      setTimeout(loadCurrent, 600);
      return;
    }
    display = new ChessGame(trainer.getFen());
    fen = display.fen;
    if (res === 'solved') {
      feedback = t('woodpecker.solved');
      feedbackKind = 'good';
      active = recordResult(active, idx, true, Date.now() - puzzleStartedAt);
      await saveSet(active);
      setTimeout(loadCurrent, 450);
    } else {
      feedback = t('woodpecker.continue');
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

  function remove(id: string) {
    pendingDelete = id;
  }
  async function confirmRemove() {
    const id = pendingDelete;
    pendingDelete = null;
    if (!id) return;
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
  <h2>{t('woodpecker.title')}</h2>
  <p class="muted" style="max-width:560px">
    {t('woodpecker.introLead')}<b>{t('woodpecker.introFixedBold')}</b>{t('woodpecker.introTail')}
  </p>

  {#if mode === 'list'}
    <div class="row center">
      <label>{t('woodpecker.setSize')}
        <select bind:value={setSize}>
          <option value={5}>5</option>
          <option value={7}>7</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
        </select>
      </label>
      <button onclick={makeSet} disabled={!model || app.puzzles.size === 0}>{t('woodpecker.newSet')}</button>
    </div>

    {#if sets.length === 0}
      <p class="muted">{t('woodpecker.noSets')}</p>
    {:else}
      <div class="sets">
        {#each sets as s (s.id)}
          {@const completed = s.cycles.filter((c) => c.completedAt != null)}
          <div class="set-card">
            <div class="col" style="gap:0.2rem;align-items:flex-start">
              <b>{s.name}</b>
              <span class="muted" style="font-size:0.8rem">
                {tn(completed.length, 'woodpecker.setSummaryOne', 'woodpecker.setSummaryMany', { puzzles: s.puzzleIds.length })}
                {#if completed.length}{t('woodpecker.lastTime', { time: fmt(cycleStats(completed[completed.length - 1]).totalMs) })}{/if}
              </span>
            </div>
            <div class="row">
              <button onclick={() => beginCycle(s)}>{completed.length ? t('woodpecker.nextCycle') : t('woodpecker.start')}</button>
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
      {t('woodpecker.runHeader', { name: active.name, cycle: cur?.cycle ?? active.cycles.length })}
      {#if stats}{t('woodpecker.runSolved', { solved: stats.solvedCount, total: stats.total })}{/if}
    </p>

    {#if cycleDone}
      {@const done = active.cycles.filter((c) => c.completedAt != null)}
      <div class="panel col center">
        <h3>{t('woodpecker.cycleComplete')}</h3>
        {#if done.length}
          {@const last = cycleStats(done[done.length - 1])}
          <p>{t('woodpecker.timeLabel')} <b>{fmt(last.totalMs)}</b>{t('woodpecker.accuracyLabel')} <b>{fmtPct(last.accuracy * 100)}</b></p>
        {/if}
        {#if lastImprovement}
          <p class={lastImprovement.fasterMs > 0 ? 'feedback good' : 'muted'}>
            {lastImprovement.fasterMs > 0
              ? t('woodpecker.faster', { time: fmt(lastImprovement.fasterMs) }) +
                (lastImprovement.moreAccurate ? t('woodpecker.fasterAndAccurate') : t('woodpecker.fasterPeriod'))
              : t('woodpecker.notFaster')}
          </p>
        {/if}
        <div class="row center">
          <button onclick={() => active && beginCycle(active)}>{t('woodpecker.runAgain')}</button>
          <button class="ghost" onclick={() => (mode = 'list')}>{t('woodpecker.backToSets')}</button>
        </div>
      </div>
    {:else}
      <div class="board-wrap">
        <Board
          {fen}
          {orientation}
          turnColor={side()}
          showTurn={trainer?.state.status === 'solving'}
          turnLabel="play"
          movableColor={trainer?.state.status === 'solving' ? side() : undefined}
          dests={trainer?.state.status === 'solving' ? display.dests() : new Map()}
          check={display.inCheck()}
          {onMove}
          onMoveText={(text) => {
            if (trainer?.state.status !== 'solving') return false;
            const r = display.resolveMove(text);
            if (!r) return false;
            void onMove(r.from, r.to, r.promo ?? 'q');
            return true;
          }}
        />
      </div>
      <p class="feedback {feedbackKind}">{feedback}</p>
      <button class="ghost" onclick={() => (mode = 'list')}>{t('woodpecker.pause')}</button>
    {/if}
  {/if}

  <ConfirmDialog
    open={pendingDelete !== null}
    title={t('woodpecker.deleteTitle')}
    body={t('woodpecker.deleteBody')}
    confirmLabel={t('woodpecker.deleteConfirm')}
    danger
    onConfirm={confirmRemove}
    onCancel={() => (pendingDelete = null)}
  />
</section>

<style>
  .sets { display: flex; flex-direction: column; gap: 0.5rem; max-width: 560px; width: 100%; }
  .set-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem 0.9rem; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
