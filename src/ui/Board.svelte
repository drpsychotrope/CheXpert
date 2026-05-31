<script lang="ts">
  // chessground wrapper. Owns the Chessground instance; reacts to prop changes.
  import { onMount, onDestroy } from 'svelte';
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
</script>

<div class="board-wrap">
  <div class="cg-board-host" bind:this={el}></div>
</div>

<style>
  .board-wrap {
    width: min(80vw, 70vh, 560px);
    aspect-ratio: 1 / 1;
  }
  .cg-board-host {
    width: 100%;
    height: 100%;
  }
</style>
