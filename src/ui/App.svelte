<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import Home from './Home.svelte';
  import Play from './Play.svelte';
  import Tactics from './Tactics.svelte';
  import Onboarding from './Onboarding.svelte';
  import Settings from './Settings.svelte';
  import Import from './Import.svelte';
  import Dashboard from './Dashboard.svelte';

  let booted = $state(false);

  onMount(async () => {
    await app.boot(Date.now());
    booted = true;
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
    <button onclick={() => app.go('tactics')}>Tactics</button>
    <button onclick={() => app.go('import')}>Analyse</button>
    <button onclick={() => app.go('dashboard')}>Dashboard</button>
    <button onclick={() => app.go('settings')}>Settings</button>
  {/if}
</header>

<main class="app-main">
  {#if !booted}
    <p class="center muted">Loading…</p>
  {:else if app.view === 'onboarding'}
    <Onboarding />
  {:else if app.view === 'play'}
    <Play />
  {:else if app.view === 'tactics'}
    <Tactics />
  {:else if app.view === 'import'}
    <Import />
  {:else if app.view === 'dashboard'}
    <Dashboard />
  {:else if app.view === 'settings'}
    <Settings />
  {:else}
    <Home />
  {/if}
</main>
