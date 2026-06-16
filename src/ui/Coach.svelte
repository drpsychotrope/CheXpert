<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import Radar from './Radar.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { PuzzleLadder } from '../calibration/Calibration';
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  import { runAnalysis } from '../analysis/runAnalysis';
  import { loadPlayerModel } from '../store/playerModel';
  import { buildWeaknessProfile, type DimensionScore } from '../analysis/weakness';
  import { buildCoachProfile, COACH_MOTIF_PROBES, COACH_LADDER_MIN, COACH_LADDER_MAX } from '../coach/diagnostic';
  import { buildCoachProgram } from '../coach/program';
  import { buildSession } from '../analysis/session';
  import type { CoachProfile, ThemeProbeResult } from '../coach/types';
  import type { TacticalTrainer } from '../trainer/TacticalTrainer';
  import ColorPicker from './ColorPicker.svelte';
  import { resolveColor, type ColorChoice } from '../game/color';
  import { t, getLocale } from '../i18n';

  type Step = 'intro' | 'ladders' | 'offer-game' | 'game' | 'analysing' | 'result';
  let step = $state<Step>('intro');

  const THEMES: Array<{ theme: string; phase?: 'endgame' }> = [
    ...COACH_MOTIF_PROBES.map((t) => ({ theme: t as string })),
    { theme: 'endgame', phase: 'endgame' as const },
  ];
  let themeIdx = $state(0);
  const baseline = () => (app.model ? Math.round(app.model.puzzleRating.rating) : 1200);

  let ladder: PuzzleLadder | null = null;
  let trainer = $state<TacticalTrainer | null>(null);
  let display = $state(new ChessGame());
  let fen = $state('');
  let orientation = $state<'white' | 'black'>('white');
  let feedback = $state('');
  const probes: ThemeProbeResult[] = [];

  let game = $state(new ChessGame());
  let gameFen = $state('');
  let opponent: AdaptiveOpponent | null = null;
  let thinking = $state(false);
  let info = $state('');
  const GAME_MOVE_LIMIT = 48;
  let coachColorChoice = $state<ColorChoice>('random');
  let coachSide = $state<'w' | 'b'>('w');

  // Calibration-game board in-check highlight: `game` is mutated in place each move and Svelte 5
  // doesn't proxy the ChessGame instance, so a bare `game.inCheck()` binding never re-fires.
  // Depend on the reactive `gameFen` (reassigned every move) so it refreshes. (The ladder board
  // is fine — `display` is reassigned per puzzle.) ADR-0051.
  const gameInCheck = $derived(gameFen ? game.inCheck() : false);

  let profile = $state<CoachProfile | null>(null);
  let programPreview = $state<ReturnType<typeof buildCoachProgram>>([]);

  function startLadders() {
    themeIdx = 0;
    probes.length = 0;
    step = 'ladders';
    startThemeLadder();
  }

  function startThemeLadder() {
    const t = THEMES[themeIdx];
    const prior = app.model ? app.model.puzzleRating : { rating: 1200, rd: 250, vol: 0.06 };
    ladder = new PuzzleLadder(app.puzzles, prior, {
      min: COACH_LADDER_MIN,
      max: COACH_LADDER_MAX,
      window: 300,
      themes: t.phase ? undefined : [t.theme],
      phase: t.phase,
    });
    nextProbePuzzle();
  }

  async function nextProbePuzzle() {
    if (!ladder) return;
    const t = await ladder.next(Date.now());
    if (!t) return finishThemeLadder();
    trainer = t;
    display = new ChessGame(t.getFen());
    fen = display.fen;
    orientation = display.turn === 'w' ? 'white' : 'black';
    feedback = '';
  }

  function onLadderMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!trainer || !ladder) return;
    const uci = from + to + (display.isPromotion(from, to) ? promo : '');
    const res = trainer.playUserMove(uci);
    if (res === 'wrong') {
      ladder.report(false);
      feedback = t('coach.missed');
      setTimeout(nextProbePuzzle, 450);
    } else if (res === 'solved') {
      ladder.report(true);
      feedback = t('coach.solved');
      setTimeout(nextProbePuzzle, 400);
    } else {
      display = new ChessGame(trainer.getFen());
      fen = display.fen;
    }
  }

  function finishThemeLadder() {
    if (!ladder) return;
    const t = THEMES[themeIdx];
    probes.push({ theme: t.theme, rating: Math.round(ladder.rating.rating), n: ladder.count });
    themeIdx += 1;
    if (themeIdx >= THEMES.length) {
      step = 'offer-game';
      return;
    }
    startThemeLadder();
  }

  async function botReply() {
    if (!opponent) return;
    thinking = true;
    try {
      const uci = await opponent.pickMove(game.fen, 400);
      if (uci) {
        const san = game.moveUci(uci); // only advance if the engine move actually applied (P1-17)
        if (san) gameFen = game.fen;
      }
    } catch { /* ignore */ }
    thinking = false;
  }

  async function startGame() {
    coachSide = resolveColor(coachColorChoice) === 'white' ? 'w' : 'b';
    step = 'game';
    game = new ChessGame();
    gameFen = game.fen;
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(baseline()));
    thinking = true;
    info = t('coach.startingEngine');
    try {
      await opponent.applyStrength();
      info = t('coach.yourMove');
      thinking = false;
      if (coachSide === 'b') await botReply(); // engine (White) opens
    } catch {
      return finishWithoutGame();
    }
  }

  async function onGameMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!opponent || game.turn !== coachSide || thinking) return;
    await app.engine.resetVariant();
    const san = game.move(from, to, promo);
    if (!san) return;
    gameFen = game.fen;
    if (game.terminal().over || game.history().length >= GAME_MOVE_LIMIT) return finishGame();
    await botReply();
    if (game.terminal().over || game.history().length >= GAME_MOVE_LIMIT) finishGame();
  }

  async function finishGame() {
    step = 'analysing';
    info = t('coach.analysingGame');
    let gameDimensions: DimensionScore[] | null = null;
    try {
      const { analysis } = await runAnalysis(app.engine, app.puzzles, {
        gameId: `coach-${Date.now()}`,
        pgn: game.pgn(),
        playerColor: coachSide,
        source: 'played',
        baseRating: baseline(),
        now: Date.now(),
      });
      gameDimensions = buildWeaknessProfile([analysis], baseline(), getLocale()).dimensions;
    } catch { /* fall through with no game dims */ }
    await commit(gameDimensions);
  }

  async function finishWithoutGame() {
    await commit(null);
  }

  async function commit(gameDimensions: DimensionScore[] | null) {
    const p = buildCoachProfile({ puzzleRating: baseline(), probes, gameDimensions, assessedAt: Date.now(), locale: getLocale() });
    profile = p;
    programPreview = buildCoachProgram(p, 30, getLocale());
    if (app.model) {
      // Reload from DB so any weaknessCounters fold written by runAnalysis(source:'played')
      // in finishGame() is preserved — persisting the stale boot snapshot would discard it (I-1).
      const fresh = await loadPlayerModel(Date.now());
      fresh.coachProfilePrev = fresh.coachProfile;
      fresh.coachProfile = p;
      app.model = fresh;
      await app.persistModel(Date.now());
    }
    step = 'result';
  }

  function startCoaching() {
    if (!profile) return;
    app.activeSession = { plan: buildSession(programPreview), current: 0, startedAt: Date.now(), reflection: '' };
    app.go('session');
  }
</script>

<section class="col center" style="max-width:680px;margin:0 auto">
  <h2>{t('coach.title')}</h2>

  {#if step === 'intro'}
    <p class="muted">{t('coach.intro')}</p>
    <button onclick={startLadders} disabled={app.puzzles.size === 0}>{t('coach.startAssessment')}</button>
    {#if app.puzzles.size === 0}<p class="muted">{t('coach.loadingPuzzles')}</p>{/if}

  {:else if step === 'ladders'}
    <p class="muted">{t('coach.themeProgress', { current: themeIdx + 1, total: THEMES.length })}<b>{t('motif.' + THEMES[themeIdx].theme)}</b>{t('coach.themeProgressSuffix')}</p>
    <div class="board-wrap">
      <Board {fen} {orientation}
        turnColor={display.turn === 'w' ? 'white' : 'black'}
        movableColor={display.turn === 'w' ? 'white' : 'black'}
        dests={display.dests()} check={display.inCheck()} onMove={onLadderMove} />
    </div>
    <p class="feedback">{feedback}</p>

  {:else if step === 'offer-game'}
    <div class="panel col center">
      <h3>{t('coach.assessmentDone')}</h3>
      <p class="muted">{t('coach.offerGameBody')}</p>
      <ColorPicker bind:value={coachColorChoice} />
      <div class="row center">
        <button onclick={startGame}>{t('coach.playGame')}</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={finishWithoutGame}>{t('coach.skip')}</button>
      </div>
    </div>

  {:else if step === 'game'}
    <p class="muted">{info}</p>
    <p class="muted" style="font-size:0.82rem">{coachSide === 'w' ? t('coach.youPlayWhite') : t('coach.youPlayBlack')}</p>
    <div class="board-wrap">
      <Board fen={gameFen} orientation={coachSide === 'w' ? 'white' : 'black'}
        turnColor={game.turn === 'w' ? 'white' : 'black'}
        movableColor={!thinking && game.turn === coachSide ? (coachSide === 'w' ? 'white' : 'black') : undefined}
        dests={!thinking && game.turn === coachSide ? game.dests() : new Map()}
        check={gameInCheck} onMove={onGameMove} />
    </div>
    {#if thinking}<p class="feedback">{t('coach.botThinking')}</p>{/if}

  {:else if step === 'analysing'}
    <p class="muted">{info}</p>

  {:else if step === 'result' && profile}
    <div class="panel col center" style="gap:0.75rem;width:100%">
      <h3>{t('coach.profileTitle')}</h3>
      <Radar dimensions={profile.dimensions} />
      <p class="muted" style="font-size:0.8rem">{t('coach.directional', { source: (profile.source.ladders ? t('coach.sourceLadders') : t('coach.sourceNoData')) + (profile.source.game ? t('coach.sourceGameSuffix') : '') })}</p>
      <div class="row" style="gap:1.5rem;align-items:flex-start">
        <div class="col"><b>{t('coach.strengths')}</b>{#each profile.strengths as s}<span>✔ {s}</span>{:else}<span class="muted">—</span>{/each}</div>
        <div class="col"><b>{t('coach.focusOn')}</b>{#each profile.weaknesses as w}<span>△ {w}</span>{:else}<span class="muted">—</span>{/each}</div>
      </div>
      <h4>{t('coach.yourProgram')}</h4>
      <ol style="text-align:left">
        {#each programPreview as item}
          <li><b>{item.activity}</b> — {item.focus} <span class="muted">{t('coach.programItemMeta', { minutes: item.minutes, reason: item.reason })}</span></li>
        {/each}
      </ol>
      <div class="row center">
        <button onclick={startCoaching}>{t('coach.startSession')}</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={() => app.go('home')}>{t('coach.later')}</button>
      </div>
    </div>
  {/if}
</section>
