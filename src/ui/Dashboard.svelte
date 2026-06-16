<script lang="ts">
  import { app } from '../state/app.svelte';
  import Radar from './Radar.svelte';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { buildWeaknessProfile, drillTarget, type WeaknessProfile, type Dimension } from '../analysis/weakness';
  import { poolRating } from '../store/playerModel';
  import { t, tn, getLocale } from '../i18n';

  let profile = $state<WeaknessProfile | null>(null);
  let loading = $state(true);

  const model = $derived(app.model);

  // Dimension labels resolve through the bilingual catalogue (dim.* — full labels), single-sourced (V2-W18).
  $effect(() => {
    void getLocale(); // re-localize dimension detail on a language switch
    void load();
  });

  async function load() {
    loading = true;
    const analyses = await loadAllAnalyses();
    const rating = model ? poolRating(model, 'classical').rating : 1200;
    profile = analyses.length ? buildWeaknessProfile(analyses, rating, getLocale()) : null;
    loading = false;
  }

  function drill(dim: Dimension) {
    const t = drillTarget(dim);
    app.tacticsFilterThemes = t.themes ?? null;
    app.tacticsTimed = t.timed ?? false;
    app.go(t.view);
  }

  function scoreColor(score: number): string {
    if (score >= 60) return 'var(--good)';
    if (score >= 40) return 'var(--text)';
    return 'var(--bad)';
  }
</script>

<section class="col" style="max-width:680px;margin:0 auto">
  <h2>{t('dashboard.title')}</h2>

  {#if loading}
    <p class="muted">{t('dashboard.loading')}</p>
  {:else if !profile}
    <div class="panel col center">
      <p>{t('dashboard.noGamesTitle')}</p>
      <p class="muted">{t('dashboard.noGamesBody')}</p>
      <button onclick={() => app.go('import')}>{t('dashboard.analyseGame')}</button>
    </div>
  {:else}
    <p class="muted">
      {t('dashboard.basedOn', {
        games: tn(profile.gamesAnalyzed, 'dashboard.gamesOne', 'dashboard.gamesMany'),
        moves: profile.playerMoves,
      })}
    </p>

    <Radar dimensions={profile.dimensions} />

    <div class="row">
      <button onclick={() => app.go('insights')}>{t('dashboard.insightsLink')}</button>
    </div>

    <div class="col">
      {#each profile.dimensions as d}
        <div class="dim-row panel">
          <div style="flex:1">
            <div class="row" style="justify-content:space-between">
              <b>{t('dim.' + d.dimension)}</b>
              <span style="color:{scoreColor(d.score)};font-weight:700">{d.score}</span>
            </div>
            <span class="muted" style="font-size:0.85rem">{d.detail}</span>
            {#if d.sampleSize < 3}<span class="muted" style="font-size:0.75rem">{t('dashboard.lowData')}</span>{/if}
          </div>
          <div class="row" style="gap:0.4rem;align-items:center">
            <button onclick={() => drill(d.dimension)}>{d.dimension === 'resilience' ? t('dashboard.defend') : t('dashboard.drill')}</button>
            {#if d.dimension === 'timeManagement'}
              <button class="link" onclick={() => app.go('when-to-think')}>{t('dashboard.trainWhenToThink')}</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if profile.weakest}
      <p class="feedback">
        {t('dashboard.biggestOpportunity')} <b>{t('dim.' + profile.weakest)}</b>.
        <button class="link" onclick={() => drill(profile!.weakest!)}>{t('dashboard.trainItNow')}</button>
      </p>
    {/if}
  {/if}
</section>

<style>
  .dim-row { display: flex; align-items: center; gap: 1rem; }
  button.link { background: none; border: none; color: var(--accent); padding: 0; text-decoration: underline; cursor: pointer; }
</style>
