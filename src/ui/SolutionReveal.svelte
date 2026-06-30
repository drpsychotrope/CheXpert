<script lang="ts">
  // Reusable "show the solution" surface (F4, extracted from Calculate.revealSolution —
  // AP-TEACH-1: the 350 ms stepper + SAN-line build live HERE, not duplicated per consumer).
  // Animates a fresh ChessGame through a UCI line on a view-only board, prints a numbered SAN
  // line (calc.solution, reused), and optionally shows a fact-derived "why" line.
  //
  // Pure-ish: NO store reads, NO persistence, NO engine — fully driven by props. Owns its own
  // setTimeout chain and clears it on destroy (mirrors Calculate's clearRevealTimer).
  import { onMount, onDestroy } from 'svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { formatSanLine } from '../calc/calc';
  import { t } from '../i18n';

  interface Props {
    /** Start FEN of the line. */
    fen: string;
    /** UCI solution line (user/opponent alternating); may be empty / short / illegal mid-line. */
    moves: string[];
    orientation: 'white' | 'black';
    /** Optional fact-derived line; SOURCE-AGNOSTIC (FOLD-4): Trainer passes missWhy(...),
     *  Coach (C6) passes an explainPly-derived line through this SAME prop. */
    why?: string | null;
    /** Default true. Calculate=true; Trainer toggles it on when revealing. */
    autoplay?: boolean;
    /** Per-ply delay (ms). Default 350 (matches Calculate). 0 = instant (no animation). */
    stepMs?: number;
    /** Optional callback fired when playback finishes (or completes instantly). */
    onDone?: () => void;
  }

  let { fen, moves, orientation, why = null, autoplay = true, stepMs = 350, onDone }: Props = $props();

  // FOLD-2 (a11y / render fidelity): honor the OS reduced-motion preference → collapse to an
  // instant render of the final position (equivalent to stepMs=0), still printing the full SAN
  // line. stepMs is the seam (matches Board.svelte's reduceMotion handling).
  const reduceMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const effectiveStepMs = $derived(reduceMotion ? 0 : stepMs);

  // SAN line is a pure function of (fen, moves): build it eagerly so it shows immediately,
  // independent of the animation. FOLD-3: moveUci(m) ?? m falls back to raw UCI for an illegal
  // mid-line ply (and short/empty lines just yield a short/empty line) — exactly as Calculate does.
  const solutionSan = $derived.by(() => {
    const sanGame = new ChessGame(fen);
    const san: string[] = [];
    for (const m of moves) san.push(sanGame.moveUci(m) ?? m);
    return formatSanLine(san);
  });

  // Board playback state, driven by the stepper. `playedFen` is null until playback produces a
  // position; the board then shows `playedFen ?? fen` (reactive on the start FEN until then), so
  // we never seed $state from a prop (no stale-capture).
  let playedFen = $state<string | null>(null);
  let lastMove = $state<[string, string] | null>(null);
  const boardFen = $derived(playedFen ?? fen);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let started = false;

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }
  onDestroy(clearTimer);

  /** Step the board through the real line, reassigning fen + lastMove each ply (FOLD-1: the
   *  key move is highlighted via lastMove). Tolerates empty/short/illegal lines: it applies
   *  whatever is legal and stops cleanly; an illegal moveUci returns null without mutating, so
   *  the stepper simply advances (FOLD-3) — it never throws. */
  function play() {
    if (started) return;
    started = true;
    clearTimer();
    const stepGame = new ChessGame(fen);

    if (effectiveStepMs <= 0) {
      // Instant: jump to the final position, highlighting the last applied ply.
      let last: [string, string] | null = null;
      for (const m of moves) {
        if (stepGame.moveUci(m) != null) last = [m.slice(0, 2), m.slice(2, 4)];
      }
      playedFen = stepGame.fen;
      lastMove = last;
      onDone?.();
      return;
    }

    playedFen = stepGame.fen;
    lastMove = null;
    let i = 0;
    const step = () => {
      if (i >= moves.length) { timer = null; onDone?.(); return; }
      const m = moves[i];
      if (stepGame.moveUci(m) != null) {
        playedFen = stepGame.fen;
        lastMove = [m.slice(0, 2), m.slice(2, 4)];
      }
      i += 1;
      timer = setTimeout(step, effectiveStepMs);
    };
    timer = setTimeout(step, effectiveStepMs);
  }

  onMount(() => {
    if (autoplay) play();
  });
</script>

<div class="col center reveal">
  <div class="board-wrap">
    <Board fen={boardFen} {orientation} viewOnly {lastMove} />
  </div>
  {#if solutionSan}
    <p class="muted solution">{t('calc.solution', { line: solutionSan })}</p>
  {/if}
  {#if why}
    <p class="muted why">{why}</p>
  {/if}
</div>

<style>
  .reveal { gap: 0.5rem; }
  .solution { font-size: 0.9rem; max-width: 440px; }
  .why { font-size: 0.9rem; max-width: 440px; }
</style>
