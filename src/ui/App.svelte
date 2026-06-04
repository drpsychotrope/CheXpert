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
  import Review from './Review.svelte';
  import Endgames from './Endgames.svelte';
  import Repertoire from './Repertoire.svelte';
  import Woodpecker from './Woodpecker.svelte';
  import GuessMove from './GuessMove.svelte';
  import Vision from './Vision.svelte';
  import Comeback from './Comeback.svelte';
  import WhenToThink from './WhenToThink.svelte';
  import Insights from './Insights.svelte';
  import Explorer from './Explorer.svelte';
  import Calculate from './Calculate.svelte';
  import AnalysisBoard from './AnalysisBoard.svelte';
  import Sparring from './Sparring.svelte';
  import Concepts from './Concepts.svelte';
  import Session from './Session.svelte';
  import Coach from './Coach.svelte';

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
  {:else if app.view === 'review'}
    <Review />
  {:else if app.view === 'endgames'}
    <Endgames />
  {:else if app.view === 'repertoire'}
    <Repertoire />
  {:else if app.view === 'woodpecker'}
    <Woodpecker />
  {:else if app.view === 'guess'}
    <GuessMove />
  {:else if app.view === 'vision'}
    <Vision />
  {:else if app.view === 'comeback'}
    <Comeback />
  {:else if app.view === 'when-to-think'}
    <WhenToThink />
  {:else if app.view === 'insights'}
    <Insights />
  {:else if app.view === 'explorer'}
    <Explorer />
  {:else if app.view === 'calculate'}
    <Calculate />
  {:else if app.view === 'sparring'}
    <Sparring />
  {:else if app.view === 'concepts'}
    <Concepts />
  {:else if app.view === 'session'}
    <Session />
  {:else if app.view === 'analysis-board'}
    <AnalysisBoard />
  {:else if app.view === 'settings'}
    <Settings />
  {:else if app.view === 'coach'}
    <Coach />
  {:else}
    <Home />
  {/if}
</main>
