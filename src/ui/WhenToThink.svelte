<script lang="ts">
  // "When to think" critical-moment drill (ADR-0038): recognition trainer over the
  // player's STORED game analyses. Show a player-to-move position on a READ-ONLY
  // board, ask CRITICAL (invest time) vs ROUTINE (play fast), then reveal the REAL
  // win-probability swing that hung on the move + the existing explainPly text.
  // NO engine call (comeback/eval-graph precedent). NO accuracy grade — the tally
  // is directional practice (honesty doctrine, ADR-0021; AP-CMD-1). Reached from
  // the Dashboard time-management row (no top-nav entry, Q-F).
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import {
    buildDrillSet,
    scoreCall,
    shuffled,
    type DrillItem,
    type DrillLabel,
    type CallResult,
  } from '../analysis/criticalMomentDrill';
  import { fallbackDrillItems } from '../analysis/criticalMomentFallback';
  import { explainPly, type Explanation } from '../analysis/explain';
  import { t, tn, fmtPct, getLocale } from '../i18n';

  let items = $state<DrillItem[]>([]);
  let idx = $state(0);
  let status = $state<'loading' | 'empty' | 'drilling'>('loading');
  let usingFallback = $state(false);
  let revealed = $state(false);
  let result = $state<CallResult | null>(null);
  let right = $state(0);
  let total = $state(0);

  const current = $derived(items[idx] ?? null);
  const hasNext = $derived(idx + 1 < items.length);
  // POV from the side to move in fenBefore: FEN field 2 is 'w' or 'b'.
  const toMove = $derived(current ? (current.fenBefore.split(' ')[1] === 'b' ? 'black' : 'white') : 'white');
  const explanation = $derived<Explanation | null>(current ? explainPly(current.ply, getLocale()) : null);

  onMount(async () => {
    let built: DrillItem[] = [];
    try {
      // Rand injected AT THE CALL SITE (AP-CMD-4); core stays pure.
      built = buildDrillSet(await loadAllAnalyses(), Math.random, {});
    } catch {
      built = [];
    }
    if (built.length === 0) {
      // Fallback: same scoreCall/reveal path; shuffle with the same injected rand.
      built = shuffled(fallbackDrillItems(), Math.random);
      usingFallback = true;
    }
    items = built;
    status = items.length === 0 ? 'empty' : 'drilling';
  });

  function call(label: DrillLabel) {
    if (!current || revealed) return;
    result = scoreCall(current, label);
    revealed = true;
    total += 1;
    if (result.correct) right += 1;
  }

  function next() {
    if (hasNext) idx += 1;
    revealed = false;
    result = null;
  }

  function restart() {
    items = shuffled(items, Math.random);
    idx = 0;
    revealed = false;
    result = null;
    right = 0;
    total = 0;
  }

  const atEnd = $derived(revealed && !hasNext);
</script>

<section class="col center" style="max-width:680px;margin:0 auto">
  <h2>{t('whenToThink.title')}</h2>

  {#if status === 'loading'}
    <p class="muted">{t('whenToThink.loadingPositions')}</p>
  {:else if status === 'empty'}
    <div class="panel col center">
      <p>{t('whenToThink.emptyTitle')}</p>
      <p class="muted">{t('whenToThink.emptyBody')}</p>
      <button onclick={() => app.go('import')}>{t('whenToThink.analyseAGame')}</button>
    </div>
  {:else if current}
    <p class="muted">
      {t('whenToThink.positionIntro', { idx: idx + 1, total: items.length })}{usingFallback ? t('whenToThink.sampleSuffix') : ''}{t('whenToThink.positionTail')}
    </p>

    <div class="board-wrap">
      <Board fen={current.fenBefore} orientation={toMove} viewOnly />
    </div>

    <p class="prompt">
      {@html t('whenToThink.toMovePrompt', { color: toMove === 'white' ? t('color.white') : t('color.black') })}
    </p>

    {#if !revealed}
      <div class="row center">
        <button onclick={() => call('critical')}>{t('whenToThink.callCritical')}</button>
        <button class="ghost" onclick={() => call('routine')}>{t('whenToThink.callRoutine')}</button>
      </div>
    {:else if result}
      <div class="panel col reveal {result.correct ? 'good' : 'bad'}">
        <p class="verdict">
          {@html t('whenToThink.verdict', {
            judgement: result.correct ? t('whenToThink.verdictCorrect') : t('whenToThink.verdictNotQuite'),
            truth: result.truth === 'critical' ? t('whenToThink.truthCritical') : t('whenToThink.truthRoutine'),
          })}
        </p>
        <p class="swing">
          {#if result.truth === 'critical'}
            {@html t('whenToThink.swingCritical', { pct: fmtPct(Math.round(current.winProbLoss)) })}
          {:else}
            {@html t('whenToThink.swingRoutine', { pct: fmtPct(Math.round(current.winProbLoss)) })}
          {/if}
        </p>
        {#if explanation}
          <p class="headline">{explanation.headline}</p>
          {#each explanation.reasons as reason}
            <p class="muted reason">{reason}</p>
          {/each}
          {#if explanation.better}<p class="better">{explanation.better}</p>{/if}
        {/if}
      </div>

      <div class="row center">
        {#if hasNext}
          <button onclick={next}>{t('whenToThink.next')}</button>
        {/if}
        <button class="ghost" onclick={restart}>{t('whenToThink.restart')}</button>
        <button class="ghost" onclick={() => app.go('dashboard')}>{t('whenToThink.backToDashboard')}</button>
      </div>
    {/if}

    <p class="tally muted">
      {tn(total, 'whenToThink.tallyOne', 'whenToThink.tallyMany', { right })}
      {#if atEnd}{t('whenToThink.tallyEnd')}{/if}
    </p>
  {/if}
</section>

<style>
  .board-wrap { display: flex; justify-content: center; }
  .prompt { margin: 0.4rem 0; }
  .reveal { gap: 0.3rem; padding: 0.75rem; }
  .reveal.good { border-left: 3px solid var(--good); }
  .reveal.bad { border-left: 3px solid var(--bad); }
  .verdict { margin: 0; font-weight: 700; }
  .swing { margin: 0.2rem 0; }
  .headline { margin: 0.3rem 0 0; font-weight: 600; }
  .reason { font-size: 0.85rem; margin: 0.1rem 0; }
  .better { margin: 0.2rem 0 0; }
  .tally { font-size: 0.85rem; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
