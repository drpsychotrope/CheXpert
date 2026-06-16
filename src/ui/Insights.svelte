<script lang="ts">
  // Insights (spec A / ADR-0027): top recurring leaks + a daily study plan + a
  // progress trend, all recomputed from stored analyses. No engine, no LLM.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { buildWeaknessProfile, type Dimension } from '../analysis/weakness';
  import { buildFingerprint, leakTarget, weaknessTrend, type Leak, type TrendPoint } from '../analysis/fingerprint';
  import { buildStudyPlan } from '../analysis/studyPlan';
  import { motifEfficacy, type EfficacyReadout } from '../analysis/efficacy';
  import { poolRating } from '../store/playerModel';
  import { allAttempts } from '../store/attemptsRepo';
  import { calibration, SELF_TAG_LABELS, type Calibration, type MetacogAttempt } from '../metacog/metacog';

  let loading = $state(true);
  let leaks = $state<Leak[]>([]);
  let trend = $state<TrendPoint[]>([]);
  let weakest = $state<Dimension | null>(null);
  let minutes = $state(30);
  let cal = $state<Calibration | null>(null);
  let analysesAll = $state<import('../analysis/types').GameAnalysis[]>([]);

  // Descriptive before/after miss-rate for the top ~3 leaks (Q-D windows + minMoves gate).
  const efficacy = $derived<EfficacyReadout[]>(
    analysesAll.length ? leaks.slice(0, 3).map((l) => motifEfficacy(analysesAll, l.key)) : [],
  );
  const metacog = $derived(app.settings?.metacogEnabled ?? false);

  const model = $derived(app.model);
  const plan = $derived(buildStudyPlan(leaks, weakest, minutes));

  const DIMS: Dimension[] = ['tactics', 'openingAccuracy', 'endgameConversion', 'timeManagement', 'resilience'];
  const dimLabel: Record<Dimension, string> = {
    tactics: 'Tactics', openingAccuracy: 'Opening', endgameConversion: 'Endgame', timeManagement: 'Time', resilience: 'Resilience',
  };

  onMount(async () => {
    const analyses = await loadAllAnalyses();
    analysesAll = analyses;
    if (analyses.length) {
      leaks = buildFingerprint(analyses).leaks;
      trend = weaknessTrend(analyses, { window: 5, rating: model ? poolRating(model, 'classical').rating : 1200 });
      weakest = buildWeaknessProfile(analyses, model ? poolRating(model, 'classical').rating : 1200).weakest;
    }
    const attempts = (await allAttempts()) as MetacogAttempt[];
    cal = calibration(attempts);
    loading = false;
  });

  function drillLeak(l: Leak) {
    const t = leakTarget(l);
    if (t === 'repertoire') return app.go('repertoire');
    if (t === 'endgames') return app.go('endgames');
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
    <button onclick={() => app.go('session')} style="align-self:flex-start">▶ Start session</button>
    <button onclick={() => app.go('coach')} style="align-self:flex-start">▶ Coaching assessment</button>
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

    {#if efficacy.length}
      <h3>Did it move?</h3>
      <p class="muted" style="font-size:0.75rem">
        Descriptive, not proof. This shows your before/after miss-rate; it does not prove the training
        caused the change. "Personalised beats generic" stays plausible, not proven — the data is local so
        you can watch it for yourself.
      </p>
      <div class="col" style="gap:0.3rem">
        {#each efficacy as e (e.motifKey)}
          <div class="panel" style="opacity:{e.enoughData ? 1 : 0.5}">
            <b>{e.label}</b>
            {#if e.enoughData}
              <span style="font-size:0.85rem">
                miss rate {Math.round(e.early.missRate * 100)}% → {Math.round(e.recent.missRate * 100)}%
                <span style="color:{e.deltaPct <= 0 ? 'var(--good)' : 'var(--bad)'}">
                  ({e.deltaPct <= 0 ? '' : '+'}{Math.round(e.deltaPct * 100)} pts)
                </span>
              </span>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:80px;height:20px;background:var(--panel-2);border-radius:3px;vertical-align:middle">
                <polyline
                  points="0,{100 - Math.round(e.early.missRate * 100)} 100,{100 - Math.round(e.recent.missRate * 100)}"
                  fill="none" stroke="var(--accent)" stroke-width="3" vector-effect="non-scaling-stroke" />
              </svg>
              <br /><span class="muted" style="font-size:0.75rem">
                {e.early.misses}/{e.early.playerMoves} early · {e.recent.misses}/{e.recent.playerMoves} recent
              </span>
            {:else}
              <span class="muted" style="font-size:0.8rem">too little data to read a trend</span>
            {/if}
          </div>
        {/each}
      </div>
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

    {#if metacog && cal && cal.reportedAttempts > 0}
      <h3>Calibration</h3>
      {#if cal.readout}
        <div class="panel col" style="gap:0.4rem">
          <p>{cal.readout.sentence}</p>
          <div class="col" style="gap:0.15rem">
            {#each cal.byConfidence as r}
              <div class="row" style="align-items:center;gap:0.6rem">
                <span style="width:80px;font-size:0.82rem;text-transform:capitalize">{r.confidence}</span>
                <span style="font-size:0.82rem">{r.n ? Math.round(r.accuracy * 100) + '%' : '—'}</span>
                <span class="muted" style="font-size:0.78rem">({r.correct}/{r.n})</span>
              </div>
            {/each}
          </div>
          {#if cal.readout.topCause}
            <p style="font-size:0.85rem">Most common self-diagnosed cause:
              <b>{SELF_TAG_LABELS[cal.readout.topCause.tag]}</b> ({Math.round(cal.readout.topCause.pct * 100)}% of tagged misses).
            </p>
          {/if}
          {#if cal.selfTags.length}
            <div class="col" style="gap:0.1rem">
              {#each cal.selfTags as t}
                <span class="muted" style="font-size:0.8rem">{SELF_TAG_LABELS[t.tag]} — {t.n} ({Math.round(t.pct * 100)}%)</span>
              {/each}
            </div>
          {/if}
          <p class="muted" style="font-size:0.75rem">Descriptive, not a grade — this reflects how your confidence lines up with your results.</p>
        </div>
      {:else}
        <p class="muted">Calibration needs a few more reported attempts ({cal.reportedAttempts}/10 so far).</p>
      {/if}
    {/if}
  {/if}
</section>
