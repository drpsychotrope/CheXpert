<script lang="ts">
  import { app } from '../state/app.svelte';
  import Radar from './Radar.svelte';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { buildWeaknessProfile, type WeaknessProfile, type Dimension } from '../analysis/weakness';

  let profile = $state<WeaknessProfile | null>(null);
  let loading = $state(true);

  const model = $derived(app.model);

  const dimLabels: Record<Dimension, string> = {
    tactics: 'Tactics',
    openingAccuracy: 'Opening accuracy',
    endgameConversion: 'Endgame conversion',
    timeManagement: 'Time management',
    resilience: 'Resilience',
  };

  // Map a weak dimension to puzzle themes for one-click drilling.
  const dimThemes: Record<Dimension, string[]> = {
    tactics: ['fork', 'pin', 'hangingPiece', 'mate', 'knightFork'],
    openingAccuracy: ['openingMistake'],
    endgameConversion: ['endgameMistake', 'rookEndgame'],
    timeManagement: [],
    resilience: [],
  };

  $effect(() => {
    void load();
  });

  async function load() {
    loading = true;
    const analyses = await loadAllAnalyses();
    const rating = model ? model.gameRating.rating : 1200;
    profile = analyses.length ? buildWeaknessProfile(analyses, rating) : null;
    loading = false;
  }

  function drill(dim: Dimension) {
    const themes = dimThemes[dim];
    app.tacticsFilterThemes = themes.length ? themes : null;
    app.go('tactics');
  }

  function scoreColor(score: number): string {
    if (score >= 60) return 'var(--good)';
    if (score >= 40) return 'var(--text)';
    return 'var(--bad)';
  }
</script>

<section class="col" style="max-width:680px;margin:0 auto">
  <h2>Weakness dashboard</h2>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if !profile}
    <div class="panel col center">
      <p>No analysed games yet.</p>
      <p class="muted">Import a game and analyse it — your weaknesses will appear here.</p>
      <button onclick={() => app.go('import')}>Analyse a game →</button>
    </div>
  {:else}
    <p class="muted">
      Based on {profile.gamesAnalyzed} analysed {profile.gamesAnalyzed === 1 ? 'game' : 'games'}
      ({profile.playerMoves} of your moves). The dashed ring is the typical level for your rating —
      inside it is a weakness. These are directional pointers, not a precise grade.
    </p>

    <Radar dimensions={profile.dimensions} />

    <div class="col">
      {#each profile.dimensions as d}
        <div class="dim-row panel">
          <div style="flex:1">
            <div class="row" style="justify-content:space-between">
              <b>{dimLabels[d.dimension]}</b>
              <span style="color:{scoreColor(d.score)};font-weight:700">{d.score}</span>
            </div>
            <span class="muted" style="font-size:0.85rem">{d.detail}</span>
            {#if d.sampleSize < 3}<span class="muted" style="font-size:0.75rem"> · low data</span>{/if}
          </div>
          {#if dimThemes[d.dimension].length > 0}
            <button onclick={() => drill(d.dimension)}>Drill</button>
          {/if}
        </div>
      {/each}
    </div>

    {#if profile.weakest}
      <p class="feedback">
        Biggest opportunity: <b>{dimLabels[profile.weakest]}</b>.
        <button class="link" onclick={() => drill(profile!.weakest!)}>Train it now →</button>
      </p>
    {/if}
  {/if}
</section>

<style>
  .dim-row { display: flex; align-items: center; gap: 1rem; }
  button.link { background: none; border: none; color: var(--accent); padding: 0; text-decoration: underline; cursor: pointer; }
</style>
