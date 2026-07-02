<script lang="ts">
  // Concept card (ADR-0040) + PR-19a (ADR-0077): the FIRST example is now "your turn" —
  // teach-then-try. The key move is hidden and the mini-board is live; play the motif's move to
  // solve it (exact match — the same honest contract as guess-the-move, ADR-0017). A miss keeps
  // the position and offers a reveal. The remaining examples stay annotated worked examples.
  // `onTryResult` fires ONCE when the try resolves (solved or revealed) — PR-19b's SRS grading
  // consumer hook; without a listener the card behaves standalone.
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import type { ConceptCard } from '../concepts/concepts';
  import { t } from '../i18n';

  interface Props {
    card: ConceptCard;
    /** Optional dismiss handler (inline-panel mode). */
    onClose?: () => void;
    /** PR-19b hook: called once when the "your turn" example resolves. */
    onTryResult?: (solved: boolean) => void;
  }
  let { card, onClose, onTryResult }: Props = $props();

  // The board's side-to-move = the solver (FEN side to move). lastMove highlights the key move.
  function sideToMove(fen: string): 'white' | 'black' {
    return fen.split(' ')[1] === 'b' ? 'black' : 'white';
  }
  function keySquares(uci: string): [string, string] {
    return [uci.slice(0, 2), uci.slice(2, 4)];
  }

  // ── PR-19a "your turn" state (reset when the card changes) ──
  let tryState = $state<'pending' | 'solved' | 'revealed'>('pending');
  let tryFeedback = $state('');
  let missed = $state(false);
  let tryGame = $state(new ChessGame());
  let tryFen = $state('');

  $effect(() => {
    // New card → fresh try on its first example.
    void card.motif;
    const first = card.examples[0];
    tryState = 'pending';
    tryFeedback = '';
    missed = false;
    if (first) {
      tryGame = new ChessGame(first.fen);
      tryFen = tryGame.fen;
    }
  });

  function norm(uci: string): string {
    return uci.length === 4 ? uci + 'q' : uci;
  }

  function onTryMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    const first = card.examples[0];
    if (!first || tryState !== 'pending') return;
    const uci = from + to + (tryGame.isPromotion(from, to) ? promo : '');
    if (norm(uci) === norm(first.keyMove)) {
      tryGame.move(from, to, promo);
      tryFen = tryGame.fen;
      tryState = 'solved';
      tryFeedback = t('concepts.trySolved');
      onTryResult?.(true);
    } else {
      missed = true;
      tryFeedback = t('concepts.tryWrong');
      tryFen = tryGame.fen; // re-sync the board back (the move was never applied)
    }
  }

  function revealTry() {
    if (tryState !== 'pending') return;
    tryState = 'revealed';
    tryFeedback = '';
    onTryResult?.(false);
  }
</script>

<article class="concept-card">
  <header class="row">
    <h3>{card.title}</h3>
    {#if onClose}
      <button class="link" onclick={onClose}>{t('concepts.dismiss')}</button>
    {/if}
  </header>
  <p class="idea">{card.idea}</p>

  <div class="examples">
    {#each card.examples as ex, i (ex.fen)}
      <figure class="example">
        {#if i === 0}
          <!-- PR-19a: teach-then-try — live board until solved/revealed, then the worked example. -->
          <div class="mini-board">
            {#if tryState === 'pending'}
              <Board
                fen={tryFen}
                orientation={sideToMove(ex.fen)}
                turnColor={sideToMove(ex.fen)}
                showTurn={true}
                turnLabel="play"
                movableColor={sideToMove(ex.fen)}
                dests={tryGame.dests()}
                check={tryGame.inCheck()}
                onMove={onTryMove}
              />
            {:else}
              <Board
                fen={tryState === 'solved' ? tryFen : ex.fen}
                orientation={sideToMove(ex.fen)}
                turnColor={sideToMove(ex.fen)}
                viewOnly={true}
                lastMove={keySquares(ex.keyMove)}
              />
            {/if}
          </div>
          {#if tryState === 'pending'}
            <figcaption class="why">
              {t('concepts.tryPrompt')}
              {#if tryFeedback}<span class="try-bad"> {tryFeedback}</span>{/if}
              {#if missed}
                <button class="link" onclick={revealTry}>{t('concepts.tryReveal')}</button>
              {/if}
            </figcaption>
          {:else}
            <figcaption class="why">
              {#if tryState === 'solved'}<span class="try-good">{tryFeedback}</span> {/if}{ex.why}
            </figcaption>
          {/if}
        {:else}
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
        {/if}
      </figure>
    {/each}
  </div>
</article>

<style>
  .concept-card { max-width: 760px; border: 1px solid var(--border, #333); border-radius: 8px; padding: 1rem; }
  .concept-card header { justify-content: space-between; align-items: baseline; }
  .idea { color: var(--muted); margin: 0.25rem 0 0.75rem; }
  .examples { display: flex; flex-wrap: wrap; gap: 1rem; }
  .example { margin: 0; }
  /* Shrink the board by sizing it directly via --board-size (read by Board's
     .board-frame), NOT via `transform: scale()`. chessground places pieces with
     pixel offsets derived from getBoundingClientRect(); a transformed ancestor
     corrupts that measurement and the pieces drift off their squares. The board's
     own multiple-of-8 flooring keeps the rank/file gutters aligned at this size. */
  .mini-board { --board-size: min(51vw, 42vh, 336px); }
  .why { font-size: 0.85rem; color: var(--muted); margin-top: 0.4rem; }
  .try-good { color: var(--good); font-weight: 600; }
  .try-bad { color: var(--bad); }
  button.link { background: none; border: none; color: var(--accent); text-decoration: underline; cursor: pointer; }
</style>
