<script lang="ts">
  import { app } from '../state/app.svelte';
  import ConceptCard from './ConceptCard.svelte';
  import { loadConcepts, type ConceptCard as Card } from '../concepts/concepts';
  import { t, getLocale } from '../i18n';

  let cards = $state<Card[]>([]);
  // Optional focus motif handed over by a contextual "Learn the pattern" link.
  const focus = $derived(app.conceptFocusMotif);

  // Load (and re-load on language switch): reading getLocale() inside the effect
  // tracks the reactive locale, so flipping FR/EN refetches the matching seed.
  $effect(() => {
    const loc = getLocale();
    loadConcepts(loc).then((c) => {
      cards = c;
    });
  });

  const visible = $derived(focus ? cards.filter((c) => c.motif === focus) : cards);
</script>

<section class="col">
  <h2>{t('concepts.title')}</h2>
  <p class="muted">{t('concepts.subtitle')}</p>

  {#if focus}
    <p class="feedback">
      {t('concepts.showing', { focus })}
      <button class="link" onclick={() => (app.conceptFocusMotif = null)}>{t('concepts.showAll')}</button>
    </p>
  {/if}

  {#if cards.length === 0}
    <p class="muted">{t('concepts.noCards')}</p>
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
