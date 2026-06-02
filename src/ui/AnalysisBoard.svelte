<script lang="ts">
  // Interactive MultiPV analysis board (spec E / ADR-0031). Move freely; the engine
  // shows its top lines for the current position; click a line to follow it; walk
  // back/forward. Stale results are dropped (seq token); no engine respawn per move.
  import { onMount } from 'svelte';
  import { Chess } from 'chess.js';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { winPct } from '../analysis/winProb';

  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const startFen = app.analysisFen ?? START;
  let game = $state(new ChessGame(startFen));
  let fen = $state(startFen);
  let stack = $state<string[]>([startFen]);
  let lines = $state<Array<{ uci: string; san: string; cp: number; mate?: number }>>([]);
  let thinking = $state(false);
  let seq = 0;

  function sanOf(uci: string): string {
    try {
      const c = new Chess(game.fen);
      const m = c.move({ from: uci.slice(0, 2) as never, to: uci.slice(2, 4) as never, promotion: (uci[4] ?? 'q') as never });
      return m ? m.san : uci;
    } catch {
      return uci;
    }
  }

  async function analyze() {
    const my = ++seq;
    thinking = true;
    lines = [];
    try {
      await app.engine.resetVariant();
      const res = await app.engine.analyzeLines(game.fen, { multipv: 3, movetime: 600 });
      if (my !== seq) return;
      lines = res.filter((l) => l.uci).map((l) => ({ uci: l.uci as string, san: sanOf(l.uci as string), cp: l.whiteCp, mate: l.mate }));
    } catch {
      /* ignore */
    } finally {
      if (my === seq) thinking = false;
    }
  }
  onMount(analyze);

  function advance() {
    stack.push(game.fen);
    fen = game.fen;
    analyze();
  }
  function onMove(from: string, to: string) {
    if (!game.move(from, to, 'q')) return;
    advance();
  }
  function playLine(uci: string) {
    if (game.moveUci(uci)) advance();
  }
  function back() {
    if (stack.length <= 1) return;
    stack.pop();
    const f = stack[stack.length - 1];
    game = new ChessGame(f);
    fen = f;
    analyze();
  }
  function reset() {
    stack = [startFen];
    game = new ChessGame(startFen);
    fen = startFen;
    analyze();
  }

  function turnColor(): 'white' | 'black' {
    return game.turn === 'w' ? 'white' : 'black';
  }
  // Eval bar (White POV): white's win% from the top line.
  const topWhitePct = $derived(lines.length ? winPct(lines[0].cp) : 50);
  function fmtCp(cp: number, mate?: number): string {
    if (mate != null) return `#${mate}`;
    const v = (cp / 100).toFixed(1);
    return cp >= 0 ? `+${v}` : v;
  }
</script>

<section class="col center">
  <h2>Analysis board</h2>
  <div class="row" style="gap:1rem;align-items:stretch">
    <div class="evalbar" title="White winning chance">
      <div class="evalfill" style="height:{topWhitePct}%"></div>
    </div>
    <div class="board-wrap">
      <Board
        {fen}
        orientation="white"
        turnColor={turnColor()}
        movableColor={turnColor()}
        dests={game.dests()}
        check={game.inCheck()}
        {onMove}
      />
    </div>
  </div>

  <div class="col" style="gap:0.2rem;width:100%;max-width:420px">
    <h4>Engine lines {thinking ? '…' : ''}</h4>
    {#each lines as l (l.uci)}
      <button class="line panel" onclick={() => playLine(l.uci)}>
        <span><b>{fmtCp(l.cp, l.mate)}</b> &nbsp; {l.san}</span>
      </button>
    {/each}
    {#if !lines.length && !thinking}<p class="muted">No legal moves (game over).</p>{/if}
  </div>

  <div class="row center">
    <button onclick={back} disabled={stack.length <= 1}>← Back</button>
    <button class="ghost" onclick={reset}>Reset</button>
  </div>
</section>

<style>
  .evalbar { width: 16px; background: #111; border-radius: 3px; overflow: hidden; align-self: stretch; display: flex; flex-direction: column-reverse; }
  .evalfill { width: 100%; background: #eee; transition: height 0.2s; }
  .line { text-align: left; cursor: pointer; background: var(--panel); border: 1px solid var(--border); color: var(--text); }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  h4 { color: var(--muted); margin: 0.5rem 0 0; }
</style>
