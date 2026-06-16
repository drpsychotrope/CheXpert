<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { app, type View } from '../state/app.svelte';

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
  const NAV: Array<{ view: View; label: string }> = [
    { view: 'home', label: 'Home' },
    { view: 'play', label: 'Play' },
    { view: 'sparring', label: 'Spar' },
    { view: 'tactics', label: 'Tactics' },
    { view: 'review', label: 'Review' },
    { view: 'woodpecker', label: 'Woodpecker' },
    { view: 'import', label: 'Analyse' },
    { view: 'analysis-board', label: 'Board' },
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'insights', label: 'Insights' },
    { view: 'coach', label: 'Coach' },
    { view: 'session', label: 'Session' },
    { view: 'endgames', label: 'Endgames' },
    { view: 'repertoire', label: 'Repertoire' },
    { view: 'explorer', label: 'Explorer' },
    { view: 'guess', label: 'Guess' },
    { view: 'vision', label: 'Vision' },
    { view: 'concepts', label: 'Concepts' },
    { view: 'calculate', label: 'Calculate' },
    { view: 'settings', label: 'Settings' },
  ];

  let booted = $state(false);

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

<a class="skip-link" href="#main-content">Skip to content</a>
<header class="topbar">
  <button class="brand" onclick={() => app.go('home')}>♞ Chess Trainer</button>
  {#if booted && app.model?.onboarded}
    <nav class="nav" aria-label="Main">
      {#each NAV as item (item.view)}
        <button
          onclick={() => app.go(item.view)}
          class:active={app.view === item.view}
          aria-current={app.view === item.view ? 'page' : undefined}
        >{item.label}{#if item.view === 'review' && app.dueReview > 0} ({app.dueReview}){/if}</button>
      {/each}
    </nav>
  {/if}
</header>

<main id="main-content" class="app-main">
  {#if !booted}
    <p class="center muted">Loading…</p>
  {:else if app.bootError}
    <section class="col center" style="max-width:480px;margin:3rem auto;text-align:center">
      <h2>⚠️ Storage unavailable</h2>
      <p class="muted">{app.bootError}</p>
      <p class="muted" style="font-size:0.85rem">
        Chess Trainer keeps everything on your device using your browser's storage (IndexedDB).
        Try a normal (non-private) window, allow site data for this page, then reload.
      </p>
      <button onclick={() => location.reload()}>Reload</button>
    </section>
  {:else}
    {#await viewLoader() then mod}
      {@const Comp = mod.default}
      <Comp />
    {:catch}
      <section class="col center" style="max-width:480px;margin:3rem auto;text-align:center">
        <h2>⚠️ Couldn't load this screen</h2>
        <p class="muted">
          A part of the app failed to load — this can happen after an update. Reloading usually fixes it.
        </p>
        <button onclick={() => location.reload()}>Reload</button>
      </section>
    {/await}
  {/if}
</main>
