<script lang="ts">
  // Insights (spec A / ADR-0027): top recurring leaks + a daily study plan + a
  // progress trend, all recomputed from stored analyses. No engine, no LLM.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { buildWeaknessProfile, type Dimension } from '../analysis/weakness';
  import { buildFingerprint, weaknessTrend, type Leak, type TrendPoint } from '../analysis/fingerprint';
  import { buildStudyPlan } from '../analysis/studyPlan';

  let loading = $state(true);
  let leaks = $state<Leak[]>([]);
  let trend = $state<TrendPoint[]>([]);
  let weakest = $state<Dimension | null>(null);
  let minutes = $state(30);

  const model = $derived(app.model);
  const plan = $derived(buildStudyPlan(leaks, weakest, minutes));

  const DIMS: Dimension[] = ['tactics', 'openingAccuracy', 'endgameConversion', 'timeManagement', 'resilience'];
  const dimLabel: Record<Dimension, string> = {
    tactics: 'Tactics', openingAccuracy: 'Opening', endgameConversion: 'Endgame', timeManagement: 'Time', resilience: 'Resilience',
  };

  onMount(async () => {
    const analyses = await loadAllAnalyses();
    if (analyses.length) {
      leaks = buildFingerprint(analyses).leaks;
      trend = weaknessTrend(analyses, { window: 5 });
      weakest = buildWeaknessProfile(analyses, model?.gameRating.rating ?? 1200).weakest;
    }
    loading = false;
  });

  function drillLeak(l: Leak) {
    const m = l.motif.toLowerCase();
    if (l.key.startsWith('opening') || m.includes('opening')) return app.go('repertoire');
    if (l.key.startsWith('endgame') || l.phase === 'endgame' || m.includes('endgame')) return app.go('endgames');
    app.tacticsFilterThemes = [l.key];
    app.tacticsTimed = false;
    app.go('tactics');
  }

  function spark(d: Dimension): string {
    const n = trend.length;
    if (n < 2) return '';
    return trend.map((t, i) => `${(i / (n - 1)) * 100},${100 - (t.dims[d] ?? 50)}`).join(' ');
  }
  function delta(d: Dimension): number {
    if (trend.length < 2) return 0;
    return Math.round((trend[trend.length - 1].dims[d] ?? 50) - (trend[0].dims[d] ?? 50));
  }
</script>

<section class="col" style="max-width:680px;margin:0 auto">
  <h2>Insights</h2>
  {#if loading}
    <p class="muted">Loading…</p>
  {:else if leaks.length === 0 && trend.length === 0}
    <div class="panel col center">
      <p>No analysed games yet.</p>
      <p class="muted">Play and analyse games — your recurring leaks, a study plan, and your progress appear here.</p>
      <button onclick={() => app.go('play')}>Play a game →</button>
    </div>
  {:else}
    <h3>Your top leaks</h3>
    {#if leaks.length}
      <div class="col" style="gap:0.3rem">
        {#each leaks as l (l.key)}
          <div class="row panel" style="justify-content:space-between;align-items:center;gap:1rem">
            <div>
              <b>{l.motif}</b> <span class="muted" style="font-size:0.8rem">{l.phase}</span><br />
              <span class="muted" style="font-size:0.82rem">{l.count}× · avg −{Math.round(l.avgWpl)}% win</span>
            </div>
            <button onclick={() => drillLeak(l)}>Drill</button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="muted">Not enough flagged mistakes yet.</p>
    {/if}

    <h3>
      Study plan
      <select bind:value={minutes} style="margin-left:0.5rem">
        <option value={15}>15 min</option>
        <option value={30}>30 min</option>
        <option value={60}>60 min</option>
      </select>
    </h3>
    <div class="col" style="gap:0.2rem">
      {#each plan as item}
        <div class="panel">
          <b>{item.minutes}m · {item.activity}</b> — {item.focus}<br />
          <span class="muted" style="font-size:0.8rem">{item.reason}</span>
        </div>
      {/each}
    </div>

    {#if trend.length >= 2}
      <h3>Progress <span class="muted" style="font-size:0.8rem">({trend.length} windows of games)</span></h3>
      <div class="col" style="gap:0.3rem">
        {#each DIMS as d}
          <div class="row" style="align-items:center;gap:0.6rem">
            <span style="width:90px;font-size:0.82rem">{dimLabel[d]}</span>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:120px;height:24px;background:var(--panel-2);border-radius:3px">
              <polyline points={spark(d)} fill="none" stroke="var(--accent)" stroke-width="3" vector-effect="non-scaling-stroke" />
            </svg>
            <span style="font-size:0.82rem;color:{delta(d) >= 0 ? 'var(--good)' : 'var(--bad)'}">{delta(d) >= 0 ? '+' : ''}{delta(d)}</span>
          </div>
        {/each}
        <p class="muted" style="font-size:0.75rem">Score per window (higher = stronger). Directional, not a grade.</p>
      </div>
    {/if}
  {/if}
</section>
