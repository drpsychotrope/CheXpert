<script lang="ts">
  // Deliberate-practice session runner (ADR-0039). Derives a session on mount from the
  // SAME pipeline Insights uses (buildFingerprint → buildWeaknessProfile.weakest →
  // buildStudyPlan → buildSession), then steps through it. Non-reflection steps LAUNCH the
  // existing trainers via signal flags + app.go (Q-E, AP-ES-5) — no trainer logic is
  // reimplemented here. The reflection step is a soft, non-blocking ~20s prompt whose note
  // is DISPLAY-ONLY and NEVER persisted (Q-B, AP-ES-6/7). No Date in any core (the cores
  // are pure; Date.now() lives only at this boundary).
  //
  // Session state is kept in app.activeSession (in-memory AppState singleton) so it
  // SURVIVES the unmount that happens when a trainer is launched via app.go(). Returning
  // via the "Session" nav arm re-mounts this component and resumes at the current step.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import { scenarioForFocus } from '../coach/program';
  import type { Dimension } from '../analysis/weakness';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { buildFingerprint } from '../analysis/fingerprint';
  import { buildWeaknessProfile } from '../analysis/weakness';
  import { buildStudyPlan } from '../analysis/studyPlan';
  import { buildSession, type SessionStep } from '../analysis/session';
  import { dueCount, dueCards } from '../srs/SrsStore';
  import { weakSquares } from '../vision/weakSquares';
  import { poolRating } from '../store/playerModel';
  import { t, getLocale } from '../i18n';

  let loading = $state(true);
  let now = $state(0);
  let reflectTimerDone = $state(false);
  let reflectTimerId: ReturnType<typeof setTimeout> | null = null;

  const minutes = 30; // same default budget as Insights

  const model = $derived(app.model);
  const step = $derived<SessionStep | null>(
    app.activeSession ? app.activeSession.plan.steps[app.activeSession.current] ?? null : null,
  );
  const elapsedMin = $derived(
    now && app.activeSession ? (now - app.activeSession.startedAt) / 60000 : 0,
  );
  const remainingMin = $derived(
    app.activeSession
      ? Math.max(0, Math.round(app.activeSession.plan.totalMinutes - elapsedMin))
      : 0,
  );

  // Launch destinations for non-reflection steps (reuse existing trainer routes).
  const TRAINER_VIEW: Record<string, import('../state/app.svelte').View> = {
    vision: 'vision', tactics: 'tactics', endgames: 'endgames',
    repertoire: 'repertoire', comeback: 'comeback', review: 'review',
    sparring: 'sparring', 'play-steered': 'play',
  };

  onMount(() => {
    now = Date.now();
    // Lightweight elapsed-time tick (UI-owned; never in a core).
    const tickId = setInterval(() => { now = Date.now(); }, 1000);

    if (app.activeSession) {
      // RESUME: a trainer was launched from this session; we're back at the same step.
      loading = false;
      if (step && step.kind === 'reflection') startReflectTimer();
    } else {
      // FRESH start: build and store in the singleton.
      (async () => {
        const analyses = await loadAllAnalyses();
        const leaks = analyses.length ? buildFingerprint(analyses).leaks : [];
        const weakest = analyses.length
          ? buildWeaknessProfile(analyses, model ? poolRating(model, 'classical').rating : 1200, getLocale()).weakest
          : null;
        const nowMs = Date.now();
        // ADR-0043: surface due vision squares for the warm-up, and seed the trainer with them.
        const visionCards = await dueCards(nowMs, 'vision-square', 200);
        const weak = weakSquares(visionCards, nowMs, 12);
        app.visionWeakSquares = weak.length ? weak : null;
        const plan = buildStudyPlan(leaks, weakest, minutes, { visionWeakSquares: weak, locale: getLocale() });
        // Scope the Review gate to the kinds the Review path actually covers (puzzle + repertoire),
        // so due vision-square cards never reserve a Review slot. (Q-A = exclude-vision-only.)
        const includeReview = ((await dueCount(nowMs, 'puzzle')) + (await dueCount(nowMs, 'repertoire'))) > 0;
        const session = buildSession(plan, { includeReview });
        app.activeSession = { plan: session, current: 0, startedAt: Date.now(), reflection: '' };
        loading = false;
      })();
    }

    return () => {
      clearInterval(tickId);
      if (reflectTimerId !== null) {
        clearTimeout(reflectTimerId);
        reflectTimerId = null;
      }
    };
  });

  function launch(s: SessionStep) {
    if (s.kind === 'tactics') {
      app.tacticsFilterThemes = s.themes ?? null;
      app.tacticsTimed = s.timed ?? false;
    }
    if (s.kind === 'sparring') app.sparringScenarioId = scenarioForFocus(s.focus);
    if (s.kind === 'play-steered') app.steerDimension = s.focus as Dimension;
    const view = TRAINER_VIEW[s.kind];
    // The current step index is already recorded in app.activeSession — do NOT auto-advance.
    // Return here via the "Session" nav arm to resume at this step.
    if (view) app.go(view);
  }

  function advance() {
    if (!app.activeSession) return;
    const total = app.activeSession.plan.steps.length;
    const next = app.activeSession.current + 1;
    if (next < total) {
      app.activeSession.current = next;
      reflectTimerDone = false;
      const nextStep = app.activeSession.plan.steps[next];
      if (nextStep && nextStep.kind === 'reflection') startReflectTimer();
    }
  }

  function startReflectTimer() {
    if (reflectTimerId !== null) clearTimeout(reflectTimerId);
    // Soft, informational ~20s prompt — NEVER blocks "Finish" (AP-ES-7).
    reflectTimerId = setTimeout(() => { reflectTimerDone = true; }, 20000);
  }

  function finish() {
    // Reflection is DISPLAY-ONLY — nothing is persisted (Q-B). Clear session and route back.
    app.activeSession = null;
    app.go('insights');
  }
</script>

<section class="col" style="max-width:680px;margin:0 auto">
  <h2>{t('session.title')}</h2>
  {#if loading}
    <p class="muted">{t('session.building')}</p>
  {:else if app.activeSession && step}
    <p class="muted" style="font-size:0.82rem">
      {t('session.stepProgress', { current: app.activeSession.current + 1, total: app.activeSession.plan.steps.length, min: remainingMin })}
    </p>

    {#if step.kind === 'reflection'}
      <div class="panel col" style="gap:0.5rem">
        <b>{step.focus}</b>
        <p class="muted" style="font-size:0.85rem">{step.reason}</p>
        <textarea
          bind:value={app.activeSession.reflection}
          rows="4"
          placeholder={t('session.reflectionPlaceholder')}
          style="width:100%"></textarea>
        <p class="muted" style="font-size:0.72rem">
          {reflectTimerDone ? t('session.takeYourTime') : t('session.sitWithIt')}
          {t('session.notesNotSaved')}
        </p>
        <button onclick={finish}>{t('session.finish')}</button>
      </div>
    {:else}
      <div class="panel col" style="gap:0.4rem">
        <b>{t('session.stepHeader', { minutes: step.minutes, kind: step.kind })}</b> — {step.focus}
        <span class="muted" style="font-size:0.82rem">{step.reason}</span>
        <div class="row" style="gap:0.5rem">
          <button onclick={() => launch(step)}>{t('session.openTrainer', { kind: step.kind })}</button>
          <button onclick={advance}>{t('session.doneNext')}</button>
          <button onclick={advance}>{t('session.skipStep')}</button>
        </div>
        <span class="muted" style="font-size:0.72rem">
          {t('session.launchesHint')}
        </span>
      </div>
    {/if}
  {:else}
    <p class="muted">{t('session.noSession')}</p>
    <button onclick={() => app.go('insights')}>{t('session.backToInsights')}</button>
  {/if}
</section>
