<script lang="ts">
  // Deliberate-practice session runner (ADR-0039). Derives a session on mount from the
  // SAME pipeline Insights uses (buildFingerprint → buildWeaknessProfile.weakest →
  // buildStudyPlan → buildSession), then steps through it. Non-reflection steps LAUNCH the
  // existing trainers via signal flags + app.go (Q-E, AP-ES-5) — no trainer logic is
  // reimplemented here. The reflection step is a soft, non-blocking ~20s prompt whose note
  // is DISPLAY-ONLY and NEVER persisted (Q-B, AP-ES-6/7). No Date in any core (the cores
  // are pure; Date.now() lives only at this boundary).
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { buildFingerprint } from '../analysis/fingerprint';
  import { buildWeaknessProfile } from '../analysis/weakness';
  import { buildStudyPlan } from '../analysis/studyPlan';
  import { buildSession, type SessionPlan, type SessionStep } from '../analysis/session';
  import { dueCount } from '../srs/SrsStore';
  import { poolRating } from '../store/playerModel';

  let loading = $state(true);
  let session = $state<SessionPlan | null>(null);
  let current = $state(0);
  let startedAt = $state(0);
  let now = $state(0);
  let reflection = $state(''); // display-only, NEVER persisted (Q-B)
  let reflectTimerDone = $state(false);

  const minutes = 30; // same default budget as Insights

  const model = $derived(app.model);
  const step = $derived<SessionStep | null>(session ? session.steps[current] ?? null : null);
  const elapsedMin = $derived(now && startedAt ? (now - startedAt) / 60000 : 0);
  const remainingMin = $derived(
    session ? Math.max(0, Math.round(session.totalMinutes - elapsedMin)) : 0,
  );

  // Launch destinations for non-reflection steps (reuse existing trainer routes).
  const TRAINER_VIEW: Record<string, import('../state/app.svelte').View> = {
    vision: 'vision', tactics: 'tactics', endgames: 'endgames',
    repertoire: 'repertoire', comeback: 'comeback', review: 'review',
  };

  onMount(() => {
    startedAt = Date.now();
    now = startedAt;
    // Lightweight elapsed-time tick (UI-owned; never in a core).
    const id = setInterval(() => { now = Date.now(); }, 1000);
    (async () => {
      const analyses = await loadAllAnalyses();
      const leaks = analyses.length ? buildFingerprint(analyses).leaks : [];
      const weakest = analyses.length
        ? buildWeaknessProfile(analyses, model ? poolRating(model, 'classical').rating : 1200).weakest
        : null;
      const plan = buildStudyPlan(leaks, weakest, minutes);
      const includeReview = (await dueCount(Date.now())) > 0; // Q-F: reserve a Review slot only when due
      session = buildSession(plan, { includeReview });
      loading = false;
    })();
    return () => clearInterval(id);
  });

  function launch(s: SessionStep) {
    if (s.kind === 'tactics') {
      app.tacticsFilterThemes = s.themes ?? null;
      app.tacticsTimed = s.timed ?? false;
    }
    const view = TRAINER_VIEW[s.kind];
    if (view) app.go(view); // return to the session via the "Session" nav arm (Q-E orchestration)
  }

  function advance() {
    if (session && current < session.steps.length - 1) {
      current += 1;
      reflectTimerDone = false;
      if (step && step.kind === 'reflection') startReflectTimer();
    }
  }

  function startReflectTimer() {
    // Soft, informational ~20s prompt — NEVER blocks "Finish" (AP-ES-7).
    setTimeout(() => { reflectTimerDone = true; }, 20000);
  }

  function finish() {
    // Reflection is DISPLAY-ONLY — nothing is persisted (Q-B). Just route back.
    app.go('insights');
  }
</script>

<section class="col" style="max-width:680px;margin:0 auto">
  <h2>Practice session</h2>
  {#if loading}
    <p class="muted">Building your session…</p>
  {:else if session && step}
    <p class="muted" style="font-size:0.82rem">
      Step {current + 1} of {session.steps.length} · ~{remainingMin} min left
    </p>

    {#if step.kind === 'reflection'}
      <div class="panel col" style="gap:0.5rem">
        <b>{step.focus}</b>
        <p class="muted" style="font-size:0.85rem">{step.reason}</p>
        <textarea
          bind:value={reflection}
          rows="4"
          placeholder="What did you notice? What will you do differently?"
          style="width:100%"></textarea>
        <p class="muted" style="font-size:0.72rem">
          {reflectTimerDone ? 'Take as long as you like.' : 'Sit with it for ~20s — then finish whenever you are ready.'}
          Notes are shown here only and are not saved.
        </p>
        <button onclick={finish}>Finish</button>
      </div>
    {:else}
      <div class="panel col" style="gap:0.4rem">
        <b>{step.minutes}m · {step.kind}</b> — {step.focus}
        <span class="muted" style="font-size:0.82rem">{step.reason}</span>
        <div class="row" style="gap:0.5rem">
          <button onclick={() => launch(step)}>Open {step.kind} →</button>
          <button onclick={advance}>Done / Skip</button>
        </div>
        <span class="muted" style="font-size:0.72rem">
          Launches the real trainer. Come back here (Session) to continue.
        </span>
      </div>
    {/if}
  {:else}
    <p class="muted">No session available.</p>
    <button onclick={() => app.go('insights')}>Back to Insights</button>
  {/if}
</section>
