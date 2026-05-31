<script lang="ts">
  import { app } from '../state/app.svelte';

  const model = $derived(app.model);
</script>

<section class="home">
  <h1>Chess Trainer</h1>
  <p class="tagline">One job: make you stronger. Play slow, analyse, drill your real weaknesses.</p>

  {#if model}
    <div class="ratings">
      <div class="rating-card">
        <span class="label">Game rating</span>
        <span class="val">{Math.round(model.gameRating.rating)}</span>
        <span class="rd">±{Math.round(model.gameRating.rd)}</span>
      </div>
      <div class="rating-card">
        <span class="label">Puzzle rating</span>
        <span class="val">{Math.round(model.puzzleRating.rating)}</span>
        <span class="rd">±{Math.round(model.puzzleRating.rd)}</span>
      </div>
    </div>
    <p class="note">Puzzle rating measures pattern recognition, not playing strength — they differ.</p>
  {/if}

  <div class="actions">
    <button onclick={() => app.go('play')}>Play the adaptive bot</button>
    <button onclick={() => app.go('tactics')}>Train tactics</button>
    <button onclick={() => app.go('review')}>Review (spaced repetition)</button>
    <button onclick={() => app.go('woodpecker')}>Woodpecker (speed drills)</button>
    <button onclick={() => app.go('import')}>Analyse a game</button>
    <button onclick={() => app.go('dashboard')}>Weakness dashboard</button>
    <button onclick={() => app.go('endgames')}>Endgame trainer</button>
    <button onclick={() => app.go('repertoire')}>Opening repertoire</button>
    <button class="ghost" onclick={() => app.go('onboarding')}>Re-run skill evaluation</button>
    <button class="ghost" onclick={() => app.go('settings')}>Settings</button>
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
  .actions { display: flex; flex-direction: column; gap: 0.75rem; max-width: 320px; margin: 1.5rem auto 0; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
