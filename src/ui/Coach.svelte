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
      feedback = 'Missed.';
      setTimeout(nextProbePuzzle, 450);
    } else if (res === 'solved') {
      ladder.report(true);
      feedback = 'Solved ✔';
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
    info = 'Starting engine…';
    try {
      await opponent.applyStrength();
      info = 'Your move — play naturally.';
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
    info = 'Analysing your game…';
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
      gameDimensions = buildWeaknessProfile([analysis], baseline()).dimensions;
    } catch { /* fall through with no game dims */ }
    await commit(gameDimensions);
  }

  async function finishWithoutGame() {
    await commit(null);
  }

  async function commit(gameDimensions: DimensionScore[] | null) {
    const p = buildCoachProfile({ puzzleRating: baseline(), probes, gameDimensions, assessedAt: Date.now() });
    profile = p;
    programPreview = buildCoachProgram(p, 30);
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
  <h2>Personal coaching</h2>

  {#if step === 'intro'}
    <p class="muted">A quick assessment — two puzzles per tactical motif (about 14) plus an optional short game —
      then a program of drills and game modes aimed at your weak spots. Just play your best move on each:
      solved or not, we read the attempt and move on. Directional, not a grade.</p>
    <button onclick={startLadders} disabled={app.puzzles.size === 0}>Start the assessment →</button>
    {#if app.puzzles.size === 0}<p class="muted">Loading puzzles…</p>{/if}

  {:else if step === 'ladders'}
    <p class="muted">Theme {themeIdx + 1}/{THEMES.length} — <b>{THEMES[themeIdx].theme}</b> (2 puzzles). Play your best move; solved or not, we move on.</p>
    <div class="board-wrap">
      <Board {fen} {orientation}
        turnColor={display.turn === 'w' ? 'white' : 'black'}
        movableColor={display.turn === 'w' ? 'white' : 'black'}
        dests={display.dests()} check={display.inCheck()} onMove={onLadderMove} />
    </div>
    <p class="feedback">{feedback}</p>

  {:else if step === 'offer-game'}
    <div class="panel col center">
      <h3>Assessment puzzles done</h3>
      <p class="muted">Optional: play a game (~24 moves) for a read on your opening, middlegame, and general play.
        Endgame conversion, time, and resilience need full games — they show as “n/a” until you play more.</p>
      <ColorPicker bind:value={coachColorChoice} />
      <div class="row center">
        <button onclick={startGame}>Play the game →</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={finishWithoutGame}>Skip</button>
      </div>
    </div>

  {:else if step === 'game'}
    <p class="muted">{info}</p>
    <p class="muted" style="font-size:0.82rem">You play {coachSide === 'w' ? 'White' : 'Black'}</p>
    <div class="board-wrap">
      <Board fen={gameFen} orientation={coachSide === 'w' ? 'white' : 'black'}
        turnColor={game.turn === 'w' ? 'white' : 'black'}
        movableColor={!thinking && game.turn === coachSide ? (coachSide === 'w' ? 'white' : 'black') : undefined}
        dests={!thinking && game.turn === coachSide ? game.dests() : new Map()}
        check={gameInCheck} onMove={onGameMove} />
    </div>
    {#if thinking}<p class="feedback">Bot thinking…</p>{/if}

  {:else if step === 'analysing'}
    <p class="muted">{info}</p>

  {:else if step === 'result' && profile}
    <div class="panel col center" style="gap:0.75rem;width:100%">
      <h3>Your coaching profile</h3>
      <Radar dimensions={profile.dimensions} />
      <p class="muted" style="font-size:0.8rem">Directional — built from {profile.source.ladders ? 'two puzzles per motif' : 'no puzzle data'}{profile.source.game ? ' + one short game' : ''}. Small samples; treat as "where to focus". Greyed “n/a” axes weren't measured by this assessment.</p>
      <div class="row" style="gap:1.5rem;align-items:flex-start">
        <div class="col"><b>Strengths</b>{#each profile.strengths as s}<span>✔ {s}</span>{:else}<span class="muted">—</span>{/each}</div>
        <div class="col"><b>Focus on</b>{#each profile.weaknesses as w}<span>△ {w}</span>{:else}<span class="muted">—</span>{/each}</div>
      </div>
      <h4>Your program</h4>
      <ol style="text-align:left">
        {#each programPreview as item}
          <li><b>{item.activity}</b> — {item.focus} <span class="muted">({item.minutes}m · {item.reason})</span></li>
        {/each}
      </ol>
      <div class="row center">
        <button onclick={startCoaching}>▶ Start coaching session</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={() => app.go('home')}>Later</button>
      </div>
    </div>
  {/if}
</section>
