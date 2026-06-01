<script lang="ts">
  // Shared analysis result panel — used by Import (pasted PGN) AND Play's one-click
  // "Analyse this game" (ADR-0022). Stat row + win% curve + critical moments + a
  // read-only board for the selected moment + the explained-mistakes list.
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import EvalGraph from './EvalGraph.svelte';
  import { explainPly } from '../analysis/explain';
  import { criticalMoments } from '../analysis/criticalMoments';
  import type { GameAnalysis } from '../analysis/types';

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
  const selEx = $derived(selPly ? explainPly(selPly) : null);
  const mistakes = $derived(
    analysis.plies
      .filter((p) => p.color === analysis.playerColor && (p.severity === 'mistake' || p.severity === 'blunder'))
      .map((p) => ({ ply: p, ex: explainPly(p) })),
  );
</script>

<div class="row" style="gap:1.5rem">
  <div><b style="font-size:1.5rem">{analysis.acpl}</b><br /><span class="muted">your ACPL</span></div>
  <div><b style="font-size:1.5rem;color:var(--bad)">{analysis.blunders}</b><br /><span class="muted">blunders</span></div>
  <div><b style="font-size:1.5rem">{analysis.mistakes}</b><br /><span class="muted">mistakes</span></div>
  <div><b style="font-size:1.5rem">{analysis.inaccuracies}</b><br /><span class="muted">inaccuracies</span></div>
</div>

<EvalGraph {analysis} selected={selectedPly} onSelect={(i) => (selectedPly = i)} />

<div class="row" style="gap:1rem;font-size:0.85rem">
  {#each PHASES as ph}
    {#if analysis.byPhase[ph].plies > 0}
      <span class="muted">{ph} ACPL <b style="color:var(--text)">{Math.round(analysis.byPhase[ph].acpl)}</b></span>
    {/if}
  {/each}
</div>

{#if moments.length}
  <div class="col" style="gap:0.2rem">
    <h4>Critical moments</h4>
    {#each moments as m (m.plyIndex)}
      <button class="moment {selectedPly === m.plyIndex ? 'sel' : ''}" onclick={() => (selectedPly = m.plyIndex)}>
        <span>Move {m.ply.moveNumber} <b>{m.ply.san}</b></span>
        <span class="muted">{m.side === 'player' ? 'you' : 'opponent'}</span>
        <span class="muted">−{Math.round(m.winProbLoss)}%</span>
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
  </div>
{/if}

{#if puzzlesMade > 0}
  <p class="feedback good">
    Created {puzzlesMade} personalised {puzzlesMade === 1 ? 'puzzle' : 'puzzles'} from your
    mistakes — find them in <button class="link" onclick={() => app.go('tactics')}>Tactics</button>.
  </p>
{:else}
  <p class="muted">No clear-cut, unique-solution mistakes found to turn into puzzles.</p>
{/if}
<div class="row">
  <button onclick={() => app.go('dashboard')}>See your weakness dashboard →</button>
</div>

{#if mistakes.length}
  <h4>Your mistakes, explained</h4>
  <div class="col" style="gap:0.4rem">
    {#each mistakes as m (m.ply.ply)}
      <details class="mistake">
        <summary>
          <span>Move {m.ply.moveNumber}: <b>{m.ply.san}</b></span>
          <span class="muted sev">{m.ply.severity}</span>
          <span class="muted">−{Math.round(m.ply.winProbLoss)}% win</span>
        </summary>
        <div class="why">
          {#each m.ex.reasons as r}<p>{r}</p>{/each}
          {#if m.ex.better}<p class="better">{m.ex.better}</p>{/if}
        </div>
      </details>
    {/each}
  </div>
  <p class="muted" style="font-size:0.75rem">
    Explanations are rule-based and derived only from the engine's own evaluation — never invented.
    When we can't name a specific tactical pattern, we say so rather than guess.
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
