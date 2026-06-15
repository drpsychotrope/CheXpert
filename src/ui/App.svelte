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
    if (prevView !== null && prevView !== v && app.engine.busy) void app.engine.interrupt();
    prevView = v;
  });
</script>

<header class="topbar">
  <span class="brand" role="button" tabindex="0" onclick={() => app.go('home')} onkeydown={(e) => e.key === 'Enter' && app.go('home')}>
    ♞ Chess Trainer
  </span>
  <span class="spacer"></span>
  {#if booted && app.model?.onboarded}
    <button onclick={() => app.go('home')}>Home</button>
    <button onclick={() => app.go('play')}>Play</button>
    <button onclick={() => app.go('sparring')}>Spar</button>
    <button onclick={() => app.go('tactics')}>Tactics</button>
    <button onclick={() => app.go('review')}>Review</button>
    <button onclick={() => app.go('woodpecker')}>Woodpecker</button>
    <button onclick={() => app.go('import')}>Analyse</button>
    <button onclick={() => app.go('analysis-board')}>Board</button>
    <button onclick={() => app.go('dashboard')}>Dashboard</button>
    <button onclick={() => app.go('insights')}>Insights</button>
    <button onclick={() => app.go('coach')}>Coach</button>
    <button onclick={() => app.go('session')}>Session</button>
    <button onclick={() => app.go('endgames')}>Endgames</button>
    <button onclick={() => app.go('repertoire')}>Repertoire</button>
    <button onclick={() => app.go('explorer')}>Explorer</button>
    <button onclick={() => app.go('guess')}>Guess</button>
    <button onclick={() => app.go('vision')}>Vision</button>
    <button onclick={() => app.go('concepts')}>Concepts</button>
    <button onclick={() => app.go('calculate')}>Calculate</button>
    <button onclick={() => app.go('settings')}>Settings</button>
  {/if}
</header>

<main class="app-main">
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
