<script lang="ts">
  import Board from './Board.svelte';
  import type { ConceptCard } from '../concepts/concepts';

  interface Props {
    card: ConceptCard;
    /** Optional dismiss handler (inline-panel mode). */
    onClose?: () => void;
  }
  let { card, onClose }: Props = $props();

  // The board's side-to-move = the solver (FEN side to move). lastMove highlights the key move.
  function sideToMove(fen: string): 'white' | 'black' {
    return fen.split(' ')[1] === 'b' ? 'black' : 'white';
  }
  function keySquares(uci: string): [string, string] {
    return [uci.slice(0, 2), uci.slice(2, 4)];
  }
</script>

<article class="concept-card">
  <header class="row">
    <h3>{card.title}</h3>
    {#if onClose}
      <button class="link" onclick={onClose}>dismiss</button>
    {/if}
  </header>
  <p class="idea">{card.idea}</p>

  <div class="examples">
    {#each card.examples as ex}
      <figure class="example">
        <div class="mini-board">
          <Board
            fen={ex.fen}
            orientation={sideToMove(ex.fen)}
            turnColor={sideToMove(ex.fen)}
            viewOnly={true}
            lastMove={keySquares(ex.keyMove)}
          />
        </div>
        <figcaption class="why">{ex.why}</figcaption>
      </figure>
    {/each}
  </div>
</article>

<style>
  .concept-card { max-width: 760px; border: 1px solid var(--border, #333); border-radius: 8px; padding: 1rem; }
  .concept-card header { justify-content: space-between; align-items: baseline; }
  .idea { color: var(--muted); margin: 0.25rem 0 0.75rem; }
  .examples { display: flex; flex-wrap: wrap; gap: 1rem; }
  .example { margin: 0; width: var(--mini); }
  /* A fixed-size, clipped wrapper so the scaled board reserves correct layout space
     (no height:0 hacks, no dead rules). --scale shrinks the board; --mini is the
     wrapper's footprint at that scale. */
  .mini-board {
    --scale: 0.62;
    --mini: calc(min(82vw, 68vh, 540px) * var(--scale) + 18px * var(--scale));
    width: var(--mini);
    height: var(--mini);
    overflow: hidden;
  }
  .mini-board :global(.board-frame) { transform: scale(var(--scale)); transform-origin: top left; }
  .why { font-size: 0.85rem; color: var(--muted); margin-top: 0.4rem; }
  button.link { background: none; border: none; color: var(--accent); text-decoration: underline; cursor: pointer; }
</style>
