<script lang="ts">
  import { app } from '../state/app.svelte';
  import { onMount, onDestroy } from 'svelte';
  import Board from './Board.svelte';
  import Radar from './Radar.svelte';
  import TrendList from './TrendList.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { PuzzleLadder } from '../calibration/Calibration';
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  import { runAnalysis } from '../analysis/runAnalysis';
  import { loadPlayerModel } from '../store/playerModel';
  import { recordTacticsAttempt } from '../store/attemptsRepo';
  import { resultToGrade } from '../srs/fsrs';
  import { buildWeaknessProfile, type DimensionScore } from '../analysis/weakness';
  import { buildCoachProfile } from '../coach/diagnostic';
  import { COACH_PROBES, seedForSide, extractProbeDim, type CoachProbe } from '../coach/probes';
  import {
    buildProbePlan,
    borderlineDepth,
    coarseEndgameSpec,
    COACH_PROBE_MAX_TOTAL,
    type ProbeSpec,
    type ProbeKind,
  } from '../coach/probePlan';
  import { initTimedProbe, recordTimed, timedDimension, type TimedProbeState } from '../coach/timedProbe';
  import { initClock, startClock, stopClock, tick, flagged, type ClockState } from '../clock/Clock';
  import { buildCoachProgram } from '../coach/program';
  import { buildCoachTrend, isStale, profileAgeDays, COACH_STALE_DAYS } from '../coach/coachTrend';
  import { buildSession } from '../analysis/session';
  import type { CoachProfile, ThemeProbeResult } from '../coach/types';
  import type { TacticalTrainer } from '../trainer/TacticalTrainer';
  import ColorPicker from './ColorPicker.svelte';
  import { resolveColor, type ColorChoice } from '../game/color';
  import { t, getLocale } from '../i18n';
  import { labelOrRaw, gt } from '../i18n/gen';

  type Step = 'intro' | 'ladders' | 'timed' | 'offer-game' | 'game' | 'analysing' | 'result';
  let step = $state<Step>('intro');

  // C2 (CF7): the probe plan is built from the user's à-la-carte scope at startLadders() time.
  // `plan` replaces the old hard-coded THEMES array (motifs + endgame sub-buckets + optional timed).
  let plan = $state<ProbeSpec[]>([]);
  let themeIdx = $state(0);
  // C2/CO4: total probe puzzles spent across the WHOLE assessment — the grand cap (AP-CPROBE-2).
  let totalSpent = 0;
  // CF6 graceful fallback bookkeeping: track whether ANY endgame bucket produced an in-zone puzzle,
  // so we append one coarse phase:'endgame' probe only when ALL theme buckets were empty (seed set) —
  // endgame is never silently absent when some endgame data exists. Reset per assessment (startLadders).
  let endgameAnyScored = false;
  let coarseAppended = false;

  // À-la-carte scope selection (CF7). All three areas checked by default = today's behaviour
  // (no regression). An empty selection is treated as ALL by buildProbePlan (AP-CPROBE-4).
  let pickMotifs = $state(true);
  let pickEndgame = $state(true);
  let pickTimed = $state(true);

  const baseline = () => (app.model ? Math.round(app.model.puzzleRating.rating) : 1200);

  let ladder: PuzzleLadder | null = null;
  let trainer = $state<TacticalTrainer | null>(null);
  let display = $state(new ChessGame());
  let fen = $state('');
  let orientation = $state<'white' | 'black'>('white');
  let feedback = $state('');
  const probes: ThemeProbeResult[] = [];

  // C2/CO15: optional timed block. A fixed budget (90s) via the pure Clock; the UI ticks it with
  // performance.now() deltas (mirrors Play.svelte's rAF loop) and feeds each finished attempt to the
  // pure timedProbe core. The resulting timeManagement DimensionScore is passed to buildCoachProfile.
  const TIMED_BUDGET_MS = 90_000;
  let timedState: TimedProbeState = initTimedProbe();
  let timedClock = $state<ClockState | null>(null);
  let timedRemainingMs = $state(TIMED_BUDGET_MS);
  let timedDim = $state<DimensionScore | null>(null);
  let timedRaf: number | null = null;
  let timedLastTs = 0;
  let timedTrainer = $state<TacticalTrainer | null>(null);
  let timedDisplay = $state(new ChessGame());
  let timedFen = $state('');
  let timedSolvedCount = $state(0);

  let game = $state(new ChessGame());
  let gameFen = $state('');
  let opponent: AdaptiveOpponent | null = null;
  let thinking = $state(false);
  let info = $state('');
  const GAME_MOVE_LIMIT = 48;
  let coachColorChoice = $state<ColorChoice>('random');
  let coachSide = $state<'w' | 'b'>('w');

  // ── C3 designed-position probes ───────────────────────────────────────────
  // Opt-in top-ups at the offer-game step for the two axes a short even game under-measures
  // (conversion + resilience). A probe seeds the SAME even-game board/loop (reused machinery — no new
  // Board, so the F2 onMoveText invariant + board-input-wiring count stay at 3) from a designed FEN,
  // plays it out vs the bot, then extracts ONLY the targeted DimensionScore (single-dimension
  // extraction) and returns to the offer so the user can run the other / play the even game / finish.
  // The probe NEVER calls finishGame/recordGame on the opponent (AP-CDESIGN-1 / AP-COACH-8) and NEVER
  // emits a pass/fail verdict (AP-CDESIGN-5). Accumulated probe cells are merged via buildCoachProfile's
  // gameDimensions path (the diagnostic probeDims seam) at commit().
  const PROBE_MOVE_LIMIT = 60; // a non-converting rook-up / endless shuffle can't run forever (FOLD E3)
  let activeProbe = $state<CoachProbe | null>(null);
  const probeDims: DimensionScore[] = [];
  let probeFeedback = $state('');
  // Reactive flags for the offer-game UI: which probes have already contributed a cell this assessment.
  let probedDims = $state<Set<'endgameConversion' | 'resilience'>>(new Set());
  const conversionProbe = COACH_PROBES.find((p) => p.dimension === 'endgameConversion')!;
  const resilienceProbe = COACH_PROBES.find((p) => p.dimension === 'resilience')!;

  // Calibration-game board in-check highlight: `game` is mutated in place each move and Svelte 5
  // doesn't proxy the ChessGame instance, so a bare `game.inCheck()` binding never re-fires.
  // Depend on the reactive `gameFen` (reassigned every move) so it refreshes. (The ladder board
  // is fine — `display` is reassigned per puzzle.) ADR-0051.
  const gameInCheck = $derived(gameFen ? game.inCheck() : false);

  let profile = $state<CoachProfile | null>(null);
  let programPreview = $state<ReturnType<typeof buildCoachProgram>>([]);

  // C1 — surface the already-persisted (write-only, ADR-0045) coach profile on the intro.
  // `saved`/`savedPrev`/`savedTrend` are $derived off app.model so they re-render when a fresh
  // assessment commits a new profile (Svelte 5 reactivity; ADR-0051 lesson). `nowMs` is UI-stamped
  // once on mount — the single Date boundary; the trend/staleness cores stay pure (AP-CPROF-1).
  const saved = $derived<CoachProfile | undefined>(app.model?.coachProfile);
  const savedPrev = $derived<CoachProfile | undefined>(app.model?.coachProfilePrev);
  let nowMs = $state(0);
  onMount(() => { nowMs = Date.now(); });
  // Stop the timed-block rAF if the view unmounts mid-block (no leaked animation frame).
  onDestroy(() => { if (timedRaf !== null) cancelAnimationFrame(timedRaf); });
  const savedTrend = $derived(saved ? buildCoachTrend(saved, savedPrev) : null);
  const savedAgeDays = $derived(saved ? profileAgeDays(saved.assessedAt, nowMs) : null);
  const savedStale = $derived(saved ? isStale(saved.assessedAt, nowMs) : false);
  // Result-screen trend: commit() has already shifted coachProfile→coachProfilePrev, so prev is the
  // run-before-this and `profile` is the new one (correct prev→current direction).
  const resultTrend = $derived(profile ? buildCoachTrend(profile, app.model?.coachProfilePrev) : null);

  /** Resume WITHOUT re-probing (Q-D / AP-CPROF-6): rebuild the program from the saved profile via the
   *  pure buildCoachProgram, then wrap it exactly like startCoaching. Reload-safe — derived from the
   *  persisted profile, not from the in-memory programPreview. No new persisted state (AP-CPROF-5). */
  function resumeProgram() {
    if (!saved) return;
    const plan = buildCoachProgram(saved, 30, getLocale());
    app.activeSession = { plan: buildSession(plan), current: 0, startedAt: Date.now(), reflection: '' };
    app.go('session');
  }

  function startLadders() {
    // CF7: build the à-la-carte plan from the scope selection. Empty → all (AP-CPROBE-4).
    const selected: ProbeKind[] = [];
    if (pickMotifs) selected.push('motif');
    if (pickEndgame) selected.push('endgame');
    if (pickTimed) selected.push('timed');
    plan = buildProbePlan({ selected, includeTimed: pickTimed });

    themeIdx = 0;
    totalSpent = 0;
    probes.length = 0;
    timedState = initTimedProbe();
    timedDim = null;
    timedSolvedCount = 0;
    endgameAnyScored = false; // reset CF6 fallback bookkeeping for a fresh (or repeat) assessment
    coarseAppended = false;
    // C3: clear any designed-probe reads from a prior assessment.
    probeDims.length = 0;
    probedDims = new Set();
    activeProbe = null;
    probeFeedback = '';
    // Advance past the timed spec for the ladder phase; the timed block runs as its own step after.
    startNextLadder();
  }

  /** Run the next non-timed spec as a themed ladder; when the ladders are exhausted, go to the timed
   *  block (if selected) then the offer-game step. Handles a timed-only selection (no ladders). */
  function startNextLadder() {
    // Skip the timed spec(s) here — they run in their own step.
    while (themeIdx < plan.length && plan[themeIdx].kind === 'timed') themeIdx += 1;
    if (themeIdx >= plan.length) return afterLadders();
    step = 'ladders';
    startThemeLadder();
  }

  function startThemeLadder() {
    const spec = plan[themeIdx];
    const prior = app.model ? app.model.puzzleRating : { rating: 1200, rd: 250, vol: 0.06 };
    ladder = new PuzzleLadder(app.puzzles, prior, {
      min: spec.min,
      max: spec.max,
      window: 300,
      themes: spec.themes,
      phase: spec.phase,
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
      totalSpent += 1;
      maybeExtend();
      void recordProbe(trainer, false); // capture trainer before nextProbePuzzle reassigns it
      feedback = t('coach.missed');
      setTimeout(nextProbePuzzle, 450);
    } else if (res === 'solved') {
      ladder.report(true);
      totalSpent += 1;
      maybeExtend();
      void recordProbe(trainer, true);
      feedback = t('coach.solved');
      setTimeout(nextProbePuzzle, 400);
    } else {
      display = new ChessGame(trainer.getFen());
      fen = display.fen;
    }
  }

  /** Adaptive depth (CO4): after a report, if this motif's running delta is borderline AND its RD is
   *  still loose AND we're under the grand cap, extend this ladder by one puzzle. Pure decision in
   *  borderlineDepth(); the ladder is only a min/max counter. No rating-pool mutation (AP-CPROBE-1/2). */
  function maybeExtend() {
    if (!ladder) return;
    const extend = borderlineDepth({
      spec: plan[themeIdx],
      currentDelta: ladder.rating.rating - baseline(),
      currentRd: ladder.rating.rd,
      countSoFar: ladder.count,
      totalSpent,
      cap: COACH_PROBE_MAX_TOTAL,
    });
    if (extend) ladder.extend(1);
  }

  /**
   * Record a coach diagnostic probe through the EXISTING persistence path (F3 / CF1, ADR-0055):
   * an attempt row (`coachProbe: true`) + a graded FSRS card + a weaknessCounters increment-on-miss,
   * all in `recordTacticsAttempt`'s one atomic tx — WITHOUT moving any rating pool.
   *
   * AP-COACH-8 / AP-ATTEMPT-1 enforcement: `gradeAttempt` is NEVER called for a probe. The puzzle row
   * is passed with its Glicko fields UNCHANGED (Q-F) and the model with `puzzleRating` UNCHANGED (Q-A).
   * `ratingBefore = ratingAfter = baseline()` is recorded honestly — a probe is a diagnostic, not a
   * graded delta. The ladder's internal `rating` stays local and is never persisted to `puzzleRating`
   * (today's correct behaviour, preserved). source stays 'curated' (Q-E) — provenance is the flag only.
   */
  async function recordProbe(tr: TacticalTrainer, solved: boolean): Promise<void> {
    if (!app.model) return;
    const now = Date.now();
    const ms = tr.elapsedMs(now);
    const puzzle = tr.puzzle; // the probe puzzle; passed UNCHANGED (no rating mutation)
    const base = baseline();
    // weaknessCounters increment-on-miss mirrors Tactics/Review. Mutate the live model so the
    // increment is folded into the SAME atomic tx below AND survives to commit()'s reload (I-1).
    if (!solved) {
      for (const theme of puzzle.themes) {
        app.model.weaknessCounters[theme] = (app.model.weaknessCounters[theme] ?? 0) + 1;
      }
    }
    try {
      await recordTacticsAttempt({
        attempt: {
          id: `${puzzle.id}:${now}`,
          puzzleId: puzzle.id,
          solved,
          ms,
          themes: puzzle.themes,
          ratingBefore: base, // probes do NOT move the pool (Q-A/F) — record the baseline, not a delta
          ratingAfter: base,
          playedAt: now,
          source: 'curated', // probe puzzles ARE curated; provenance via coachProbe (Q-E, AP-ATTEMPT-5)
          coachProbe: true,
        },
        puzzle: { ...puzzle }, // rating/ratingDeviation UNCHANGED (AP-COACH-8 / Q-F)
        model: $state.snapshot(app.model), // puzzleRating UNCHANGED (AP-COACH-8 / Q-A)
        srs: { kind: 'puzzle', refId: puzzle.id, grade: resultToGrade(solved, ms) },
        now,
      });
    } catch {
      /* never break the assessment flow on a persistence hiccup (storage full / unavailable) */
    }
  }

  function finishThemeLadder() {
    if (!ladder) return;
    const spec = plan[themeIdx];
    // Record under the spec's stable key (motif key, endgame bucket key, or 'endgame' for the coarse
    // fallback). A bucket with n=0 is pushed honestly and dropped by buildCoachProfile's n>0 guard.
    probes.push({ theme: spec.key, rating: Math.round(ladder.rating.rating), n: ladder.count });
    if (spec.kind === 'endgame' && spec.themes && ladder.count > 0) endgameAnyScored = true;
    themeIdx += 1;

    // CF6 fallback: if we've just finished the LAST themed endgame bucket and none scored, append one
    // coarse phase:'endgame' probe so endgame isn't silently absent when some endgame data exists.
    const nextIsEndgameBucket = themeIdx < plan.length && plan[themeIdx].kind === 'endgame' && !!plan[themeIdx].themes;
    const justFinishedLastEndgameBucket = spec.kind === 'endgame' && !!spec.themes && !nextIsEndgameBucket;
    if (justFinishedLastEndgameBucket && !endgameAnyScored && !coarseAppended) {
      coarseAppended = true;
      plan.splice(themeIdx, 0, coarseEndgameSpec());
    }

    startNextLadder();
  }

  /** After all motif/endgame ladders: run the timed block if it was selected, else offer the game. */
  function afterLadders() {
    if (pickTimed && plan.some((p) => p.kind === 'timed')) {
      startTimedBlock();
    } else {
      step = 'offer-game';
    }
  }

  // ── C2/CO15 timed block ──────────────────────────────────────────────────
  // A short opt-in speed read: serve on-level puzzles back-to-back under a fixed-budget Clock until
  // it flags, feeding each finished attempt to the pure timedProbe core. Reuses recordProbe() so each
  // timed solve records through F3's path too (coachProbe:true, no pool leak). The derived
  // timeManagement DimensionScore is handed to buildCoachProfile via the optional timedDim arg.
  let timedLadder: PuzzleLadder | null = null;

  function startTimedBlock() {
    step = 'timed';
    timedState = initTimedProbe();
    timedSolvedCount = 0;
    timedRemainingMs = TIMED_BUDGET_MS;
    // A dedicated ladder just to SOURCE on-level puzzles (no theme filter); its rating never persists
    // and we never read its rating as a score — the timed read is speed×accuracy, not Glicko.
    const prior = app.model ? app.model.puzzleRating : { rating: 1200, rd: 250, vol: 0.06 };
    timedLadder = new PuzzleLadder(app.puzzles, prior, { min: 1, max: 9999, window: 300 });
    timedClock = startClock(initClock(TIMED_BUDGET_MS, 0, 'w'));
    timedLastTs = performance.now();
    startTimedLoop();
    void nextTimedPuzzle();
  }

  function startTimedLoop() {
    if (timedRaf !== null) return;
    const stepFn = () => {
      if (!timedClock || step !== 'timed') { timedRaf = null; return; }
      const now = performance.now();
      timedClock = tick(timedClock, now - timedLastTs);
      timedLastTs = now;
      timedRemainingMs = timedClock.whiteMs;
      if (flagged(timedClock)) {
        timedRaf = null;
        timedClock = stopClock(timedClock);
        finishTimedBlock();
        return;
      }
      timedRaf = requestAnimationFrame(stepFn);
    };
    timedRaf = requestAnimationFrame(stepFn);
  }

  async function nextTimedPuzzle() {
    if (!timedLadder || step !== 'timed') return;
    const tr = await timedLadder.next(Date.now());
    if (!tr) return finishTimedBlock(); // pool exhausted before the budget — finish honestly
    timedTrainer = tr;
    timedDisplay = new ChessGame(tr.getFen());
    timedFen = timedDisplay.fen;
  }

  function onTimedMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!timedTrainer || step !== 'timed') return;
    const uci = from + to + (timedDisplay.isPromotion(from, to) ? promo : '');
    const res = timedTrainer.playUserMove(uci);
    if (res === 'solved' || res === 'wrong') {
      const solved = res === 'solved';
      const ms = timedTrainer.elapsedMs(Date.now());
      timedState = recordTimed(timedState, { solved, ms });
      if (solved) timedSolvedCount += 1;
      void recordProbe(timedTrainer, solved); // F3 path: coachProbe:true, no pool leak
      void nextTimedPuzzle();
    } else {
      timedDisplay = new ChessGame(timedTrainer.getFen());
      timedFen = timedDisplay.fen;
    }
  }

  function finishTimedBlock() {
    if (timedRaf !== null) { cancelAnimationFrame(timedRaf); timedRaf = null; }
    timedClock = null;
    timedDim = timedDimension(timedState, getLocale());
    step = 'offer-game';
  }

  // Progress total for the ladders step counts only the THEMED ladders (the timed block runs as its
  // own separate step, not a "theme"), so a subset shows an honest "3 / 3" (A4 / AP-CPROBE-4 wording).
  const ladderCount = $derived(plan.filter((p) => p.kind !== 'timed').length);

  /** Which radar dimensions will read n/a if the calibration game is skipped (CO7 nudge). The timed
   *  block, when it produced a sample, covers timeManagement — so it drops out of the n/a list. */
  const skipNaDims = $derived.by(() => {
    const gameOnly: Array<'openingAccuracy' | 'endgameConversion' | 'timeManagement' | 'resilience'> = [
      'openingAccuracy', 'endgameConversion', 'timeManagement', 'resilience',
    ];
    const covered = timedDim && timedDim.sampleSize > 0 ? new Set(['timeManagement']) : new Set<string>();
    return gameOnly.filter((d) => !covered.has(d)).map((d) => t('dimShort.' + d));
  });

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
    activeProbe = null; // the even game (not a probe)
    await beginGame(new ChessGame());
  }

  /** C3: start a designed probe — seed the SAME even-game board/loop from the probe FEN, oriented to
   *  the player's color (seedForSide mirrors for Black). On an engine boot failure, abort gracefully:
   *  the axis stays "not measured" and we return to the offer (AP-CDESIGN-3) — never commit, never a
   *  fabricated cell. */
  async function startProbe(probe: CoachProbe) {
    coachSide = resolveColor(coachColorChoice) === 'white' ? 'w' : 'b';
    activeProbe = probe;
    probeFeedback = '';
    await beginGame(new ChessGame(seedForSide(probe, coachSide)));
  }

  /** Shared game bootstrap for both the even game and a designed probe. On engine failure: the even
   *  game commits without a game (today's behaviour); a probe aborts back to the offer (graceful skip). */
  async function beginGame(seeded: ChessGame) {
    step = 'game';
    game = seeded;
    gameFen = game.fen;
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(baseline()));
    thinking = true;
    info = t('coach.startingEngine');
    try {
      await opponent.applyStrength();
      info = activeProbe ? t('coach.probeRunning') : t('coach.yourMove');
      thinking = false;
      if (coachSide === 'b') await botReply(); // engine (the other side) opens
    } catch {
      return activeProbe ? abortProbe() : finishWithoutGame();
    }
  }

  /** Ply cap for the active game: the even game keeps GAME_MOVE_LIMIT; a probe gets its own bound so a
   *  non-converting rook-up can't run forever (FOLD E3). */
  const moveLimit = () => (activeProbe ? PROBE_MOVE_LIMIT : GAME_MOVE_LIMIT);

  /** Route the game's end to the probe extractor or the even-game finisher. */
  function endGame() {
    return activeProbe ? finishProbe() : finishGame();
  }

  async function onGameMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!opponent || game.turn !== coachSide || thinking) return;
    await app.engine.resetVariant();
    const san = game.move(from, to, promo);
    if (!san) return;
    gameFen = game.fen;
    if (game.terminal().over || game.history().length >= moveLimit()) return endGame();
    await botReply();
    if (game.terminal().over || game.history().length >= moveLimit()) endGame();
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

  /** C3: analyse the finished probe game through the EXISTING pipeline, extract ONLY the targeted
   *  DimensionScore (single-dimension extraction — AP-CDESIGN-2), accumulate it, then return to the
   *  offer. The opponent's finishGame/recordGame is NEVER called (AP-CDESIGN-1 / AP-COACH-8). A thin
   *  probe (sampleSize 0) stays "not measured" — no fabricated cell (AP-CDESIGN-3). */
  async function finishProbe() {
    const probe = activeProbe;
    if (!probe) return finishGame(); // defensive — shouldn't happen
    step = 'analysing';
    info = t('coach.analysingGame');
    const detailKey = probe.dimension === 'endgameConversion' ? 'diag.probeConversion' : 'diag.probeResilience';
    let cell: DimensionScore | null = null;
    try {
      const { analysis } = await runAnalysis(app.engine, app.puzzles, {
        gameId: `probe-${probe.dimension}-${Date.now()}`,
        pgn: game.pgn(),
        playerColor: coachSide,
        source: 'played',
        baseRating: baseline(),
        now: Date.now(),
      });
      const dims = buildWeaknessProfile([analysis], baseline(), getLocale()).dimensions;
      cell = extractProbeDim(probe.targetDimension, dims, gt(detailKey, getLocale()));
    } catch {
      cell = null; // analysis failed — leave the axis untouched (graceful skip)
    }
    const dimLabel = gt('dim.' + probe.targetDimension, getLocale());
    if (cell && cell.sampleSize > 0) {
      // Replace any prior reading for this dimension (re-run overrides), then record provenance.
      const i = probeDims.findIndex((d) => d.dimension === cell!.dimension);
      if (i >= 0) probeDims[i] = cell; else probeDims.push(cell);
      probedDims = new Set([...probedDims, probe.dimension]);
      probeFeedback = t('coach.probeDone', { dim: dimLabel });
    } else {
      probeFeedback = cell ? t('coach.probeUnmeasured', { dim: dimLabel }) : t('coach.probeAborted', { dim: dimLabel });
    }
    activeProbe = null;
    step = 'offer-game';
  }

  /** Abort a probe whose engine failed to boot: leave the axis untouched, return to the offer. */
  function abortProbe() {
    const probe = activeProbe;
    activeProbe = null;
    probeFeedback = probe ? t('coach.probeAborted', { dim: gt('dim.' + probe.targetDimension, getLocale()) }) : '';
    step = 'offer-game';
  }

  async function commit(gameDimensions: DimensionScore[] | null) {
    const p = buildCoachProfile({ puzzleRating: baseline(), probes, gameDimensions, assessedAt: Date.now(), locale: getLocale(), timedDim: timedDim ?? undefined, probeDims: probeDims.length ? probeDims.slice() : undefined });
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

{#snippet scopePicker()}
  <!-- C2/CF7 à-la-carte scope: pick which areas to probe. All checked = today's full sweep (no
       regression). Selecting none is treated as all by buildProbePlan (AP-CPROBE-4). -->
  <fieldset class="scope">
    <legend>{t('coach.scopeTitle')}</legend>
    <label><input type="checkbox" bind:checked={pickMotifs} /> {t('coach.scopeMotifs')}</label>
    <label><input type="checkbox" bind:checked={pickEndgame} /> {t('coach.scopeEndgame')}</label>
    <label><input type="checkbox" bind:checked={pickTimed} /> {t('coach.scopeTimed')}</label>
    {#if !pickMotifs && !pickEndgame && !pickTimed}
      <p class="muted" style="font-size:0.78rem;margin:0.25rem 0 0">{t('coach.scopeEmptyAll')}</p>
    {/if}
  </fieldset>
{/snippet}

<section class="col center" style="max-width:680px;margin:0 auto">
  <h2>{t('coach.title')}</h2>

  {#if step === 'intro'}
    {#if saved}
      <!-- C1: the always-on card IS the "view" of the saved profile (AP-CPROF-8 — no dead
           "View profile" button). Only Start program + Re-assess are buttons. -->
      <div class="panel col center" style="gap:0.5rem;width:100%">
        <h3>{t('coach.savedTitle')}</h3>
        <p class="muted" style="font-size:0.82rem">
          {t('coach.lastAssessed', { date: new Date(saved.assessedAt).toLocaleDateString(getLocale()) })}{#if savedAgeDays !== null}{t('coach.ageSuffix', { days: savedAgeDays })}{/if}
        </p>
        {#if savedStale}<p class="feedback">{t('coach.staleNudge', { days: COACH_STALE_DAYS })}</p>{/if}
        <Radar dimensions={saved.dimensions} />
        <div class="row" style="gap:1.5rem;align-items:flex-start">
          <div class="col"><b>{t('coach.strengths')}</b>{#each saved.strengths as s}<span>✔ {s}</span>{:else}<span class="muted">—</span>{/each}</div>
          <div class="col"><b>{t('coach.focusOn')}</b>{#each saved.weaknesses as w}<span>△ {w}</span>{:else}<span class="muted">—</span>{/each}</div>
        </div>
        {#if savedTrend && savedTrend.motifs.length}
          <TrendList trend={savedTrend} />
        {/if}
        {@render scopePicker()}
        <div class="row center">
          <button onclick={resumeProgram}>{t('coach.startProgram')}</button>
          <button style="background:transparent;border:1px solid var(--border)" onclick={startLadders} disabled={app.puzzles.size === 0}>{t('coach.reassess')}</button>
        </div>
        {#if app.puzzles.size === 0}<p class="muted">{t('coach.loadingPuzzles')}</p>{/if}
      </div>
    {:else}
      <p class="muted">{t('coach.intro')}</p>
      {@render scopePicker()}
      <button onclick={startLadders} disabled={app.puzzles.size === 0}>{t('coach.startAssessment')}</button>
      {#if app.puzzles.size === 0}<p class="muted">{t('coach.loadingPuzzles')}</p>{/if}
    {/if}

  {:else if step === 'ladders'}
    <p class="muted">{t('coach.themeProgress', { current: themeIdx + 1, total: ladderCount })}<b>{labelOrRaw('motif', plan[themeIdx]?.key ?? '', getLocale())}</b>{t('coach.themeProgressSuffix')}</p>
    <div class="board-wrap">
      <Board {fen} {orientation}
        turnColor={display.turn === 'w' ? 'white' : 'black'}
        movableColor={display.turn === 'w' ? 'white' : 'black'}
        dests={display.dests()} check={display.inCheck()} onMove={onLadderMove}
        onMoveText={(text) => {
          if (!trainer || !ladder) return false;
          const r = display.resolveMove(text);
          if (!r) return false;
          onLadderMove(r.from, r.to, r.promo ?? 'q');
          return true;
        }} />
    </div>
    <p class="feedback">{feedback}</p>

  {:else if step === 'timed'}
    <!-- C2/CO15 timed block: solve as many on-level puzzles as you can before the budget flags. -->
    <p class="muted">{t('coach.timedTitle')}</p>
    <p class="muted" style="font-size:0.95rem">{t('coach.timedRemaining', { sec: Math.ceil(timedRemainingMs / 1000) })}<b>{t('coach.timedSolved', { n: timedSolvedCount })}</b></p>
    <div class="board-wrap">
      <Board fen={timedFen}
        orientation={timedDisplay.turn === 'w' ? 'white' : 'black'}
        turnColor={timedDisplay.turn === 'w' ? 'white' : 'black'}
        movableColor={timedDisplay.turn === 'w' ? 'white' : 'black'}
        dests={timedDisplay.dests()} check={timedDisplay.inCheck()} onMove={onTimedMove}
        onMoveText={(text) => {
          if (!timedTrainer) return false;
          const r = timedDisplay.resolveMove(text);
          if (!r) return false;
          onTimedMove(r.from, r.to, r.promo ?? 'q');
          return true;
        }} />
    </div>
    <button style="background:transparent;border:1px solid var(--border)" onclick={finishTimedBlock}>{t('coach.timedDone')}</button>

  {:else if step === 'offer-game'}
    <div class="panel col center">
      <h3>{t('coach.assessmentDone')}</h3>
      <p class="muted">{t('coach.offerGameBody')}</p>
      {#if skipNaDims.length}
        <p class="feedback" style="font-size:0.85rem">{t('coach.skipCost', { dims: skipNaDims.join(', ') })}</p>
      {/if}
      <ColorPicker bind:value={coachColorChoice} />
      <div class="row center">
        <button onclick={startGame}>{t('coach.playGame')}</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={finishWithoutGame}>{t('coach.skip')}</button>
      </div>

      <!-- C3 designed-position probes: opt-in top-ups for the two axes a balanced game under-measures.
           Each runs a designed game then returns here. Directional, no grade (AP-CDESIGN-5). -->
      <div class="probes col" style="width:100%;border-top:1px solid var(--border);margin-top:0.75rem;padding-top:0.75rem;gap:0.4rem">
        <p class="muted" style="font-size:0.85rem">{t('coach.probesTitle')}</p>
        <div class="row center">
          <button style="background:transparent;border:1px solid var(--border)" onclick={() => startProbe(conversionProbe)}>
            {probedDims.has('endgameConversion') ? '✔ ' : ''}{t('coach.probeConversion')}
          </button>
          <button style="background:transparent;border:1px solid var(--border)" onclick={() => startProbe(resilienceProbe)}>
            {probedDims.has('resilience') ? '✔ ' : ''}{t('coach.probeResilience')}
          </button>
        </div>
        {#if probeFeedback}<p class="feedback" style="font-size:0.85rem">{probeFeedback}</p>{/if}
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
        check={gameInCheck} onMove={onGameMove}
        onMoveText={(text) => {
          if (!opponent || game.turn !== coachSide || thinking) return false;
          const r = game.resolveMove(text);
          if (!r) return false;
          void onGameMove(r.from, r.to, r.promo ?? 'q');
          return true;
        }} />
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
          <li><b>{labelOrRaw('activity', item.activity, getLocale())}</b> <span class="muted">{t('coach.programItemMeta', { minutes: item.minutes, reason: item.reason })}</span></li>
        {/each}
      </ol>
      {#if resultTrend && resultTrend.motifs.length}
        <TrendList trend={resultTrend} />
      {/if}
      <div class="row center">
        <button onclick={startCoaching}>{t('coach.startSession')}</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={() => app.go('home')}>{t('coach.later')}</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .scope {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    margin: 0.5rem 0;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .scope legend { font-size: 0.82rem; color: var(--muted); padding: 0 0.4rem; }
  .scope label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; cursor: pointer; }
</style>
