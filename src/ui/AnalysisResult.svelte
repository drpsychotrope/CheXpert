<script lang="ts">
  // Shared analysis result panel — used by Import (pasted PGN) AND Play's one-click
  // "Analyse this game" (ADR-0022). Stat row + win% curve + critical moments + a
  // read-only board for the selected moment + the explained-mistakes list.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import EvalGraph from './EvalGraph.svelte';
  import { explainPly } from '../analysis/explain';
  import { criticalMoments } from '../analysis/criticalMoments';
  import { describeOpening, type OpeningName } from '../opening/eco';
  import { buildLine, saveLine } from '../repertoire/repertoire';
  import type { GameAnalysis } from '../analysis/types';
  import { t, tn, fmtPct, getLocale } from '../i18n';

  interface Props {
    analysis: GameAnalysis;
    puzzlesMade: number;
  }
  let { analysis, puzzlesMade }: Props = $props();

  const PHASES = ['opening', 'middlegame', 'endgame'] as const;
  let selectedPly = $state<number | null>(null);

  const moments = $derived(criticalMoments(analysis));
  const orientation = $derived(analysis.playerColor === 'b' ? 'black' : 'white');
  const selPly = $derived(selectedPly != null ? analysis.plies[selectedPly] : null);
  const selEx = $derived(selPly ? explainPly(selPly, getLocale()) : null);
  const mistakes = $derived(
    analysis.plies
      .filter((p) => p.color === analysis.playerColor && (p.severity === 'mistake' || p.severity === 'blunder'))
      .map((p) => ({ ply: p, ex: explainPly(p, getLocale()) })),
  );

  // Opening naming + repertoire-gap (ADR-0028).
  let opening = $state<OpeningName | null>(null);
  let repAdded = $state(false);
  onMount(async () => {
    opening = await describeOpening(analysis.plies.map((p) => p.uci));
  });
  async function addToRepertoire() {
    if (!opening) return;
    const sanPrefix = analysis.plies.slice(0, opening.plyInBook).map((p) => p.san);
    const res = buildLine(`rep:${analysis.gameId}`, opening.name, analysis.playerColor, sanPrefix, Date.now(), opening.name);
    if (res.ok && res.line) {
      await saveLine(res.line);
      repAdded = true;
    }
  }
</script>

<div class="row" style="gap:1.5rem">
  <div><b style="font-size:1.5rem">{analysis.acpl}</b><br /><span class="muted">{t('analysisResult.yourAcpl')}</span></div>
  <div><b style="font-size:1.5rem;color:var(--bad)">{analysis.blunders}</b><br /><span class="muted">{t('analysisResult.blunders')}</span></div>
  <div><b style="font-size:1.5rem">{analysis.mistakes}</b><br /><span class="muted">{t('analysisResult.mistakes')}</span></div>
  <div><b style="font-size:1.5rem">{analysis.inaccuracies}</b><br /><span class="muted">{t('analysisResult.inaccuracies')}</span></div>
</div>

{#if opening}
  <p class="muted" style="font-size:0.85rem">
    {t('analysisResult.opening')} <b>{opening.name}</b> ({opening.eco}) · {t('analysisResult.leftBook', { move: Math.floor(opening.plyInBook / 2) + 1 })}
    {#if repAdded}
      <span style="color:var(--good)">{t('analysisResult.addedToRep')}</span>
    {:else}
      <button class="link" onclick={addToRepertoire}>{t('analysisResult.addLineToRep')}</button>
    {/if}
  </p>
{/if}

<EvalGraph {analysis} selected={selectedPly} onSelect={(i) => (selectedPly = i)} />

<div class="row" style="gap:1rem;font-size:0.85rem">
  {#each PHASES as ph}
    {#if analysis.byPhase[ph].plies > 0}
      <span class="muted">{t('analysisResult.phaseAcpl', { phase: ph })} <b style="color:var(--text)">{Math.round(analysis.byPhase[ph].acpl)}</b></span>
    {/if}
  {/each}
</div>

{#if moments.length}
  <div class="col" style="gap:0.2rem">
    <h4>{t('analysisResult.criticalMoments')}</h4>
    {#each moments as m (m.plyIndex)}
      <button class="moment {selectedPly === m.plyIndex ? 'sel' : ''}" onclick={() => (selectedPly = m.plyIndex)}>
        <span>{t('analysisResult.moveLabel', { n: m.ply.moveNumber })} <b>{m.ply.san}</b></span>
        <span class="muted">{m.side === 'player' ? t('analysisResult.you') : t('analysisResult.opponent')}</span>
        <span class="muted">−{fmtPct(m.winProbLoss)}</span>
      </button>
    {/each}
  </div>
{/if}

{#if selPly && selEx}
  <div class="col center">
    <div class="board-wrap" style="max-width:340px;width:100%">
      <Board fen={selPly.fenBefore} {orientation} viewOnly={true} />
    </div>
    <p class="muted" style="font-size:0.85rem">{selEx.headline}</p>
    {#each selEx.reasons as r}<p class="muted" style="font-size:0.85rem">{r}</p>{/each}
    {#if selEx.better}<p class="better">{selEx.better}</p>{/if}
    <button class="link" onclick={() => { if (selPly) { app.analysisFen = selPly.fenBefore; app.go('analysis-board'); } }}>{t('analysisResult.exploreThisPosition')}</button>
  </div>
{/if}

{#if puzzlesMade > 0}
  <p class="feedback good">
    {tn(puzzlesMade, 'analysisResult.createdPuzzlesOne', 'analysisResult.createdPuzzlesMany')}<button class="link" onclick={() => app.go('tactics')}>{t('analysisResult.tacticsLink')}</button>{t('analysisResult.tacticsLinkSuffix')}
  </p>
{:else}
  <p class="muted">{t('analysisResult.noPuzzles')}</p>
{/if}
<div class="row">
  <button onclick={() => app.go('dashboard')}>{t('analysisResult.seeDashboard')}</button>
</div>

{#if mistakes.length}
  <h4>{t('analysisResult.mistakesExplained')}</h4>
  <div class="col" style="gap:0.4rem">
    {#each mistakes as m (m.ply.ply)}
      <details class="mistake">
        <summary>
          <span>{t('analysisResult.moveColon', { n: m.ply.moveNumber })} <b>{m.ply.san}</b></span>
          <span class="muted sev">{m.ply.severity}</span>
          <span class="muted">−{fmtPct(m.ply.winProbLoss)}{t('analysisResult.winSuffix')}</span>
        </summary>
        <div class="why">
          {#each m.ex.reasons as r}<p>{r}</p>{/each}
          {#if m.ex.better}<p class="better">{m.ex.better}</p>{/if}
        </div>
      </details>
    {/each}
  </div>
  <p class="muted" style="font-size:0.75rem">
    {t('analysisResult.explanationsNote')}
  </p>
{/if}

<style>
  button.link { background: none; border: none; color: var(--accent); padding: 0; text-decoration: underline; cursor: pointer; }
  h4 { color: var(--muted); margin: 0.5rem 0 0; }
  .moment { display: flex; justify-content: space-between; gap: 0.5rem; width: 100%; background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 4px; padding: 0.3rem 0.5rem; cursor: pointer; font-size: 0.85rem; }
  .moment.sel { border-color: var(--accent); }
  .better { color: var(--good); font-weight: 600; }
  .mistake { border-bottom: 1px solid var(--border); padding: 0.25rem 0; }
  .mistake summary { display: flex; justify-content: space-between; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; }
  .mistake summary .sev { text-transform: capitalize; }
  .mistake .why { padding: 0.4rem 0 0.2rem 1rem; font-size: 0.85rem; }
  .mistake .why p { margin: 0.2rem 0; }
  .mistake .why .better { color: var(--good); font-weight: 600; }
</style>
