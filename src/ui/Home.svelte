<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import { poolRating } from '../store/playerModel';
  import { shouldOfferCoach } from '../coach/funnel';
  import { programIdOf, attemptedDays, nextProgramDay } from '../coach/multiday';
  import { recentSessionLogs } from '../store/sessionLogRepo';
  import { buildSession } from '../analysis/session';
  import { t, tn } from '../i18n';

  const model = $derived(app.model);
  const classical = $derived(model ? poolRating(model, 'classical') : null);
  // T3/TR8: the training-day streak, normalised to a number for the badge below.
  const dailyStreak = $derived(model?.dailyStreak ?? 0);
  // P1: unanalysed-games badge — durable re-entry to the play→analysis loop (links to history).
  const unanalyzed = $derived(app.unanalyzedGames);

  // CO20 (C8, Q-A=c): the rough-patch coaching card — catch the RETURNING user on a losing streak.
  // The pure `shouldOfferCoach` predicate gates it on a losing streak in the persisted rolling
  // outcomes AND no fresh profile (staleness guard); the Date.now() boundary lives HERE (the core
  // takes `now`, AP-CFUNNEL-2). Dismissible + an in-memory cooldown so it never re-nags (AP-CFUNNEL-1).
  const showRoughPatch = $derived(!app.coachOfferDismissed && shouldOfferCoach(model ?? null, Date.now()));

  // PR-18 (ADR-0076): the multi-day program card — "day X/N" derived from the sessionLog stamps
  // (I8), never duplicated state. Best-effort: a log-read hiccup just hides the card.
  let programNext = $state<{ day: number; total: number } | null>(null);
  onMount(async () => {
    const prof = app.model?.coachProfile;
    if (!prof?.programDays?.length) return;
    try {
      const attempted = attemptedDays(await recentSessionLogs(100), programIdOf(prof));
      const day = nextProgramDay(prof.programDays.length, attempted);
      programNext = day === null ? null : { day, total: prof.programDays.length };
    } catch {
      programNext = null;
    }
  });

  function startProgramDayFromHome() {
    const prof = app.model?.coachProfile;
    if (!prof?.programDays || !programNext) return;
    const items = prof.programDays[programNext.day] ?? [];
    const dayMin = items.reduce((s, i) => s + i.minutes, 0);
    app.activeSession = {
      plan: buildSession(items),
      current: 0,
      startedAt: Date.now(),
      reflection: '',
      budgetMin: dayMin || 30,
      programId: programIdOf(prof),
      day: programNext.day,
    };
    app.go('session');
  }
</script>

<section class="home">
  <h1>{t('home.title')}</h1>
  <p class="tagline">{t('home.tagline')}</p>

  {#if model}
    <div class="ratings">
      <div class="rating-card">
        <span class="label">{t('home.gameRating')}</span>
        <span class="val">{classical ? Math.round(classical.rating) : '—'}</span>
        <span class="rd">±{classical ? Math.round(classical.rd) : '—'}</span>
      </div>
      <div class="rating-card">
        <span class="label">{t('home.puzzleRating')}</span>
        <span class="val">{Math.round(model.puzzleRating.rating)}</span>
        <span class="rd">±{Math.round(model.puzzleRating.rd)}</span>
      </div>
    </div>
    <p class="note">{t('home.puzzleNote')}</p>
    <!-- T3/TR8: surface the training-day streak where re-engagement happens, beside the Review
         badge below. One render site, no new logic — reads model.dailyStreak (/enrich#2). -->
    {#if dailyStreak > 0}
      <p class="note">{t('home.streak', { n: dailyStreak })}</p>
    {/if}
    {#if unanalyzed > 0}
      <p class="note">
        {tn(unanalyzed, 'play.loop.badgeOne', 'play.loop.badgeMany')}
        <button class="link-inline" onclick={() => app.go('import')}>{t('play.loop.reviewHistory')}</button>
      </p>
    {/if}
    <!-- CO20 (C8): the dismissible rough-patch coaching card. Soft, single-line, opt-in — shown only
         on a losing streak with no fresh profile (shouldOfferCoach). "Not now" sets an in-memory
         cooldown so it does not re-nag (AP-CFUNNEL-1). -->
    {#if showRoughPatch}
      <div class="rough-patch">
        <span>{t('home.roughPatch')}</span>
        <span class="rough-patch-actions">
          <button class="link-inline" onclick={() => app.go('coach')}>{t('home.roughPatchCta')}</button>
          <button class="link-inline muted-link" onclick={() => (app.coachOfferDismissed = true)}>{t('home.roughPatchDismiss')}</button>
        </span>
      </div>
    {/if}
    <!-- PR-18 (ADR-0076): the coach program's next day, one click away. -->
    {#if programNext}
      <div class="rough-patch">
        <span>{t('home.programDay', { day: programNext.day + 1, total: programNext.total })}</span>
        <button class="link-inline" onclick={startProgramDayFromHome}>{t('home.programGo')}</button>
      </div>
    {/if}
  {/if}

  <div class="actions">
    <button onclick={() => app.go('play')}>{t('home.playBot')}</button>
    <button onclick={() => app.go('session')}>{t('home.todaysSession')}</button>
    <button onclick={() => app.go('insights')}>{t('home.insights')}</button>
    <button onclick={() => app.go('tactics')}>{t('home.trainTactics')}</button>
    <button onclick={() => app.go('review')}>{t('home.review')}{#if app.dueReview > 0} · {t('home.reviewDue', { n: app.dueReview })}{/if}</button>
    <button onclick={() => app.go('woodpecker')}>{t('home.woodpecker')}</button>
    <button onclick={() => app.go('import')}>{t('home.analyseGame')}</button>
    <button onclick={() => app.go('dashboard')}>{t('home.weaknessDashboard')}</button>
    <button onclick={() => app.go('coach')}>{t('home.personalCoaching')}</button>
    <button onclick={() => app.go('endgames')}>{t('home.endgameTrainer')}</button>
    <button onclick={() => app.go('repertoire')}>{t('home.openingRepertoire')}</button>
    <button onclick={() => app.go('guess')}>{t('home.guessMove')}</button>
    <button onclick={() => app.go('vision')}>{t('home.calcVision')}</button>
    <button class="ghost" onclick={() => app.go('onboarding')}>{t('home.rerunEval')}</button>
    <button class="ghost" onclick={() => app.go('settings')}>{t('home.settings')}</button>
  </div>
</section>

<style>
  .home { max-width: 640px; margin: 0 auto; text-align: center; }
  .tagline { color: var(--muted); }
  .ratings { display: flex; gap: 1rem; justify-content: center; margin: 1.5rem 0 0.5rem; }
  .rating-card { background: var(--panel); border-radius: 12px; padding: 1rem 1.5rem; display: flex; flex-direction: column; }
  .rating-card .label { font-size: 0.8rem; color: var(--muted); }
  .rating-card .val { font-size: 2rem; font-weight: 700; }
  .rating-card .rd { font-size: 0.8rem; color: var(--muted); }
  .note { font-size: 0.8rem; color: var(--muted); }
  button.link-inline { background: none; border: none; color: var(--accent); padding: 0; font: inherit; text-decoration: underline; cursor: pointer; }
  /* CO20 rough-patch card: a soft, dismissible coaching prompt. */
  .rough-patch {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.5rem 0.9rem;
    max-width: 420px; margin: 0.75rem auto 0; padding: 0.6rem 0.9rem;
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    font-size: 0.85rem;
  }
  .rough-patch-actions { display: inline-flex; gap: 0.9rem; }
  .rough-patch .muted-link { color: var(--muted); }
  .actions { display: flex; flex-direction: column; gap: 0.75rem; max-width: 320px; margin: 1.5rem auto 0; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
