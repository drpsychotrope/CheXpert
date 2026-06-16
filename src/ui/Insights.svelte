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
  import { t, fmtPct } from '../i18n';

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
  <h2>{t('insights.title')}</h2>
  {#if loading}
    <p class="muted">{t('insights.loading')}</p>
  {:else if leaks.length === 0 && trend.length === 0}
    <div class="panel col center">
      <p>{t('insights.noGamesTitle')}</p>
      <p class="muted">{t('insights.noGamesBody')}</p>
      <button onclick={() => app.go('play')}>{t('insights.playGame')}</button>
    </div>
  {:else}
    <button onclick={() => app.go('session')} style="align-self:flex-start">{t('insights.startSession')}</button>
    <button onclick={() => app.go('coach')} style="align-self:flex-start">{t('insights.coachingAssessment')}</button>
    <h3>{t('insights.topLeaks')}</h3>
    {#if leaks.length}
      <div class="col" style="gap:0.3rem">
        {#each leaks as l (l.key)}
          <div class="row panel" style="justify-content:space-between;align-items:center;gap:1rem">
            <div>
              <b>{l.motif}</b> <span class="muted" style="font-size:0.8rem">{l.phase}</span><br />
              <span class="muted" style="font-size:0.82rem">{t('insights.leakStat', { count: l.count, pct: fmtPct(l.avgWpl) })}</span>
            </div>
            <button onclick={() => drillLeak(l)}>{t('insights.drill')}</button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="muted">{t('insights.notEnoughMistakes')}</p>
    {/if}

    {#if efficacy.length}
      <h3>{t('insights.didItMove')}</h3>
      <p class="muted" style="font-size:0.75rem">
        {t('insights.didItMoveBody')}
      </p>
      <div class="col" style="gap:0.3rem">
        {#each efficacy as e (e.motifKey)}
          <div class="panel" style="opacity:{e.enoughData ? 1 : 0.5}">
            <b>{e.label}</b>
            {#if e.enoughData}
              <span style="font-size:0.85rem">
                {t('insights.missRate', { early: fmtPct(e.early.missRate * 100), recent: fmtPct(e.recent.missRate * 100) })}
                <span style="color:{e.deltaPct <= 0 ? 'var(--good)' : 'var(--bad)'}">
                  {t('insights.deltaPts', { sign: e.deltaPct <= 0 ? '' : '+', pts: Math.round(e.deltaPct * 100) })}
                </span>
              </span>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:80px;height:20px;background:var(--panel-2);border-radius:3px;vertical-align:middle">
                <polyline
                  points="0,{100 - Math.round(e.early.missRate * 100)} 100,{100 - Math.round(e.recent.missRate * 100)}"
                  fill="none" stroke="var(--accent)" stroke-width="3" vector-effect="non-scaling-stroke" />
              </svg>
              <br /><span class="muted" style="font-size:0.75rem">
                {t('insights.earlyRecent', { earlyMisses: e.early.misses, earlyMoves: e.early.playerMoves, recentMisses: e.recent.misses, recentMoves: e.recent.playerMoves })}
              </span>
            {:else}
              <span class="muted" style="font-size:0.8rem">{t('insights.tooLittleData')}</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <h3>
      {t('insights.studyPlan')}
      <select bind:value={minutes} style="margin-left:0.5rem">
        <option value={15}>{t('insights.min15')}</option>
        <option value={30}>{t('insights.min30')}</option>
        <option value={60}>{t('insights.min60')}</option>
      </select>
    </h3>
    <div class="col" style="gap:0.2rem">
      {#each plan as item}
        <div class="panel">
          <b>{t('insights.planItem', { minutes: item.minutes, activity: item.activity })}</b> — {item.focus}<br />
          <span class="muted" style="font-size:0.8rem">{item.reason}</span>
        </div>
      {/each}
    </div>

    {#if trend.length >= 2}
      <h3>{t('insights.progress')} <span class="muted" style="font-size:0.8rem">{t('insights.windowsOfGames', { n: trend.length })}</span></h3>
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
        <p class="muted" style="font-size:0.75rem">{t('insights.scorePerWindow')}</p>
      </div>
    {/if}

    {#if metacog && cal && cal.reportedAttempts > 0}
      <h3>{t('insights.calibration')}</h3>
      {#if cal.readout}
        <div class="panel col" style="gap:0.4rem">
          <p>{cal.readout.sentence}</p>
          <div class="col" style="gap:0.15rem">
            {#each cal.byConfidence as r}
              <div class="row" style="align-items:center;gap:0.6rem">
                <span style="width:80px;font-size:0.82rem;text-transform:capitalize">{r.confidence}</span>
                <span style="font-size:0.82rem">{r.n ? fmtPct(r.accuracy * 100) : '—'}</span>
                <span class="muted" style="font-size:0.78rem">({r.correct}/{r.n})</span>
              </div>
            {/each}
          </div>
          {#if cal.readout.topCause}
            <p style="font-size:0.85rem">{t('insights.topCause')}
              <b>{SELF_TAG_LABELS[cal.readout.topCause.tag]}</b> {t('insights.topCausePct', { pct: fmtPct(cal.readout.topCause.pct * 100) })}
            </p>
          {/if}
          {#if cal.selfTags.length}
            <div class="col" style="gap:0.1rem">
              {#each cal.selfTags as tag}
                <span class="muted" style="font-size:0.8rem">{t('insights.selfTagLine', { label: SELF_TAG_LABELS[tag.tag], n: tag.n, pct: fmtPct(tag.pct * 100) })}</span>
              {/each}
            </div>
          {/if}
          <p class="muted" style="font-size:0.75rem">{t('insights.calibrationDescriptive')}</p>
        </div>
      {:else}
        <p class="muted">{t('insights.calibrationNeedsMore', { reported: cal.reportedAttempts })}</p>
      {/if}
    {/if}
  {/if}
</section>
