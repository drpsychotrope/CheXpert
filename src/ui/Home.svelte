<script lang="ts">
  import { app } from '../state/app.svelte';
  import { poolRating } from '../store/playerModel';
  import { t, tn } from '../i18n';

  const model = $derived(app.model);
  const classical = $derived(model ? poolRating(model, 'classical') : null);
  // T3/TR8: the training-day streak, normalised to a number for the badge below.
  const dailyStreak = $derived(model?.dailyStreak ?? 0);
  // P1: unanalysed-games badge — durable re-entry to the play→analysis loop (links to history).
  const unanalyzed = $derived(app.unanalyzedGames);
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
  .actions { display: flex; flex-direction: column; gap: 0.75rem; max-width: 320px; margin: 1.5rem auto 0; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
