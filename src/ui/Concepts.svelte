<script lang="ts">
  import { app } from '../state/app.svelte';
  import ConceptCard from './ConceptCard.svelte';
  import { loadConcepts, type ConceptCard as Card } from '../concepts/concepts';

  let cards = $state<Card[]>([]);
  // Optional focus motif handed over by a contextual "Learn the pattern" link.
  const focus = $derived(app.conceptFocusMotif);

  loadConcepts().then((c) => {
    cards = c;
  });

  const visible = $derived(focus ? cards.filter((c) => c.motif === focus) : cards);
</script>

<section class="col">
  <h2>Concepts — the pattern library</h2>
  <p class="muted">Curated, offline worked examples for the tactics we detect. Reference, not a test.</p>

  {#if focus}
    <p class="feedback">
      Showing: {focus}
      <button class="link" onclick={() => (app.conceptFocusMotif = null)}>show all</button>
    </p>
  {/if}

  {#if cards.length === 0}
    <p class="muted">No concept cards available.</p>
  {:else}
    <div class="list">
      {#each visible as card (card.motif)}
        <ConceptCard {card} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .list { display: flex; flex-direction: column; gap: 1.25rem; }
  button.link { background: none; border: none; color: var(--accent); text-decoration: underline; cursor: pointer; }
</style>
