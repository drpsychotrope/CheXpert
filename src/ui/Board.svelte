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

  interface Props {
    fen: string;
    orientation?: 'white' | 'black';
    turnColor?: 'white' | 'black';
    movableColor?: 'white' | 'black' | 'both' | undefined;
    dests?: Map<string, string[]>;
    viewOnly?: boolean;
    lastMove?: [string, string] | null;
    check?: boolean;
    onMove?: (from: string, to: string) => void;
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
  }: Props = $props();

  let el: HTMLDivElement;
  let cg: Api | null = null;

  function toDests(d: Map<string, string[]>): Map<Key, Key[]> {
    return d as unknown as Map<Key, Key[]>;
  }

  function config(): Config {
    return {
      fen,
      orientation,
      turnColor,
      viewOnly,
      check,
      // Disable chessground's own coordinate labels — their absolute positioning
      // fought our board frame and drifted by a square. We render our own labels
      // in the gutters below, so they cannot desync from the squares.
      coordinates: false,
      lastMove: lastMove ? (lastMove as Key[]) : undefined,
      movable: {
        free: false,
        color: movableColor,
        dests: toDests(dests),
        showDests: true,
        events: {
          after: (from: Key, to: Key) => onMove?.(from as string, to as string),
        },
      },
      animation: { enabled: true, duration: 200 },
      highlight: { lastMove: true, check: true },
      drawable: { enabled: true },
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

<div class="board-frame">
  <!-- rank labels (left gutter), one flex cell per row, aligned to the board grid -->
  <div class="ranks">
    {#each ranks as r}<span>{r}</span>{/each}
  </div>
  <div class="cg-board-host" bind:this={el}></div>
  <!-- file labels (bottom gutter), one flex cell per column -->
  <div class="files">
    {#each files as f}<span>{f}</span>{/each}
  </div>
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
       chessground board == 8 equal squares, so gutter cells line up by construction. */
    --board: round(down, min(82vw, 68vh, 540px), 8px);
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
    color: #111;
    font-size: 11px;
    font-weight: 700;
    opacity: 0.85;
  }
</style>
