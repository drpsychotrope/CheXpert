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
  import { getAllGames } from '../store/gamesRepo';
  import { gameRatingSeries, puzzleRatingSeries, availablePools } from '../analysis/progress';
  import ProgressChart from './ProgressChart.svelte';
  import type { RatingPool } from '../rating/pools';
  import { calibration, type MetacogAttempt } from '../metacog/metacog';
  import { impulsivity } from '../metacog/impulsivity';
  import { loadConcepts, cardForThemes, type ConceptCard } from '../concepts/concepts';
  import { scenarioForFocus } from '../coach/program';
  import { t, fmtPct, fmtNum, getLocale } from '../i18n';
  import { motifLabelOrRaw, labelOrRaw } from '../i18n/gen';

  let loading = $state(true);
  let leaks = $state<Leak[]>([]);
  let trend = $state<TrendPoint[]>([]);
  let weakest = $state<Dimension | null>(null);
  let minutes = $state(30);
  // Full attempt rows: they structurally satisfy MetacogAttempt (solved/confidence/selfTag) AND
  // carry `ms` for the impulsivity readout — one load, two derived readouts (T3).
  let attempts = $state<import('../store/db').PuzzleAttemptRecord[]>([]);
  let analysesAll = $state<import('../analysis/types').GameAnalysis[]>([]);
  // PR-04 (ADR-0062): rating-over-time — played games (PR-02 snapshots) + puzzle attempts.
  let games = $state<import('../store/db').GameRecord[]>([]);
  let progressPool = $state<RatingPool>('classical');
  const pools = $derived(availablePools(games));
  const gameSeries = $derived(gameRatingSeries(games, progressPool));
  const puzzleSeries = $derived(puzzleRatingSeries(attempts));
  const latestRd = $derived(gameSeries.length ? gameSeries[gameSeries.length - 1].rd : undefined);
  // Derived so the calibration readout follows the language switch (recomputes on locale change).
  const cal = $derived(calibration(attempts as MetacogAttempt[], { locale: getLocale() }));
  // T3 impulsivity: descriptive move-time readout over {solved, ms}. Pure; null below the floor.
  const imp = $derived(impulsivity(attempts));

  // Descriptive before/after miss-rate for the top ~3 leaks (Q-D windows + minMoves gate).
  const efficacy = $derived<EfficacyReadout[]>(
    analysesAll.length ? leaks.slice(0, 3).map((l) => motifEfficacy(analysesAll, l.key)) : [],
  );
  const metacog = $derived(app.settings?.metacogEnabled ?? false);

  const model = $derived(app.model);
  const plan = $derived(buildStudyPlan(leaks, weakest, minutes, { locale: getLocale() }));

  const DIMS: Dimension[] = ['tactics', 'openingAccuracy', 'endgameConversion', 'timeManagement', 'resilience'];

  // PR-10 (ADR-0068): concept cards for the leak rows — the "Learn the pattern" link only renders
  // when a card actually exists for the motif (no dead links).
  let concepts = $state<ConceptCard[]>([]);

  onMount(async () => {
    try {
      concepts = await loadConcepts(getLocale());
    } catch {
      /* cards asset missing — links simply don't render */
    }
    const analyses = await loadAllAnalyses();
    analysesAll = analyses;
    if (analyses.length) {
      leaks = buildFingerprint(analyses).leaks;
      trend = weaknessTrend(analyses, { window: 5, rating: model ? poolRating(model, 'classical').rating : 1200 });
      weakest = buildWeaknessProfile(analyses, model ? poolRating(model, 'classical').rating : 1200, getLocale()).weakest;
    }
    attempts = await allAttempts();
    games = await getAllGames();
    // Default the pool chip to the first one that actually has a plottable series.
    const avail = availablePools(games);
    if (avail.length && !avail.includes(progressPool)) progressPool = avail[0];
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

  // PR-10 (ADR-0068): three wire-ups, zero new logic — every hook already existed.
  /** Concept card for a leak's motif, if one exists (gates the "Learn the pattern" link). */
  function leakCard(l: Leak): ConceptCard | null {
    return cardForThemes([l.key], concepts);
  }
  function learnLeak(l: Leak) {
    app.conceptFocusMotif = l.key;
    app.go('concepts');
  }
  /** Targeted sparring is offered ONLY where the scenario mapping is semantically sound
   *  (endgame-target leaks → the rook-up conversion scenario) — no fork-flavoured IQP nonsense. */
  function canSparLeak(l: Leak): boolean {
    return leakTarget(l) === 'endgames';
  }
  function sparLeak(l: Leak) {
    app.sparringScenarioId = scenarioForFocus(`endgame: ${l.motif}`);
    app.go('sparring');
  }
  /** Efficacy row → re-drill that motif in Tactics (the readout finally has a next action). */
  function redrill(motifKey: string) {
    app.tacticsFilterThemes = [motifKey];
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
  {:else if leaks.length === 0 && trend.length === 0 && gameSeries.length < 2 && puzzleSeries.length < 2}
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
              <b>{motifLabelOrRaw(l.motif, getLocale())}</b> <span class="muted" style="font-size:0.8rem">{t('phaseLabel.' + l.phase)}</span><br />
              <span class="muted" style="font-size:0.82rem">{t('insights.leakStat', { count: l.count, pct: fmtPct(l.avgWpl) })}</span>
              <!-- PR-10 (ADR-0068): each leak exposes its follow-ups — learn the pattern (when a
                   card exists) and targeted sparring (endgame leaks only, honest routing). -->
              {#if leakCard(l) || canSparLeak(l)}
                <br />
                {#if leakCard(l)}
                  <button class="link-sm" onclick={() => learnLeak(l)}>{t('insights.learnPattern')}</button>
                {/if}
                {#if canSparLeak(l)}
                  <button class="link-sm" onclick={() => sparLeak(l)}>{t('insights.sparTargeted')}</button>
                {/if}
              {/if}
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
              <!-- PR-10 (ADR-0068): the readout finally has a next action. -->
              <br /><button class="link-sm" onclick={() => redrill(e.motifKey)}>{t('insights.redrill')}</button>
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
          <b>{t('insights.planItem', { minutes: item.minutes, activity: labelOrRaw('activity', item.activity, getLocale()) })}</b> — {item.focus}<br />
          <span class="muted" style="font-size:0.8rem">{item.reason}</span>
        </div>
      {/each}
    </div>

    <!-- PR-04 (ADR-0062): rating over time — the product's headline promise, finally drawn.
         Game curve per pool (PR-02 snapshots; unrated/override games never plotted) + puzzle curve
         (day-bucketed attempts, probes excluded). Sections self-hide under 2 points. -->
    {#if pools.length || puzzleSeries.length >= 2}
      <h3>{t('insights.ratingProgress')}</h3>
      {#if pools.length}
        {#if pools.length > 1}
          <div class="row" style="gap:0.35rem;flex-wrap:wrap">
            {#each pools as p (p)}
              <button
                class:ghost={progressPool !== p}
                style="font-size:0.78rem;padding:0.25rem 0.6rem"
                onclick={() => (progressPool = p)}
              >
                {t(p === 'chess960' ? 'history.chess960' : `history.cat${p.charAt(0).toUpperCase()}${p.slice(1)}`)}
              </button>
            {/each}
          </div>
        {/if}
        <ProgressChart
          title={t('insights.gameRatingCurve', { pool: t(progressPool === 'chess960' ? 'history.chess960' : `history.cat${progressPool.charAt(0).toUpperCase()}${progressPool.slice(1)}`) })}
          series={gameSeries}
          latestRd={latestRd}
        />
      {/if}
      {#if puzzleSeries.length >= 2}
        <ProgressChart title={t('insights.puzzleRatingCurve')} series={puzzleSeries} />
      {/if}
      <p class="muted" style="font-size:0.75rem">{t('insights.ratingProgressNote')}</p>
    {/if}

    {#if trend.length >= 2}
      <h3>{t('insights.progress')} <span class="muted" style="font-size:0.8rem">{t('insights.windowsOfGames', { n: trend.length })}</span></h3>
      <div class="col" style="gap:0.3rem">
        {#each DIMS as d}
          <div class="row" style="align-items:center;gap:0.6rem">
            <span style="width:90px;font-size:0.82rem">{t('dimShort.' + d)}</span>
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
                <span style="width:80px;font-size:0.82rem;text-transform:capitalize">{t(r.confidence === 'sure' ? 'metacog.wordSure' : r.confidence === 'unsure' ? 'metacog.wordUnsure' : 'metacog.wordGuess')}</span>
                <span style="font-size:0.82rem">{r.n ? fmtPct(r.accuracy * 100) : '—'}</span>
                <span class="muted" style="font-size:0.78rem">({r.correct}/{r.n})</span>
              </div>
            {/each}
          </div>
          {#if cal.readout.topCause}
            <p style="font-size:0.85rem">{t('insights.topCause')}
              <b>{t('selfTag.' + cal.readout.topCause.tag)}</b> {t('insights.topCausePct', { pct: fmtPct(cal.readout.topCause.pct * 100) })}
            </p>
          {/if}
          {#if cal.selfTags.length}
            <div class="col" style="gap:0.1rem">
              {#each cal.selfTags as tag}
                <span class="muted" style="font-size:0.8rem">{t('insights.selfTagLine', { label: t('selfTag.' + tag.tag), n: tag.n, pct: fmtPct(tag.pct * 100) })}</span>
              {/each}
            </div>
          {/if}
          <p class="muted" style="font-size:0.75rem">{t('insights.calibrationDescriptive')}</p>
        </div>
      {:else}
        <p class="muted">{t('insights.calibrationNeedsMore', { reported: cal.reportedAttempts })}</p>
      {/if}
    {/if}

    <!-- T3 impulsivity / move-time (Q-D, descriptive — never a grade; AP-TINTEG-7). A fact sentence
         about the ATTEMPTS (not a trait of the player; no label noun — /enrich#8b) WITH denominators
         (k/n, mirroring calibration; /enrich#3). Gated by metacog like calibration; the readout is
         null below the sample-size floor, in which case nothing is asserted (no fabricated 0%). -->
    {#if metacog && imp.readout}
      <h3>{t('insights.impulsivity')}</h3>
      <div class="panel col" style="gap:0.4rem">
        <p>
          {#if imp.readout.kind === 'impulsive'}
            {t('insights.impulsivityImpulsive', { fastTotal: imp.fastTotal, pct: fmtPct(imp.readout.fastMissPct) })}
          {:else if imp.readout.kind === 'deliberate'}
            {t('insights.impulsivityDeliberate', { slowTotal: imp.slowTotal })}
          {:else}
            {t('insights.impulsivityMixed', { fastTotal: imp.fastTotal, pct: fmtPct(imp.readout.fastMissPct) })}
          {/if}
        </p>
        <span class="muted" style="font-size:0.82rem">{t('insights.avgSolveTime', { sec: fmtNum(imp.readout.avgSec) })}</span>
        <span class="muted" style="font-size:0.8rem">{t('insights.impulsivityDetail', { fastWrong: imp.fastWrong, fastTotal: imp.fastTotal, slowRight: imp.slowRight, slowTotal: imp.slowTotal })}</span>
        <p class="muted" style="font-size:0.75rem">{t('insights.impulsivityDescriptive')}</p>
      </div>
    {/if}
  {/if}
</section>

<style>
  /* PR-10: small inline follow-up links on leak/efficacy rows. */
  button.link-sm {
    background: none;
    border: none;
    color: var(--accent);
    padding: 0;
    font-size: 0.78rem;
    text-decoration: underline;
    cursor: pointer;
    margin-right: 0.7rem;
  }
</style>
