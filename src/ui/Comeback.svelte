<script lang="ts">
  // Comeback drills (ADR-0025): replay positions from your own games where you fell
  // behind, vs the ADAPTIVE opponent (your ZPD Elo — holdable, not perfect play),
  // graded on outcome (hold a draw or win = success). Reached from the Dashboard
  // resilience "Defend" button (no top-nav entry).
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  import { poolOpponent } from '../store/playerModel';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { comebackPositions, type ComebackPosition } from '../analysis/comeback';
  import { t } from '../i18n';

  let positions = $state<ComebackPosition[]>([]);
  let idx = $state(0);
  let status = $state<'loading' | 'empty' | 'playing' | 'thinking' | 'over'>('loading');
  let game = $state(new ChessGame());
  let fen = $state('');
  let lastMove = $state<[string, string] | null>(null);
  let result = $state('');
  let resultKind = $state<'good' | 'bad' | ''>('');
  let opponent: AdaptiveOpponent | null = null;

  const model = $derived(app.model);
  const current = $derived(positions[idx] ?? null);
  const playerSide = $derived(current?.playerColor ?? 'w');
  const orientation = $derived(playerSide === 'w' ? 'white' : 'black');
  const hasNext = $derived(idx + 1 < positions.length);

  onMount(async () => {
    try {
      positions = comebackPositions(await loadAllAnalyses());
    } catch {
      positions = [];
    }
    if (positions.length === 0) {
      status = 'empty';
      return;
    }
    await loadPosition(0);
  });

  async function loadPosition(i: number) {
    if (!model || i >= positions.length) return;
    idx = i;
    result = '';
    resultKind = '';
    game = new ChessGame(positions[i].fen);
    fen = game.fen;
    lastMove = null;
    // Adaptive Elo (your ZPD), NOT full strength — the drill must be holdable.
    // Comeback drills are untimed → classical pool (spec §4.4 / Q-F).
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(poolOpponent(model, 'classical').targetElo));
    status = 'thinking';
    try {
      await opponent.applyStrength();
      status = 'playing';
    } catch (e) {
      result = t('comeback.engineFailedToStart', { error: String(e) });
      status = 'over';
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
    if (status !== 'playing' || game.turn !== playerSide) return;
    const san = game.move(from, to, promo);
    if (!san) return;
    fen = game.fen;
    lastMove = [from, to];
    if (checkEnd()) return;
    await engineMove();
  }

  async function engineMove() {
    if (!opponent) return;
    status = 'thinking';
    try {
      const uci = await opponent.pickMove(game.fen, 500);
      if ((status as string) === 'over') return; // user resigned while the engine was thinking (audit v2 P1-14)
      if (uci) {
        const san = game.moveUci(uci); // halt on an illegal engine move instead of desyncing (P1-17)
        if (!san) {
          result = t('comeback.engineIllegalMove');
          status = 'over';
          return;
        }
        fen = game.fen;
        lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
      }
    } catch (e) {
      result = t('comeback.engineError', { error: String(e) });
    }
    if (!checkEnd()) status = 'playing';
  }

  function checkEnd(): boolean {
    const term = game.terminal();
    if (!term.over) return false;
    status = 'over';
    if (term.reason === 'checkmate') {
      const youWin = term.winner === playerSide;
      result = youWin ? t('comeback.youWin') : t('comeback.checkmated');
      resultKind = youWin ? 'good' : 'bad';
    } else {
      result = t('comeback.heldDraw');
      resultKind = 'good';
    }
    return true;
  }

  function resign() {
    status = 'over';
    result = t('comeback.resigned');
    resultKind = 'bad';
  }
</script>

<section class="col center">
  <h2>{t('comeback.title')}</h2>
  {#if status === 'loading'}
    <p class="muted">{t('comeback.loadingPositions')}</p>
  {:else if status === 'empty'}
    <div class="panel col center">
      <p>{t('comeback.emptyTitle')}</p>
      <p class="muted">
        {t('comeback.emptyBody')}
      </p>
      <button onclick={() => app.go('play')}>{t('comeback.playAGame')}</button>
      <button onclick={() => { app.sparringScenarioId = 'opp-castle'; app.go('sparring'); }}>
        {t('comeback.defensiveSparring')}
      </button>
    </div>
  {:else}
    {#if current}
      <p class="muted">
        {t('comeback.positionIntro', { idx: idx + 1, total: positions.length, pawns: Math.round(-current.cpAtEntry / 100) })}
      </p>
    {/if}
    <p class="muted" style="font-size:0.82rem">{t('comeback.youPlay', { color: orientation === 'white' ? t('color.white') : t('color.black') })}</p>
    <div class="board-wrap">
      <Board
        {fen}
        {orientation}
        turnColor={turnColor()}
        movableColor={status === 'playing' && turnColor() === orientation ? orientation : undefined}
        dests={status === 'playing' && turnColor() === orientation ? game.dests() : new Map()}
        {lastMove}
        check={inCheck}
        {onMove}
      />
    </div>
    <p class="feedback {resultKind}">{status === 'thinking' ? t('comeback.opponentThinking') : result}</p>
    <div class="row center">
      {#if status === 'over'}
        {#if hasNext}<button onclick={() => loadPosition(idx + 1)}>{t('comeback.nextPosition')}</button>{/if}
        <button class="ghost" onclick={() => loadPosition(idx)}>{t('comeback.tryAgain')}</button>
        <button class="ghost" onclick={() => app.go('dashboard')}>{t('comeback.backToDashboard')}</button>
      {:else}
        <button onclick={resign} style="background:var(--bad)">{t('comeback.resign')}</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
