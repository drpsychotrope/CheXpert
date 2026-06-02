<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { ENDGAME_DRILLS, type EndgameDrill } from '../endgame/drills';
  import { TablebaseClient, withinTablebase, NetworkNotAllowedError, type TablebaseResult } from '../endgame/syzygy';
  import { tbCacheGet, tbCacheSet } from '../endgame/tablebaseCache';

  let drill = $state<EndgameDrill | null>(null);
  let game = $state(new ChessGame());
  let fen = $state('8/8/8/8/8/8/8/8 w - - 0 1');
  let playerColor = $state<'white' | 'black'>('white');
  let lastMove = $state<[string, string] | null>(null);
  let status = $state<'idle' | 'playing' | 'thinking' | 'over'>('idle');
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');
  let tb = $state<TablebaseResult | null>(null);
  let tbError = $state('');

  const settings = $derived(app.settings);
  const networkOff = $derived(!(app.settings?.allowNetwork ?? false));

  const client = new TablebaseClient({
    allowNetwork: () => app.settings?.allowNetwork ?? false,
    cacheGet: tbCacheGet,
    cacheSet: tbCacheSet,
  });

  function start(d: EndgameDrill) {
    drill = d;
    game = new ChessGame(d.fen);
    fen = game.fen;
    playerColor = game.turn === 'w' ? 'white' : 'black';
    lastMove = null;
    status = 'playing';
    feedback = '';
    feedbackKind = '';
    tb = null;
    tbError = '';
    void probe();
  }

  /** Probe the current position for tablebase truth (best move + DTZ/WDL). */
  async function probe() {
    tbError = '';
    if (!withinTablebase(game.fen)) {
      tb = null;
      return;
    }
    try {
      tb = await client.probe(game.fen);
    } catch (e) {
      tb = null;
      tbError =
        e instanceof NetworkNotAllowedError
          ? e.message
          : `Tablebase lookup failed (${e instanceof Error ? e.message : 'unknown'}).`;
    }
  }

  function turnColor(): 'white' | 'black' {
    return game.turn === 'w' ? 'white' : 'black';
  }

  async function onMove(from: string, to: string) {
    if (status !== 'playing' || turnColor() !== playerColor) return;

    // Grade the move against the tablebase BEFORE making it (we have tb for this pos).
    const uci = from + to + (game.isPromotion(from, to) ? 'q' : '');
    const truth = tb;
    const san = game.move(from, to, 'q');
    if (!san) return;
    fen = game.fen;
    lastMove = [from, to];

    if (truth && truth.moves.length) {
      const best = truth.moves[0];
      const played = truth.moves.find((m) => m.uci === uci);
      if (played && best && played.category === best.category && played.dtz === best.dtz) {
        feedback = `Perfect — keeps the ${best.category}.`;
        feedbackKind = 'good';
      } else if (played) {
        feedback = `Tablebase: that move is "${played.category}". Best was ${best.san ?? best.uci} (keeps the ${best.category}).`;
        feedbackKind = 'bad';
      } else {
        feedback = `Best by tablebase was ${best.san ?? best.uci}.`;
        feedbackKind = '';
      }
    } else if (tbError) {
      // Distinguish "consent off" from an actual lookup failure (don't claim the
      // network is off when it's on and the request simply failed).
      feedback = networkOff
        ? 'Playing without tablebase feedback (network off — enable it in Settings).'
        : 'Playing without tablebase feedback (tablebase lookup failed).';
      feedbackKind = '';
    }

    if (checkEnd()) return;
    await engineReply();
  }

  async function engineReply() {
    status = 'thinking';
    try {
      // Prefer the tablebase's best defensive move; fall back to the engine.
      await probe();
      let uci: string | null = null;
      if (tb && tb.moves.length) uci = tb.moves[0].uci;
      if (!uci) {
        await app.engine.resetVariant();
        const r = await app.engine.evaluate(game.fen, { movetime: 300 });
        uci = r.bestmove;
      }
      if (uci) {
        game.moveUci(uci);
        fen = game.fen;
        lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
      }
    } catch {
      /* ignore */
    }
    if (!checkEnd()) {
      status = 'playing';
      await probe();
    }
  }

  function checkEnd(): boolean {
    const t = game.terminal();
    if (!t.over) return false;
    status = 'over';
    if (t.reason === 'checkmate') {
      const winner = t.winner === playerColor[0] ? 'You' : 'Engine';
      feedback = `Checkmate — ${winner} win${winner === 'You' ? '' : 's'}.`;
      feedbackKind = winner === 'You' ? 'good' : 'bad';
    } else {
      feedback = `Draw (${t.reason}).`;
      feedbackKind = '';
    }
    return true;
  }
</script>

<section class="col center">
  <h2>Endgame trainer</h2>
  <p class="muted">Play out fundamental endgames against the engine with perfect feedback from the Syzygy tablebase (≤7 pieces).</p>

  {#if settings && !settings.allowNetwork}
    <p class="muted" style="font-size:0.85rem;max-width:520px">
      Tablebase feedback needs network access (off by default). Enable it in
      <button class="link" onclick={() => app.go('settings')}>Settings</button> for perfect move grading.
      Drills still work against the engine without it.
    </p>
  {/if}

  {#if !drill}
    <div class="drills">
      {#each ENDGAME_DRILLS as d}
        <button class="drill-card" onclick={() => start(d)}>
          <b>{d.name}</b>
          <span class="muted">{d.goal}</span>
        </button>
      {/each}
    </div>
  {:else}
    <p><b>{drill.name}</b> — <span class="muted">{drill.goal}</span></p>
    <div class="board-wrap">
      <Board
        {fen}
        orientation={playerColor}
        turnColor={turnColor()}
        movableColor={status === 'playing' && turnColor() === playerColor ? playerColor : undefined}
        dests={status === 'playing' && turnColor() === playerColor ? game.dests() : new Map()}
        {lastMove}
        check={game.inCheck()}
        {onMove}
      />
    </div>

    <p class="feedback {feedbackKind}">{status === 'thinking' ? 'Engine thinking…' : feedback}</p>

    {#if tb}
      <p class="muted" style="font-size:0.82rem">
        Tablebase: position is <b>{tb.category}</b>{tb.dtz != null ? ` (DTZ ${tb.dtz})` : ''}{tb.cached ? ' · cached' : ''}.
      </p>
    {:else if tbError}
      <p class="muted" style="font-size:0.82rem">{tbError}</p>
    {/if}

    <div class="row center">
      <button onclick={() => drill && start(drill)}>Restart</button>
      <button class="ghost" onclick={() => (drill = null)}>← All drills</button>
    </div>
  {/if}
</section>

<style>
  .drills { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; max-width: 720px; }
  .drill-card { display: flex; flex-direction: column; gap: 0.3rem; text-align: left; align-items: flex-start; background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 0.8rem 1rem; border-radius: 10px; }
  .drill-card .muted { font-size: 0.8rem; font-weight: 400; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  button.link { background: none; border: none; color: var(--accent); padding: 0; cursor: pointer; text-decoration: underline; }
</style>
