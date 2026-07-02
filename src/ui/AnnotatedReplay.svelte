<script lang="ts">
  // Move-by-move annotated replay (PR-08, ADR-0066). The per-ply data the analysis has ALWAYS
  // stored (severity, evals, cpLoss, secondsSpent, explanations) finally gets its standard
  // game-review surface: a NAG-annotated move list, a driven board, keyboard navigation, and a
  // per-move detail line. No engine at replay time — everything is read from the stored analysis.
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { explainPly } from '../analysis/explain';
  import { moveRows, evalLabel, clampIndex } from '../analysis/replay';
  import { isOnlyMove } from '../analysis/onlyMove';
  import type { GameAnalysis } from '../analysis/types';
  import { t, getLocale } from '../i18n';

  interface Props {
    analysis: GameAnalysis;
    /** Ply cursor (-1 = starting position). Parent-owned so the eval graph and the critical-
     *  moment buttons can drive the same replay. */
    index: number;
    onIndexChange: (i: number) => void;
  }
  let { analysis, index, onIndexChange }: Props = $props();

  const plies = $derived(analysis.plies);
  const idx = $derived(clampIndex(index, plies.length));
  const cur = $derived(idx >= 0 ? plies[idx] : null);
  const fen = $derived(cur ? cur.fenAfter : (plies[0]?.fenBefore ?? '8/8/8/8/8/8/8/8 w - - 0 1'));
  const lastMove = $derived<[string, string] | null>(cur ? [cur.uci.slice(0, 2), cur.uci.slice(2, 4)] : null);
  const orientation = $derived(analysis.playerColor === 'b' ? 'black' : 'white');
  const rows = $derived(moveRows(plies, analysis.playerColor));
  const ex = $derived(cur && (cur.severity === 'inaccuracy' || cur.severity === 'mistake' || cur.severity === 'blunder') ? explainPly(cur, getLocale()) : null);

  function go(i: number) {
    onIndexChange(clampIndex(i, plies.length));
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(-1); }
    else if (e.key === 'End') { e.preventDefault(); go(plies.length - 1); }
  }

  // Keep the current move visible as navigation runs.
  let listEl = $state<HTMLElement | null>(null);
  $effect(() => {
    void idx;
    const sel = listEl?.querySelector('.half.cur');
    (sel as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  });
</script>

<!-- The region IS the keyboard-navigation surface (arrows/Home/End), labeled as such for AT; the
     inner buttons remain the click path — hence the two targeted ignores. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="replay" tabindex="0" role="region" aria-label={t('replay.region')} onkeydown={onKey}>
  <div class="board-side">
    <div class="board-wrap" style="--board-size: 300px">
      <Board {fen} {orientation} viewOnly={true} lastMove={lastMove} coords={false} />
    </div>
    <div class="nav">
      <button class="ghost" onclick={() => go(-1)} disabled={idx < 0} aria-label={t('replay.first')}>⏮</button>
      <button class="ghost" onclick={() => go(idx - 1)} disabled={idx < 0} aria-label={t('replay.prev')}>◀</button>
      <button class="ghost" onclick={() => go(idx + 1)} disabled={idx >= plies.length - 1} aria-label={t('replay.next')}>▶</button>
      <button class="ghost" onclick={() => go(plies.length - 1)} disabled={idx >= plies.length - 1} aria-label={t('replay.last')}>⏭</button>
    </div>
    {#if cur}
      <div class="detail">
        <span><b>{cur.moveNumber}{cur.color === 'w' ? '.' : '…'} {cur.san}</b> · {evalLabel(cur)}</span>
        {#if cur.cpLoss > 0 && cur.severity !== 'best' && cur.severity !== 'good'}
          <span class="muted">−{cur.cpLoss} cp</span>
        {/if}
        {#if cur.secondsSpent != null}
          <span class="muted">{t('replay.spent', { s: Math.round(cur.secondsSpent) })}</span>
        {/if}
        <!-- PR-21 (ADR-0079): the best move stood alone here — measured, never guessed. -->
        {#if isOnlyMove(cur)}
          <span class="only-move">{t('replay.onlyMove')}</span>
        {/if}
      </div>
      {#if ex}
        <p class="muted why">{ex.headline}</p>
        {#if ex.better}<p class="better">{ex.better}</p>{/if}
      {/if}
      <button class="link" onclick={() => { app.analysisFen = cur.fenBefore; app.go('analysis-board'); }}>
        {t('analysisResult.exploreThisPosition')}
      </button>
    {:else}
      <p class="muted why">{t('replay.startHint')}</p>
    {/if}
  </div>

  <ol class="moves" bind:this={listEl}>
    {#each rows as row (row.n)}
      <li>
        <span class="num">{row.n}.</span>
        {#each [row.white, row.black] as half, hi (hi)}
          {#if half}
            <button
              class="half {half.severity} {idx === half.i ? 'cur' : ''} {half.mine ? 'mine' : ''}"
              onclick={() => go(half.i)}
            >{half.san}{half.nag}</button>
          {:else}
            <span class="half gap">…</span>
          {/if}
        {/each}
      </li>
    {/each}
  </ol>
</div>

<style>
  .replay {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
    outline: none;
  }
  .replay:focus-visible { box-shadow: 0 0 0 2px var(--accent); border-radius: 8px; }
  .board-side { display: flex; flex-direction: column; gap: 0.4rem; align-items: center; }
  .nav { display: flex; gap: 0.35rem; }
  .nav button { padding: 0.2rem 0.7rem; }
  .detail { display: flex; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; flex-wrap: wrap; }
  .why { font-size: 0.85rem; max-width: 320px; text-align: center; margin: 0; }
  .better { color: var(--good); font-weight: 600; font-size: 0.85rem; margin: 0; }
  button.link { background: none; border: none; color: var(--accent); padding: 0; text-decoration: underline; cursor: pointer; font-size: 0.85rem; }
  .moves {
    flex: 1;
    min-width: 190px;
    max-height: 340px;
    overflow-y: auto;
    margin: 0;
    padding: 0.3rem 0.5rem;
    list-style: none;
    background: var(--panel-2);
    border-radius: 8px;
    font-size: 0.88rem;
    column-gap: 1rem;
  }
  .moves li { display: flex; gap: 0.4rem; align-items: baseline; }
  .num { color: var(--muted); min-width: 2ch; font-size: 0.8rem; }
  .half {
    background: none;
    border: none;
    color: var(--text);
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
    min-width: 3.2rem;
    text-align: left;
  }
  .half.gap { color: var(--muted); cursor: default; }
  .half.cur { background: var(--accent); color: #000; }
  .half.inaccuracy:not(.cur) { color: #d9c04a; }
  .half.mistake:not(.cur) { color: #e0965c; }
  .half.blunder:not(.cur) { color: var(--bad); }
  .half.mine { font-weight: 600; }
  .only-move { color: var(--accent); font-size: 0.78rem; font-weight: 600; border: 1px solid var(--accent); border-radius: 4px; padding: 0 0.3rem; }
</style>
