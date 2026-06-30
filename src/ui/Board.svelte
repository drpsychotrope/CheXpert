<script lang="ts">
  // chessground wrapper. Owns the Chessground instance; reacts to prop changes.
  import { onMount, onDestroy } from 'svelte';
  // chessground's package.json `exports` maps "." → "./dist/chessground.js", so the
  // bare specifier is correct. (An earlier "failed to resolve" was a stale Vite
  // dep-cache artifact, cleared with `rm -rf node_modules/.vite`.)
  import { Chessground } from 'chessground';
  import type { Api } from 'chessground/api';
  import type { Config } from 'chessground/config';
  import type { Key } from 'chessground/types';
  import {
    isPromotionMove,
    PROMOTION_ORDER,
    PROMOTION_GLYPH,
    type PromotionPiece,
  } from './promotion';
  import { t } from '../i18n';

  interface Props {
    fen: string;
    orientation?: 'white' | 'black';
    turnColor?: 'white' | 'black';
    movableColor?: 'white' | 'black' | 'both' | undefined;
    dests?: Map<string, string[]>;
    viewOnly?: boolean;
    lastMove?: [string, string] | null;
    check?: boolean;
    onMove?: (from: string, to: string, promo?: PromotionPiece) => void;
    /** Hide the rank/file gutter labels (unlabeled board for the coordinate drill). ADR-0043. */
    coords?: boolean;
    /** Single-square click handler (chessground `events.select`). Enables `selectable`. ADR-0043. */
    onSelect?: (square: string) => void;
    /** Programmatic arrows drawn over the board (chessground autoShapes). [from, to] UCI-square
     *  pairs. Does not interfere with user-drawn shapes; no effect when empty. ADR-0044. */
    arrows?: Array<[string, string]>;
    /** Show a side-to-move badge above the board (ADR-0046). Solve drills flip orientation per
     *  puzzle, so the side you play must be stated. Derived from `turnColor`. */
    showTurn?: boolean;
    /** Badge phrasing: 'play' → "You play Black" (drills where you play the side to move);
     *  'move' → "Black to move" (count/illustration drills). */
    turnLabel?: 'play' | 'move';
    /** Optional keyboard move entry: resolve + apply a typed SAN/UCI/coordinate move and
     *  return true if applied. When set (and not view-only), renders an accessible text input
     *  under the board so a move can be made without a mouse (audit v2 C-4 / P0-04, WCAG 2.1.1). */
    onMoveText?: (text: string) => boolean;
  }

  let {
    fen,
    orientation = 'white',
    turnColor = 'white',
    movableColor = undefined,
    dests = new Map(),
    viewOnly = false,
    lastMove = null,
    check = false,
    onMove,
    coords = true,
    onSelect,
    arrows = [],
    showTurn = false,
    turnLabel = 'move',
    onMoveText,
  }: Props = $props();

  // chessground executes a drag as a real move only when its `turnColor` equals the side
  // to move; when they disagree it treats the drag as a (never-applied) premove. The side
  // to move is a fact OF the position, so derive it from `fen` — the one reactive input
  // every caller refreshes on each move — rather than trusting the separately-passed
  // `turnColor` prop. Callers computed that prop from a ChessGame held in $state, which
  // Svelte 5 does NOT deep-proxy: the engine's reply MUTATES the game without reassigning
  // it, so the prop's derived never recomputed and stayed frozen at its initial value
  // (e.g. 'white' while Black was to move). That silently turned every move by a
  // Black-playing human into a premove — pieces grabbable, moves never applied. Deriving
  // from `fen` keeps turnColor in lockstep with the rendered position in every game mode
  // (ADR-0050). The `turnColor` prop is kept only as a fallback for a fen with no side field.
  const sideToMove = $derived<'white' | 'black'>(
    fen.split(' ')[1] === 'b' ? 'black' : fen.split(' ')[1] === 'w' ? 'white' : turnColor,
  );
  const colorName = $derived(sideToMove === 'white' ? t('color.white') : t('color.black'));
  const turnText = $derived(
    turnLabel === 'play' ? t('board.youPlay', { color: colorName }) : t('board.toMove', { color: colorName }),
  );

  let el: HTMLDivElement;
  // `bind:this` ref we also read imperatively (focus-return, FOLD A1). Svelte 5 flags a
  // plain `let` that is both bound and read as non-reactive, so declare it as $state.
  let kbInput = $state<HTMLInputElement | null>(null);
  let cg: Api | null = null;
  // The board is keyboard/text-playable only when a text resolver is wired AND it isn't view-only —
  // the same condition that renders the move form below. Label the region accordingly so AT users are
  // told the typed-move path exists, without over-promising on view-only/drag-only boards (WCAG 1.3.1).
  const interactive = $derived(!viewOnly && !!onMoveText);
  // Honor the OS reduced-motion preference: no piece-slide animation (audit v2 W13 / WCAG 2.3.3).
  const reduceMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Promotion picker (audit W4): chessground's `after` gives only (from,to). When the move is
  // a pawn reaching the last rank, pause and ask which piece, then forward it to onMove.
  let pendingPromo = $state<{ from: string; to: string } | null>(null);

  function handleAfter(from: string, to: string) {
    if (!onMove) return;
    if (isPromotionMove(fen, from, to)) pendingPromo = { from, to };
    else onMove(from, to);
  }
  function choosePromo(piece: PromotionPiece) {
    const mv = pendingPromo;
    pendingPromo = null;
    if (mv) onMove?.(mv.from, mv.to, piece);
  }
  function cancelPromo() {
    pendingPromo = null;
    cg?.set(config()); // revert chessground's optimistic pawn move back to the real position
  }

  // Keyboard move entry (audit v2 P0-04): a typed SAN/UCI move applied via the caller's resolver,
  // giving a no-mouse path to play on every board. The error is an aria-live region for AT users.
  let kbMove = $state('');
  let kbError = $state('');
  // Polite success counterpart to the assertive error region (FOLD A3): a single bounded status
  // string announced when a typed move applies, cleared on the next attempt so it never lingers.
  let kbStatus = $state('');
  function submitKbMove(e: Event) {
    e.preventDefault();
    const text = kbMove.trim();
    if (!text || !onMoveText) return;
    if (onMoveText(text)) {
      kbMove = '';
      kbError = '';
      kbStatus = t('board.movePlayed'); // polite announcement (FOLD A3)
      kbInput?.focus(); // keep focus in the field so a second move needs no re-tab (FOLD A1)
    } else {
      kbError = t('board.notLegal', { move: text });
      kbStatus = ''; // clear any prior success so AT doesn't re-announce a stale "move played"
    }
  }

  function toDests(d: Map<string, string[]>): Map<Key, Key[]> {
    return d as unknown as Map<Key, Key[]>;
  }

  function config(): Config {
    return {
      fen,
      orientation,
      turnColor: sideToMove,
      viewOnly,
      check,
      // Disable chessground's own coordinate labels — their absolute positioning
      // fought our board frame and drifted by a square. We render our own labels
      // in the gutters below, so they cannot desync from the squares.
      coordinates: false,
      lastMove: lastMove ? (lastMove as Key[]) : undefined,
      // ADR-0043: when onSelect is set, enable square selection so an empty-square tap fires
      // `events.select` (chessground does not emit it otherwise).
      // Always enabled so click/tap-to-move works on every board (drag alone left tap-tap dead,
      // esp. on touch — audit v2 H38). onSelect (empty-square drills) still fires via events.select.
      selectable: { enabled: true },
      movable: {
        free: false,
        color: movableColor,
        dests: toDests(dests),
        showDests: true,
        events: {
          after: (from: Key, to: Key) => handleAfter(from as string, to as string),
        },
      },
      events: {
        select: (key: Key) => onSelect?.(key as string),
      },
      animation: { enabled: !reduceMotion, duration: reduceMotion ? 0 : 200 },
      highlight: { lastMove: true, check: true },
      drawable: {
        enabled: true,
        autoShapes: arrows.map(([orig, dest]) => ({ orig: orig as Key, dest: dest as Key, brush: 'green' })),
      },
    };
  }

  onMount(() => {
    cg = Chessground(el, config());
  });

  onDestroy(() => cg?.destroy());

  // Re-sync whenever inputs change.
  $effect(() => {
    if (!cg) return;
    cg.set(config());
  });

  // Our own coordinate labels, ordered to match `orientation`. White view: files
  // a→h, ranks 8→1 (top to bottom). Black view: both reversed.
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const files = $derived(orientation === 'white' ? FILES : [...FILES].reverse());
  const ranks = $derived(orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]);
</script>

<div class="board-shell" class:has-turn={showTurn}>
  {#if showTurn}
    <div class="turn-badge"><span class="disc {sideToMove}"></span>{turnText}</div>
  {/if}
  <div class="board-frame">
  <!-- rank labels (left gutter), one flex cell per row, aligned to the board grid -->
  {#if coords}
    <div class="ranks">
      {#each ranks as r}<span>{r}</span>{/each}
    </div>
  {/if}
  <!-- Region aria (single source): interactive boards expose a group whose label states the typed-move
       path exists; view-only / drag-only boards get a positional img label only. role="grid" per-square
       navigation is deferred (spec §11 D1) — announcing a grid with no arrow model would mislead AT. -->
  <div
    class="cg-board-host"
    bind:this={el}
    role={interactive ? 'group' : 'img'}
    aria-label={interactive ? t('board.label') : t('board.labelView')}
  ></div>
  <!-- file labels (bottom gutter), one flex cell per column -->
  {#if coords}
    <div class="files">
      {#each files as f}<span>{f}</span>{/each}
    </div>
  {/if}
  </div>
  {#if onMoveText && !viewOnly}
    <form class="kbmove" onsubmit={submitKbMove}>
      <label class="kbmove-label" for="kbmove-input">{t('board.kbMove')}</label>
      <input
        id="kbmove-input"
        class="kbmove-input"
        bind:this={kbInput}
        bind:value={kbMove}
        placeholder={t('board.kbPlaceholder')}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-describedby="kbmove-err"
      />
      <button type="submit">{t('board.kbPlay')}</button>
      <span id="kbmove-err" class="kbmove-err" role="alert" aria-live="assertive">{kbError}</span>
      <!-- Polite success status (FOLD A3): visually hidden; announced after a typed move applies. -->
      <span class="sr-only" role="status" aria-live="polite">{kbStatus}</span>
    </form>
  {/if}
  {#if pendingPromo}
    <div class="promo-overlay">
      <button class="promo-backdrop" type="button" aria-label={t('board.cancelPromotion')} onclick={cancelPromo}></button>
      <div class="promo-card" role="dialog" aria-label={t('board.choosePromo')}>
        <p class="promo-title">{t('board.promoteTo')}</p>
        <div class="promo-pieces">
          {#each PROMOTION_ORDER as pc (pc)}
            <button
              class="promo-btn"
              type="button"
              aria-label={t('piece.' + pc)}
              onclick={() => choosePromo(pc)}
            >{PROMOTION_GLYPH[sideToMove][pc]}</button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Grid: a left gutter for rank labels, the square board, and a bottom gutter for
     file labels. The board cell is square via aspect-ratio; labels live OUTSIDE it
     in the gutters, so they can never overlap or drift onto the squares. */
  .board-frame {
    /* Floor the board to a multiple of 8px so chessground (which rounds its board
       DOWN to a multiple of 8 for integer squares) fills the host exactly — otherwise
       the host is e.g. 540px, chessground renders 536px, and the rank/file gutters
       (sized to the host) drift ~4px against the squares. Multiple-of-8 → host ==
       chessground board == 8 equal squares, so gutter cells line up by construction.
       --board-size lets a host shrink the board by its real size (e.g. ConceptCard's
       mini-board). Do NOT shrink via an ancestor `transform: scale()`: chessground
       positions pieces with getBoundingClientRect()-derived pixel offsets, and a
       transformed ancestor corrupts that measurement so pieces drift off their squares. */
    --board: round(down, var(--board-size, min(82vw, 68vh, 540px)), 8px);
    --gutter: 18px;
    display: grid;
    grid-template-columns: var(--gutter) var(--board);
    grid-template-rows: var(--board) var(--gutter);
    flex: 0 0 auto;
  }
  .cg-board-host {
    grid-column: 2;
    grid-row: 1;
    width: var(--board);
    height: var(--board);
  }
  /* Rank labels: a column beside the board, evenly split into 8 rows. */
  .ranks {
    grid-column: 1;
    grid-row: 1;
    display: flex;
    flex-direction: column;
  }
  .ranks span {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* File labels: a row under the board, evenly split into 8 columns. */
  .files {
    grid-column: 2;
    grid-row: 2;
    display: flex;
  }
  .files span {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ranks span,
  .files span {
    /* Labels live in the gutters on the app's dark background, not on the squares,
       so they must use the theme's muted text colour (a dark colour is invisible). */
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
  }
  /* Side-to-move badge (ADR-0046). board-shell is display:contents by default — zero layout
     effect — and becomes a centering column only when the badge is shown. */
  .board-shell { display: contents; }
  .board-shell.has-turn { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
  .turn-badge { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.9rem; font-weight: 600; color: var(--text); }
  .disc { display: inline-block; width: 0.85em; height: 0.85em; border-radius: 50%; border: 1px solid var(--border); }
  .disc.white { background: #ececec; }
  .disc.black { background: #2b2b2b; }

  /* Promotion picker overlay (ADR-0052 / audit W4). */
  .promo-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; }
  .promo-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.5); border: none; padding: 0; margin: 0; cursor: pointer; }
  .promo-card { position: relative; background: var(--panel, #2b2b2b); border: 1px solid var(--border, #444); border-radius: 10px; padding: 1rem 1.2rem; text-align: center; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4); }
  .promo-title { margin: 0 0 0.6rem; font-size: 0.9rem; color: var(--muted, #aaa); }
  .promo-pieces { display: flex; gap: 0.4rem; }
  .promo-btn { font-size: 2.2rem; line-height: 1; width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; background: var(--panel-2, #1f1f1f); border: 1px solid var(--border, #444); border-radius: 8px; cursor: pointer; color: var(--text, #eee); }
  .promo-btn:hover { background: var(--accent, #4a90d9); color: #000; }

  /* Keyboard move entry (audit v2 P0-04). */
  .kbmove { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; margin-top: 0.5rem; }
  .kbmove-label { font-size: 0.8rem; color: var(--muted); }
  .kbmove-input { flex: 0 1 9rem; min-width: 7rem; }
  .kbmove-err { font-size: 0.8rem; color: var(--bad, #e06c6c); min-height: 1em; }
  /* Visually hidden but exposed to assistive tech (FOLD A3 polite status). */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
