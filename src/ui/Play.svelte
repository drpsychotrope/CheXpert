<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { AdaptiveOpponent, initOpponentState, recordGame, type GameOutcome } from '../engine/AdaptiveOpponent';
  import { updateRating } from '../rating/glicko2';
  import { openTrainerDB, type GameRecord } from '../store/db';
  import { poolRating, poolOpponent } from '../store/playerModel';
  import type { RatingPool } from '../rating/pools';
  import {
    initClock, startClock, stopClock, tick, press, flagged,
    type ClockState, type Side,
  } from '../clock/Clock';
  import {
    categoryFor, fmtClock, insufficientMatingMaterial, TIME_CONTROL_PRESETS,
    type Category, type TimeControlPreset,
  } from '../clock/categories';
  import { loadAllAnalyses, runAnalysis } from '../analysis/runAnalysis';
  import { buildWeaknessProfile, type Dimension } from '../analysis/weakness';
  import { selectOpening, nextBookMove, steeringNote, type OpeningEntry } from '../opening/openingBook';
  import AnalysisResult from './AnalysisResult.svelte';
  import type { GameAnalysis } from '../analysis/types';
  import { chess960Position, chess960PositionById } from '../variant/chess960';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let game = $state(new ChessGame());
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  let status = $state<'idle' | 'playing' | 'thinking' | 'over'>('idle');
  let result = $state('');
  let thinking = $state(false);
  let steerNote = $state('');
  let opponent: AdaptiveOpponent | null = null;
  const playerColor: 'white' | 'black' = 'white';

  // Chess960 state (ADR-0041)
  let variant = $state<'standard' | 'chess960'>('standard');
  let sp960Input = $state(''); // optional SP-ID string; blank = random
  let startFen960 = $state<string | null>(null);
  let castle960 = $state<import('../game/ChessGame').Chess960CastleFiles | null>(null);

  // Clock-aware bot move budget bounds per category (ms) — [floor, ceil] (spec §4.3, Q-D).
  const BUDGET_BOUNDS: Record<Category, [number, number]> = {
    bullet: [40, 250], blitz: [80, 500], rapid: [150, 1200], classical: [200, 2000],
  };

  // Time-control state. `clock` is null for the untimed ("No clock") path = today's behavior.
  let selectedTC = $state<TimeControlPreset>(TIME_CONTROL_PRESETS.find((p) => p.id === 'rapid-10-0')!);
  let clock = $state<ClockState | null>(null);
  let customInitialSec = $state(300);
  let customIncrementSec = $state(0);
  let rafId: number | null = null;
  let lastTs = 0;

  // The bot plays Black here; the player is White.
  const botSide: Side = playerColor === 'white' ? 'b' : 'w';
  const playerSideClock: Side = playerColor === 'white' ? 'w' : 'b';

  function initialSecOf(p: TimeControlPreset): number {
    return p.id === 'custom' ? customInitialSec : p.initialSec;
  }
  function incrementSecOf(p: TimeControlPreset): number {
    return p.id === 'custom' ? customIncrementSec : p.incrementSec;
  }

  const selectedPool = $derived<RatingPool>(
    selectedTC.untimed ? 'classical' : categoryFor(initialSecOf(selectedTC), incrementSecOf(selectedTC)),
  );
  /** The pool used for rating display and updates: chess960 for 960, selectedPool for standard. */
  const displayPool = $derived<RatingPool>(variant === 'chess960' ? 'chess960' : selectedPool);

  // One-click post-game analysis (ADR-0022): no PGN paste needed.
  let lastGame = $state<{ id: string; pgn: string } | null>(null);
  let aStatus = $state<'idle' | 'analyzing' | 'done'>('idle');
  let aResult = $state<GameAnalysis | null>(null);
  let aPuzzles = $state(0);
  let aProgress = $state(0);
  let aTotal = $state(0);

  // Loop closure: the bot (Black here) opens toward the player's weakest area.
  let opening: OpeningEntry | null = null;
  let playedUci: string[] = [];

  const model = $derived(app.model);
  const coached = $derived(app.settings?.coachedMode ?? false);
  const opponentStyle = $derived(app.settings?.opponentStyle ?? 'human');
  const live = $derived(status === 'playing' || status === 'thinking');

  // Restore the last-used time control on mount (spec §4.5).
  $effect(() => {
    const last = app.settings?.lastTimeControl;
    if (!last) return;
    const match = TIME_CONTROL_PRESETS.find(
      (p) => !p.untimed && p.id !== 'custom' && p.initialSec === last.initialSec && p.incrementSec === last.incrementSec,
    );
    if (match) {
      selectedTC = match;
    } else {
      selectedTC = TIME_CONTROL_PRESETS.find((p) => p.id === 'custom')!;
      customInitialSec = last.initialSec;
      customIncrementSec = last.incrementSec;
    }
  });

  async function setOpponentStyle(s: 'human' | 'engine') {
    if (app.settings) {
      app.settings.opponentStyle = s;
      await app.persistSettings();
    }
  }

  async function newGame() {
    if (!model) return;
    result = '';
    lastGame = null;
    aResult = null;
    aStatus = 'idle';
    aPuzzles = 0;
    startFen960 = null;
    castle960 = null;
    lastMove = null;
    playedUci = [];

    if (variant === 'chess960') {
      const id = sp960Input.trim() === '' ? null : Math.max(0, Math.min(959, Number(sp960Input) | 0));
      const pos = id === null ? chess960Position(Math.random()) : chess960PositionById(id);
      startFen960 = pos.startFen;
      castle960 = pos.castle;
      sp960Input = String(pos.id); // reflect the chosen id back to the field
      game = new ChessGame(startFen960, { variant: 'chess960', castle: castle960 });
      opening = null; // no opening book / steering for 960 (no theory)
      steerNote = `Chess960 · SP-ID ${pos.id} · drag the king onto its own rook to castle`;
    } else {
      game = new ChessGame();
      // Read the weakness profile (from analysed games) and steer the opening.
      let weakest: Dimension | null = null;
      try {
        const analyses = await loadAllAnalyses();
        if (analyses.length) weakest = buildWeaknessProfile(analyses, poolRating(model, selectedPool).rating).weakest;
      } catch {
        /* no analyses yet → neutral variety */
      }
      opening = selectOpening('b', weakest, Math.random());
      steerNote = steeringNote(opening, weakest);
    }

    fen = game.fen;

    // Seed the bot from the active pool's adaptive state.
    // 960 uses the chess960 pool (lazy seed from classical); standard uses selectedPool (AP-TC-3).
    const activePool: RatingPool = variant === 'chess960' ? 'chess960' : selectedPool;
    const state = initOpponentState(poolOpponent(model, activePool).targetElo);
    opponent = new AdaptiveOpponent(app.engine, state, variant === 'chess960');

    // Chess960 is always untimed (Q-C); standard respects the selected time control.
    if (variant === 'chess960' || selectedTC.untimed) {
      clock = null;
    } else {
      clock = startClock(initClock(initialSecOf(selectedTC) * 1000, incrementSecOf(selectedTC) * 1000, 'w'));
    }

    // Persist the chosen time control for next time (skip for untimed and 960).
    if (variant !== 'chess960' && !selectedTC.untimed && app.settings) {
      app.settings.lastTimeControl = { initialSec: initialSecOf(selectedTC), incrementSec: incrementSecOf(selectedTC) };
      await app.persistSettings();
    }

    status = 'thinking';
    try {
      await opponent.applyStrength(); // sets UCI_Chess960 = (variant==='chess960') on boot
      status = 'playing';
      startClockLoop();
    } catch (e) {
      result = 'Engine failed to start: ' + String(e);
      status = 'idle';
    }
  }

  // ---- Clock loop (the ONLY place time is read; Clock.ts stays Date-free, AP-TC-1) ----

  /** Start the rAF tick loop. Runs while the game is live (playing OR thinking) so the
   *  bot's clock keeps decrementing during its turn and the bot can flag (AP-TC-4). */
  function startClockLoop() {
    if (!clock || rafId !== null) return;
    lastTs = performance.now();
    const step = () => {
      if (!clock || !live) {
        rafId = null;
        return;
      }
      const now = performance.now();
      const elapsed = now - lastTs;
      lastTs = now;
      clock = tick(clock, elapsed);
      const flag = flagged(clock);
      if (flag) {
        rafId = null;
        clock = stopClock(clock);
        void onFlag(flag);
        return;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function stopClockLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  onDestroy(stopClockLoop);

  /** Clock-aware bot movetime (spec §4.3, Q-D): scale with the bot's remaining time,
   *  using a phase-aware moves-left estimate, clamped per category. */
  function botMovetime(remainingMs: number, ply: number, cat: Category): number {
    const movesLeft = Math.max(8, 40 - Math.floor(ply / 2));
    const raw = remainingMs / movesLeft;
    const [floor, ceil] = BUDGET_BOUNDS[cat];
    return Math.round(Math.min(ceil, Math.max(floor, raw)));
  }

  /** A side flagged: game over. FIDE Art. 6.9 — if the OTHER side cannot mate, it's a draw
   *  (Q-C); otherwise the side that flagged loses. */
  async function onFlag(flaggedSide: Side) {
    stopClockLoop();
    status = 'over';
    const winnerSide: Side = flaggedSide === 'w' ? 'b' : 'w';
    let outcome: GameOutcome;
    if (insufficientMatingMaterial(game.fen, winnerSide)) {
      outcome = 'draw';
      result = 'Flag — but insufficient mating material: draw (FIDE Art. 6.9).';
    } else {
      const playerFlagged = flaggedSide === playerSideClock;
      outcome = playerFlagged ? 'loss' : 'win';
      result = playerFlagged ? 'You flagged — out of time.' : 'Opponent flagged — you win on time! ♚';
    }
    await finishGame(outcome);
  }

  function turnColor(): 'white' | 'black' {
    return game.turn === 'w' ? 'white' : 'black';
  }

  async function onMove(from: string, to: string) {
    if (status !== 'playing' || turnColor() !== playerColor) return;
    const uci = from + to + (game.isPromotion(from, to) ? 'q' : '');
    const san = game.move(from, to, 'q');
    if (!san) return;
    playedUci.push(uci);
    fen = game.fen;
    lastMove = [from, to];
    if (clock) clock = press(clock, playerSideClock);

    if (coached) await coachCheck();

    if (checkEnd()) return;
    await engineMove();
  }

  async function engineMove() {
    if (!opponent) return;
    status = 'thinking';
    thinking = true;
    try {
      // In 960, feed the engine X-FEN/Shredder rights via fenForEngine(); standard uses game.fen.
      const engineFen = variant === 'chess960' ? game.fenForEngine() : game.fen;
      // Loop closure: play the steering opening's book move if still on the line;
      // opening is null in 960 (no theory), so the engine always picks its own move.
      let uci = opening ? nextBookMove(opening, playedUci) : null;
      if (!uci) {
        // Clock-aware budget from the BOT's own remaining time (AP-TC-4); untimed/960 keeps the defaults.
        const budget = clock
          ? botMovetime(botSide === 'w' ? clock.whiteMs : clock.blackMs, game.history().length, selectedPool as Category)
          : null;
        if (opponentStyle === 'engine') {
          uci = await opponent.pickMove(engineFen, budget ?? 500);
        } else {
          uci = budget != null ? await opponent.pickHumanMove(engineFen, budget) : await opponent.pickHumanMove(engineFen);
        }
      }
      if ((status as string) === 'over') { thinking = false; return; }
      if (uci) {
        game.moveUci(uci); // shim routes a king-to-rook castle UCI (e.g. e1h1); chess.js handles the rest
        playedUci.push(uci);
        fen = game.fen;
        lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
        if (clock) clock = press(clock, botSide);
      }
    } catch (e) {
      result = 'Engine error: ' + String(e);
    }
    thinking = false;
    if (!checkEnd()) status = 'playing';
  }

  /** Coached mode (Phase 1, best-effort): quick shallow eval; warn on a big drop. */
  async function coachCheck() {
    try {
      const evalRes = await app.engine.evaluate(game.fen, { depth: 8 });
      // After the player's move it is the opponent's turn; a very negative
      // White-POV score (for a white player) means the move likely blundered.
      const cp = evalRes.whiteCp;
      const bad = playerColor === 'white' ? cp < -250 : cp > 250;
      if (bad) {
        const undo = confirm('Coach: that move looks like it loses material or worse. Take it back?');
        if (undo) {
          game.undo();
          fen = game.fen;
          lastMove = null;
          status = 'playing';
          throw new Error('__takeback__');
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message === '__takeback__') throw e;
      // eval failure shouldn't block play
    }
  }

  function checkEnd(): boolean {
    const t = game.terminal();
    if (!t.over) return false;
    status = 'over';
    stopClockLoop();
    if (clock) clock = stopClock(clock);
    let outcome: GameOutcome;
    if (t.reason === 'checkmate') {
      outcome = t.winner === playerColor[0] ? 'win' : 'loss';
      result = outcome === 'win' ? 'Checkmate — you win! ♚' : 'Checkmate — you lost.';
    } else {
      outcome = 'draw';
      result = `Draw (${t.reason}).`;
    }
    void finishGame(outcome);
    return true;
  }

  async function finishGame(outcome: GameOutcome) {
    const m = model;
    const opp = opponent;
    if (!m || !opp) return;
    const botElo = opp.state.targetElo;

    const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;

    if (variant === 'chess960') {
      // Update the chess960 pool — seeded lazily on the first 960 game from classical (AP-960-7).
      const prevOpp = poolOpponent(m, 'chess960');
      const nextOpp = recordGame({ targetElo: prevOpp.targetElo, recent: prevOpp.recent }, outcome);
      m.opponentByPool.chess960 = nextOpp;
      opp.state = nextOpp;
      await opp.applyStrength().catch(() => {});
      // Seed chess960 rating lazily from classical if not yet present.
      const seed = m.gameRatings.chess960 ?? m.gameRatings.classical ?? poolRating(m, 'classical');
      m.gameRatings.chess960 = updateRating(seed, [{ opponentRating: botElo, opponentRd: 60, score }]);
    } else {
      // Standard path: adjust the SELECTED pool's adaptive bot toward the 55% band (AP-TC-3).
      const pool = selectedPool;
      const prevOpp = poolOpponent(m, pool);
      const nextOpp = recordGame({ targetElo: prevOpp.targetElo, recent: prevOpp.recent }, outcome);
      m.opponentByPool[pool] = nextOpp;
      opp.state = nextOpp;
      await opp.applyStrength().catch(() => {});
      // Update the SELECTED pool's game rating via one Glicko match vs the bot Elo (AP-TC-3).
      m.gameRatings[pool] = updateRating(poolRating(m, pool), [{ opponentRating: botElo, opponentRd: 60, score }]);
    }

    const now = Date.now();
    const db = await openTrainerDB();
    const rec: GameRecord = {
      id: `g:${now}`,
      pgn: game.pgn(),
      result: outcome,
      botElo,
      playedAt: now,
      coached,
      ...(variant === 'chess960'
        ? { variant: 'chess960', startFen: startFen960 ?? undefined }
        : {
            timeControl: selectedTC.untimed
              ? { initialSec: 0, incrementSec: 0, category: 'classical', untimed: true }
              : {
                  initialSec: initialSecOf(selectedTC),
                  incrementSec: incrementSecOf(selectedTC),
                  category: categoryFor(initialSecOf(selectedTC), incrementSecOf(selectedTC)),
                },
          }),
    };
    await db.put('games', rec);
    lastGame = { id: rec.id, pgn: rec.pgn };
    await app.persistModel(now);
  }

  /** One-click analysis of the game just played — same pipeline as Import, no paste. */
  async function analyzePlayed() {
    if (!lastGame || !model) return;
    aStatus = 'analyzing';
    aProgress = 0;
    try {
      const { openTrainerDB } = await import('../store/db');
      const db = await openTrainerDB();
      const existing = await db.get('gameAnalyses', lastGame.id);
      if (existing) {
        aResult = existing;
        aPuzzles = 0;
        aStatus = 'done';
        return;
      }
      // The opponent left the engine at a limited Elo — restore full strength to analyse.
      // Also reset UCI_Chess960 so analysis never runs in 960 mode (AP-960-4).
      await app.engine.init();
      app.engine.setOption('UCI_LimitStrength', false);
      app.engine.setOption('UCI_Chess960', false);
      await app.engine.isready();

      const res = await runAnalysis(app.engine, app.puzzles, {
        gameId: lastGame.id,
        pgn: lastGame.pgn,
        playerColor: playerColor[0] as 'w' | 'b',
        source: 'played',
        baseRating: Math.round(model.puzzleRating.rating),
        now: Date.now(),
        movetimeMs: 200,
        onProgress: (d, t) => {
          aProgress = d;
          aTotal = t;
        },
      });
      aResult = res.analysis;
      aPuzzles = res.puzzles.length;
      aStatus = 'done';
    } catch (e) {
      result = 'Analysis failed: ' + String(e);
      aStatus = 'idle';
    }
  }

  function resign() {
    if (status === 'playing' || status === 'thinking') {
      status = 'over';
      stopClockLoop();
      if (clock) clock = stopClock(clock);
      result = 'You resigned.';
      void finishGame('loss');
    }
  }
</script>

<section class="col center">
  <h2>Play the adaptive bot</h2>
  {#if model}
    <p class="muted">
      Your {displayPool} rating {Math.round(poolRating(model, displayPool).rating)} · bot ≈ {poolOpponent(model, displayPool).targetElo} Elo
      {#if coached}· <span style="color:var(--accent)">coached on</span>{/if}
    </p>
  {/if}

  <div class="row center" style="gap:1rem;flex-wrap:wrap">
    <label class="muted" style="font-size:0.85rem">
      Opponent:
      <select value={opponentStyle} onchange={(e) => setOpponentStyle(e.currentTarget.value === 'engine' ? 'engine' : 'human')}>
        <option value="human">Human-like (varied moves)</option>
        <option value="engine">Engine (best moves)</option>
      </select>
    </label>

    <label class="muted" style="font-size:0.85rem">
      Mode:
      <select value={variant} disabled={live}
              onchange={(e) => (variant = e.currentTarget.value === 'chess960' ? 'chess960' : 'standard')}>
        <option value="standard">Standard</option>
        <option value="chess960">Chess960 (Wild)</option>
      </select>
    </label>

    {#if variant === 'chess960'}
      <label class="muted" style="font-size:0.85rem">
        Start (blank = random 960):
        <input type="number" min="0" max="959" placeholder="0–959" bind:value={sp960Input}
               disabled={live} style="width:6rem" />
      </label>
    {/if}

    {#if variant !== 'chess960'}
      <label class="muted" style="font-size:0.85rem">
        Time:
        <select
          value={selectedTC.id}
          disabled={live}
          onchange={(e) => { selectedTC = TIME_CONTROL_PRESETS.find((p) => p.id === e.currentTarget.value) ?? selectedTC; }}
        >
          {#each TIME_CONTROL_PRESETS as p (p.id)}
            <option value={p.id}>{p.label}</option>
          {/each}
        </select>
      </label>

      {#if selectedTC.id === 'custom'}
        <label class="muted" style="font-size:0.85rem">
          min <input type="number" min="0" style="width:3.5rem" disabled={live}
            oninput={(e) => { customInitialSec = Math.max(0, Number(e.currentTarget.value) * 60); }}
            value={customInitialSec / 60} />
        </label>
        <label class="muted" style="font-size:0.85rem">
          +sec <input type="number" min="0" style="width:3.5rem" bind:value={customIncrementSec} disabled={live} />
        </label>
      {/if}
    {/if}
  </div>

  {#if clock}
    <div class="clocks">
      <div class="clock {clock.side === botSide ? 'active' : ''}">{fmtClock(botSide === 'w' ? clock.whiteMs : clock.blackMs)}</div>
      <div class="clock {clock.side === playerSideClock ? 'active' : ''}">{fmtClock(playerSideClock === 'w' ? clock.whiteMs : clock.blackMs)}</div>
    </div>
  {/if}

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

  <p class="feedback {status === 'over' ? 'good' : ''}">
    {#if thinking}Bot is thinking…{:else}{result}{/if}
  </p>

  {#if steerNote && status !== 'idle'}
    <p class="muted" style="font-size:0.82rem">{steerNote}</p>
  {/if}

  <div class="row center">
    {#if status === 'idle' || status === 'over'}
      <button onclick={newGame}>New game</button>
    {:else}
      <button onclick={resign} style="background:var(--bad)">Resign</button>
    {/if}
    {#if status === 'over' && lastGame && variant !== 'chess960'}
      <button class="ghost" onclick={analyzePlayed} disabled={aStatus === 'analyzing'}>
        {aStatus === 'analyzing' ? 'Analysing…' : aResult ? 'Re-analyse' : 'Analyse this game'}
      </button>
    {/if}
  </div>
  {#if status === 'over' && variant === 'chess960'}
    <p class="muted" style="font-size:0.8rem; max-width:440px">
      Chess960 games aren't auto-analysed yet — the analysis pipeline assumes standard rules
      and opening theory, so it would mislead. (Tracked for a future 960-aware analyser.)
    </p>
  {/if}

  {#if aStatus === 'analyzing'}
    <div class="panel" style="max-width:420px">
      <p>Analysing position {aProgress} / {aTotal}…</p>
      <div class="bar"><div class="bar-fill" style="width:{aTotal ? (aProgress / aTotal) * 100 : 0}%"></div></div>
    </div>
  {/if}

  {#if aResult}
    <div class="panel col" style="max-width:680px;width:100%">
      <AnalysisResult analysis={aResult} puzzlesMade={aPuzzles} />
    </div>
  {/if}

  <p class="muted" style="font-size:0.8rem; max-width:440px">
    Tip: play slowly and think. After the game, hit <b>Analyse this game</b> — one click turns your
    mistakes into puzzles and updates your weakness dashboard (nothing to paste). The bot then steers
    future openings toward whatever you're weakest at.
  </p>
</section>

<style>
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .bar { height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
  .bar-fill { height: 100%; background: var(--accent); transition: width 0.1s linear; }
  .clocks { display: flex; flex-direction: column; gap: 0.3rem; align-items: center; margin: 0.4rem 0; }
  .clock { font-variant-numeric: tabular-nums; font-size: 1.6rem; font-weight: 700; padding: 0.1rem 0.8rem; border-radius: 6px; background: var(--panel-2); color: var(--text); min-width: 5rem; text-align: center; }
  .clock.active { background: var(--accent); color: #000; }
</style>
