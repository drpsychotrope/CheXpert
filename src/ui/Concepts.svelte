<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import ConceptCard from './ConceptCard.svelte';
  import { loadConcepts, type ConceptCard as Card } from '../concepts/concepts';
  import { dueCards, reviewItem } from '../srs/SrsStore';
  import { Grade } from '../srs/fsrs';
  import { t, getLocale } from '../i18n';

  let cards = $state<Card[]>([]);
  // Optional focus motif handed over by a contextual "Learn the pattern" link.
  const focus = $derived(app.conceptFocusMotif);
  // PR-19b (ADR-0077): concept cards due for review — resurfaced HERE (deliberately not in the
  // Review badge, which counts puzzle+repertoire; a concept refresh is a library moment).
  let dueMotifs = $state<string[]>([]);

  onMount(async () => {
    try {
      dueMotifs = (await dueCards(Date.now(), 'concept', 20)).map((c) => c.refId);
    } catch {
      dueMotifs = [];
    }
  });

  // Load (and re-load on language switch): reading getLocale() inside the effect
  // tracks the reactive locale, so flipping FR/EN refetches the matching seed.
  $effect(() => {
    const loc = getLocale();
    loadConcepts(loc).then((c) => {
      cards = c;
    });
  });

  const visible = $derived(focus ? cards.filter((c) => c.motif === focus) : cards);

  /** PR-19b: the "your turn" outcome grades the concept's FSRS card (solved → Good, revealed →
   *  Again). Best-effort; the card view never blocks on storage. */
  function gradeConcept(motif: string, solved: boolean) {
    void reviewItem('concept', motif, solved ? Grade.Good : Grade.Again, Date.now())
      .then(() => {
        dueMotifs = dueMotifs.filter((m) => m !== motif);
      })
      .catch(() => {});
  }
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

  <!-- PR-19b (ADR-0077): due concept refreshers — one click filters to that card. -->
  {#if dueMotifs.length && !focus}
    <p class="feedback">
      {t('concepts.dueLine')}
      {#each dueMotifs as m (m)}
        <button class="link" onclick={() => (app.conceptFocusMotif = m)}>{m}</button>
      {/each}
    </p>
  {/if}

  {#if cards.length === 0}
    <p class="muted">{t('concepts.noCards')}</p>
  {:else}
    <div class="list">
      {#each visible as card (card.motif)}
        <ConceptCard {card} onTryResult={(solved) => gradeConcept(card.motif, solved)} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .list { display: flex; flex-direction: column; gap: 1.25rem; }
  button.link { background: none; border: none; color: var(--accent); text-decoration: underline; cursor: pointer; }
</style>
