<script lang="ts">
  // Scenario sparring (spec D / ADR-0030): play out a targeted position (an imbalance,
  // or one of your own leaks) vs the adaptive opponent at your ZPD Elo. Outcome-graded.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  import { poolOpponent } from '../store/playerModel';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { IMBALANCE_LIBRARY, scenariosFromWeakness, type Scenario } from '../analysis/scenarios';
  import { t } from '../i18n';

  let scenarios = $state<Scenario[]>([...IMBALANCE_LIBRARY]);
  let current = $state<Scenario | null>(null);
  let status = $state<'pick' | 'playing' | 'thinking' | 'over'>('pick');
  let game = $state(new ChessGame());
  let fen = $state('');
  let lastMove = $state<[string, string] | null>(null);
  let result = $state('');
  let resultKind = $state<'good' | 'bad' | ''>('');
  let opponent: AdaptiveOpponent | null = null;

  const model = $derived(app.model);
  const playerSide = $derived(current?.sideToTrain ?? 'w');
  const orientation = $derived(playerSide === 'w' ? 'white' : 'black');

  onMount(async () => {
    try {
      const w = scenariosFromWeakness(await loadAllAnalyses());
      scenarios = [...IMBALANCE_LIBRARY, ...w];
    } catch {
      /* library still works */
    }
    if (app.sparringScenarioId) {
      const seeded = scenarios.find((s) => s.id === app.sparringScenarioId);
      app.sparringScenarioId = null; // consume once
      if (seeded) await start(seeded);
    }
  });

  async function start(s: Scenario) {
    if (!model) return;
    current = s;
    result = '';
    resultKind = '';
    game = new ChessGame(s.fen);
    fen = game.fen;
    lastMove = null;
    // Sparring scenarios are untimed → classical pool (spec §4.4 / Q-F).
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(poolOpponent(model, 'classical').targetElo));
    status = 'thinking';
    try {
      await opponent.applyStrength();
      status = 'playing';
    } catch (e) {
      result = t('sparring.engineFailedToStart', { error: String(e) });
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
    if (!game.move(from, to, promo)) return;
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
          result = t('sparring.engineIllegalMove');
          status = 'over';
          return;
        }
        fen = game.fen;
        lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
      }
    } catch (e) {
      result = t('sparring.engineError', { error: String(e) });
    }
    if (!checkEnd()) status = 'playing';
  }

  function checkEnd(): boolean {
    const term = game.terminal();
    if (!term.over) return false;
    status = 'over';
    if (term.reason === 'checkmate') {
      const win = term.winner === playerSide;
      result = win ? t('sparring.youWon') : t('sparring.checkmated');
      resultKind = win ? 'good' : 'bad';
    } else {
      result = t('sparring.drawn');
      resultKind = 'good';
    }
    return true;
  }

  function resign() {
    status = 'over';
    result = t('sparring.resigned');
    resultKind = 'bad';
  }
</script>

<section class="col center">
  <h2>{t('sparring.title')}</h2>
  {#if status === 'pick'}
    <p class="muted" style="max-width:520px">
      {t('sparring.pickIntro')}
    </p>
    <div class="col" style="gap:0.3rem;width:100%;max-width:560px">
      {#each scenarios as s (s.id)}
        <button class="scenario panel" onclick={() => start(s)}>
          <span><b>{s.name}</b> <span class="muted" style="font-size:0.78rem">{s.category}</span><br /><span class="muted" style="font-size:0.82rem">{s.goal}</span></span>
        </button>
      {/each}
    </div>
  {:else if current}
    <p class="muted" style="max-width:480px">{current.name} — {current.goal}</p>
    <p class="muted" style="font-size:0.82rem">{t('sparring.youPlay', { color: orientation === 'white' ? t('color.white') : t('color.black') })}</p>
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
    <p class="feedback {resultKind}">{status === 'thinking' ? t('sparring.opponentThinking') : result}</p>
    <div class="row center">
      {#if status === 'over'}
        <button onclick={() => current && start(current)}>{t('sparring.tryAgain')}</button>
        <button class="ghost" onclick={() => (status = 'pick')}>{t('sparring.backToScenarios')}</button>
      {:else}
        <button onclick={resign} style="background:var(--bad)">{t('sparring.resign')}</button>
        <button class="ghost" onclick={() => (status = 'pick')}>{t('sparring.backToScenarios')}</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .scenario { text-align: left; cursor: pointer; background: var(--panel); border: 1px solid var(--border); color: var(--text); }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
