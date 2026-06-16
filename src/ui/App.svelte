<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { app, type View } from '../state/app.svelte';
  import { t } from '../i18n';

  // Lazy-load each view so the initial bundle is the shell + first view, not all 23 (audit W15).
  // Vite emits one chunk per view; the browser fetches a view's code on first navigation to it.
  const loaders: Record<View, () => Promise<{ default: Component }>> = {
    home: () => import('./Home.svelte'),
    onboarding: () => import('./Onboarding.svelte'),
    play: () => import('./Play.svelte'),
    tactics: () => import('./Tactics.svelte'),
    import: () => import('./Import.svelte'),
    dashboard: () => import('./Dashboard.svelte'),
    review: () => import('./Review.svelte'),
    endgames: () => import('./Endgames.svelte'),
    repertoire: () => import('./Repertoire.svelte'),
    woodpecker: () => import('./Woodpecker.svelte'),
    guess: () => import('./GuessMove.svelte'),
    vision: () => import('./Vision.svelte'),
    comeback: () => import('./Comeback.svelte'),
    'when-to-think': () => import('./WhenToThink.svelte'),
    insights: () => import('./Insights.svelte'),
    explorer: () => import('./Explorer.svelte'),
    calculate: () => import('./Calculate.svelte'),
    sparring: () => import('./Sparring.svelte'),
    concepts: () => import('./Concepts.svelte'),
    session: () => import('./Session.svelte'),
    'analysis-board': () => import('./AnalysisBoard.svelte'),
    settings: () => import('./Settings.svelte'),
    coach: () => import('./Coach.svelte'),
  };
  const viewLoader = $derived(loaders[app.view] ?? loaders.home);

  // Single nav list (audit v2 W13/W16): one <nav> landmark, aria-current on the active view,
  // wraps instead of overflowing the viewport.
  const NAV: Array<{ view: View; key: string }> = [
    { view: 'home', key: 'nav.home' },
    { view: 'play', key: 'nav.play' },
    { view: 'sparring', key: 'nav.spar' },
    { view: 'tactics', key: 'nav.tactics' },
    { view: 'review', key: 'nav.review' },
    { view: 'woodpecker', key: 'nav.woodpecker' },
    { view: 'import', key: 'nav.analyse' },
    { view: 'analysis-board', key: 'nav.board' },
    { view: 'dashboard', key: 'nav.dashboard' },
    { view: 'insights', key: 'nav.insights' },
    { view: 'coach', key: 'nav.coach' },
    { view: 'session', key: 'nav.session' },
    { view: 'endgames', key: 'nav.endgames' },
    { view: 'repertoire', key: 'nav.repertoire' },
    { view: 'explorer', key: 'nav.explorer' },
    { view: 'guess', key: 'nav.guess' },
    { view: 'vision', key: 'nav.vision' },
    { view: 'concepts', key: 'nav.concepts' },
    { view: 'calculate', key: 'nav.calculate' },
    { view: 'settings', key: 'nav.settings' },
  ];

  let booted = $state(false);

  // Keep the document <title> in sync with the language (V2-W18).
  $effect(() => {
    document.title = t('shell.docTitle');
  });

  onMount(async () => {
    await app.boot(Date.now());
    booted = true;
  });

  // Drop any engine search abandoned when leaving an engine-using view, so the next view's first
  // search isn't head-of-line-blocked behind work the user walked away from (audit v2 P1-06).
  let prevView: View | null = null;
  $effect(() => {
    const v = app.view;
    if (prevView !== null && prevView !== v) {
      if (app.engine.busy) void app.engine.interrupt();
      void app.refreshDue(Date.now()); // keep the Review badge fresh after grading (audit v2 P1-07)
    }
    prevView = v;
  });
</script>

<a class="skip-link" href="#main-content">{t('shell.skipToContent')}</a>
<header class="topbar">
  <button class="brand" onclick={() => app.go('home')}>{t('shell.brand')}</button>
  {#if booted && app.model?.onboarded}
    <nav class="nav" aria-label={t('shell.navLabel')}>
      {#each NAV as item (item.view)}
        <button
          onclick={() => app.go(item.view)}
          class:active={app.view === item.view}
          aria-current={app.view === item.view ? 'page' : undefined}
        >{t(item.key)}{#if item.view === 'review' && app.dueReview > 0} ({app.dueReview}){/if}</button>
      {/each}
    </nav>
  {/if}
</header>

<main id="main-content" class="app-main">
  {#if !booted}
    <p class="center muted">{t('shell.loading')}</p>
  {:else if app.bootError}
    <section class="col center" style="max-width:480px;margin:3rem auto;text-align:center">
      <h2>{t('shell.storageTitle')}</h2>
      <p class="muted">{app.bootError}</p>
      <p class="muted" style="font-size:0.85rem">{t('shell.storageHint')}</p>
      <button onclick={() => location.reload()}>{t('shell.reload')}</button>
    </section>
  {:else}
    {#await viewLoader() then mod}
      {@const Comp = mod.default}
      <Comp />
    {:catch}
      <section class="col center" style="max-width:480px;margin:3rem auto;text-align:center">
        <h2>{t('shell.loadErrorTitle')}</h2>
        <p class="muted">{t('shell.loadErrorBody')}</p>
        <button onclick={() => location.reload()}>{t('shell.reload')}</button>
      </section>
    {/await}
  {/if}
</main>
