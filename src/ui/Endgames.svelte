<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { ENDGAME_DRILLS, type EndgameDrill } from '../endgame/drills';
  import { TablebaseClient, withinTablebase, NetworkNotAllowedError, type TablebaseResult } from '../endgame/syzygy';
  import { tbCacheGet, tbCacheSet } from '../endgame/tablebaseCache';
  import { t, getLocale } from '../i18n';

  // Locale-aware drill name/goal: follows the runtime locale switch (getLocale is reactive).
  const dn = (d: EndgameDrill) => (getLocale() === 'fr' ? d.nameFr : d.name);
  const dg = (d: EndgameDrill) => (getLocale() === 'fr' ? d.goalFr : d.goal);

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
          : t('endgames.lookupFailed', { error: e instanceof Error ? e.message : 'unknown' });
    }
  }

  function turnColor(): 'white' | 'black' {
    return game.turn === 'w' ? 'white' : 'black';
  }

  // In-check king highlight: `game` is mutated in place each move and Svelte 5 doesn't proxy the
  // ChessGame instance, so a bare `game.inCheck()` binding never re-fires (movableColor/dests are
  // saved only by their co-dependency on the toggling `status`). Depend on the reactive `fen`
  // (reassigned every move) so the highlight refreshes mid-game. ADR-0051.
  const inCheck = $derived(fen ? game.inCheck() : false);

  async function onMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (status !== 'playing' || turnColor() !== playerColor) return;

    // Grade the move against the tablebase BEFORE making it (we have tb for this pos).
    const uci = from + to + (game.isPromotion(from, to) ? promo : '');
    const truth = tb;
    const san = game.move(from, to, promo);
    if (!san) return;
    fen = game.fen;
    lastMove = [from, to];

    if (truth && truth.moves.length) {
      const best = truth.moves[0];
      const played = truth.moves.find((m) => m.uci === uci);
      if (played && best && played.category === best.category && played.dtz === best.dtz) {
        feedback = t('endgames.perfectKeeps', { category: best.category });
        feedbackKind = 'good';
      } else if (played) {
        feedback = t('endgames.moveCategory', {
          category: played.category,
          best: best.san ?? best.uci,
          bestCategory: best.category,
        });
        feedbackKind = 'bad';
      } else {
        feedback = t('endgames.bestByTablebase', { best: best.san ?? best.uci });
        feedbackKind = '';
      }
    } else if (tbError) {
      // Distinguish "consent off" from an actual lookup failure (don't claim the
      // network is off when it's on and the request simply failed).
      feedback = networkOff
        ? t('endgames.playingNoFeedbackNetwork')
        : t('endgames.playingNoFeedbackFailed');
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
        const r = await app.engine.evaluate(game.fen, { movetime: 300, fullStrength: true });
        uci = r.bestmove;
      }
      if (uci) {
        const san = game.moveUci(uci); // halt on an illegal engine/tablebase move (audit v2 P1-17)
        if (!san) {
          status = 'over';
          return;
        }
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
    const term = game.terminal();
    if (!term.over) return false;
    status = 'over';
    if (term.reason === 'checkmate') {
      const youWin = term.winner === playerColor[0];
      feedback = youWin ? t('endgames.checkmateYouWin') : t('endgames.checkmateEngineWins');
      feedbackKind = youWin ? 'good' : 'bad';
    } else {
      feedback = t('endgames.draw', { reason: term.reason ?? '' });
      feedbackKind = '';
    }
    return true;
  }
</script>

<section class="col center">
  <h2>{t('endgames.title')}</h2>
  <p class="muted">{t('endgames.intro')}</p>

  {#if settings && !settings.allowNetwork}
    <p class="muted" style="font-size:0.85rem;max-width:520px">
      {t('endgames.networkHintBefore')}<button class="link" onclick={() => app.go('settings')}>{t('endgames.settingsLink')}</button>{t('endgames.networkHintAfter')}
    </p>
  {/if}

  {#if !drill}
    <div class="drills">
      {#each ENDGAME_DRILLS as d}
        <button class="drill-card" onclick={() => start(d)}>
          <b>{dn(d)}</b>
          <span class="muted">{dg(d)}</span>
        </button>
      {/each}
    </div>
  {:else}
    <p><b>{dn(drill)}</b> — <span class="muted">{dg(drill)}</span></p>
    <div class="board-wrap">
      <Board
        {fen}
        orientation={playerColor}
        turnColor={turnColor()}
        movableColor={status === 'playing' && turnColor() === playerColor ? playerColor : undefined}
        dests={status === 'playing' && turnColor() === playerColor ? game.dests() : new Map()}
        {lastMove}
        check={inCheck}
        {onMove}
      />
    </div>

    <p class="feedback {feedbackKind}">{status === 'thinking' ? t('endgames.engineThinking') : feedback}</p>

    {#if tb}
      <p class="muted" style="font-size:0.82rem">
        {t('endgames.tablebasePosition')}<b>{tb.category}</b>{tb.dtz != null ? ` (DTZ ${tb.dtz})` : ''}{tb.cached ? t('endgames.cached') : ''}.
      </p>
    {:else if tbError}
      <p class="muted" style="font-size:0.82rem">{tbError}</p>
    {/if}

    <div class="row center">
      <button onclick={() => drill && start(drill)}>{t('endgames.restart')}</button>
      <button class="ghost" onclick={() => (drill = null)}>{t('endgames.allDrills')}</button>
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
