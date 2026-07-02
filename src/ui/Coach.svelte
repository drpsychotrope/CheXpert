<script lang="ts">
  import { app } from '../state/app.svelte';
  import { onMount, onDestroy } from 'svelte';
  import Board from './Board.svelte';
  import Radar from './Radar.svelte';
  import TrendList from './TrendList.svelte';
  import EvalGraph from './EvalGraph.svelte';
  import SolutionReveal from './SolutionReveal.svelte';
  import ConceptCard from './ConceptCard.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { PuzzleLadder } from '../calibration/Calibration';
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  import { runAnalysis, loadAllAnalyses } from '../analysis/runAnalysis';
  import { loadPlayerModel } from '../store/playerModel';
  import { recordTacticsAttempt } from '../store/attemptsRepo';
  import { resultToGrade } from '../srs/fsrs';
  import { buildWeaknessProfile, type DimensionScore } from '../analysis/weakness';
  import type { GameAnalysis } from '../analysis/types';
  import { buildCoachProfile } from '../coach/diagnostic';
  import { recentAnalyses, analysesBySource, COACH_ASSESS_WINDOW, COACH_ASSESS_MIN_GAMES } from '../coach/assessmentWindow';
  import { COACH_PROBES, seedForSide, extractProbeDim, type CoachProbe } from '../coach/probes';
  import {
    buildProbePlan,
    borderlineDepth,
    coarseEndgameSpec,
    singleMotifPlan,
    COACH_PROBE_MAX_TOTAL,
    type ProbeSpec,
    type ProbeKind,
  } from '../coach/probePlan';
  import { initTimedProbe, recordTimed, timedDimension, type TimedProbeState } from '../coach/timedProbe';
  import { initClock, startClock, stopClock, tick, flagged, type ClockState } from '../clock/Clock';
  import { buildCoachProgram } from '../coach/program';
  import { programEfficacy, namedOpeningForGap } from '../coach/coachLoop';
  import { loadEco, type EcoEntry } from '../opening/eco';
  import { buildCoachNarrative, rankByLeverage } from '../coach/narrative';
  import { criticalMoments } from '../analysis/criticalMoments';
  import { explainPly } from '../analysis/explain';
  import { loadConcepts, cardForThemes, type ConceptCard as ConceptCardData } from '../concepts/concepts';
  import { metacogCoachLine } from '../coach/coaching';
  import { calibration, type MetacogAttempt } from '../metacog/metacog';
  import { allAttempts } from '../store/attemptsRepo';
  import { buildCoachTrend, isStale, profileAgeDays, COACH_STALE_DAYS } from '../coach/coachTrend';
  import { buildSession } from '../analysis/session';
  import type { CoachProfile, ThemeProbeResult, CoachGoal } from '../coach/types';
  import type { TacticalTrainer } from '../trainer/TacticalTrainer';
  import ColorPicker from './ColorPicker.svelte';
  import { resolveColor, type ColorChoice } from '../game/color';
  import { t, getLocale, fmtPct } from '../i18n';
  import { labelOrRaw, gt, motifLabelOrRaw } from '../i18n/gen';
  import { isHotMeasure } from '../coach/hotMeasure';
  import { splitProgramDays, programIdOf, attemptedDays, nextProgramDay } from '../coach/multiday';
  import { recentSessionLogs } from '../store/sessionLogRepo';
  import type { PlanItem } from '../analysis/studyPlan';
  import { coachProfileFilename } from '../coach/funnel';
  import { downloadText } from './pgnDownload';

  type Step = 'intro' | 'goals' | 'ladders' | 'timed' | 'offer-game' | 'game' | 'analysing' | 'result';
  let step = $state<Step>('intro');

  // ── C5/CO3 intake goal ─────────────────────────────────────────────────────
  // The optional, skippable coaching goal. Pre-selected from the LAST run's goal (coachProfilePrev.goal)
  // so a re-run defaults the picker (E1; the user can change or skip). `undefined` = skipped / legacy ⇒
  // today's weakness-first program (byte-identical). Soft weighting only (AP-CINTAKE-1).
  let goal = $state<CoachGoal | undefined>(app.model?.coachProfilePrev?.goal ?? app.model?.coachProfile?.goal);
  // The descriptive metacog coach line for the result (null below the sample floor / metacog off).
  let coachLine = $state<string | null>(null);
  const GOAL_OPTIONS: Array<{ id: CoachGoal; key: string }> = [
    { id: 'target-rating', key: 'coach.goalTargetRating' },
    { id: 'fix-blunders', key: 'coach.goalFixBlunders' },
    { id: 'opening-prep', key: 'coach.goalOpeningPrep' },
    { id: 'time-trouble', key: 'coach.goalTimeTrouble' },
  ];

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
  // CF8: set when the calibration game's engine failed to boot, so the result note distinguishes an
  // engine failure from a deliberate Skip (both reach finishWithoutGame, today silently). Honesty.
  let gameFailed = $state(false);
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

  // ── C7 configurable budget + closed loop ──────────────────────────────────
  // CO5: the 15/30/60 budget toggle mirroring Insights. Default 30 (no behaviour change until the
  // user picks). It drives BOTH the preview (below, $derived) AND the launched session (startCoaching/
  // resumeProgram stamp app.activeSession.budgetMin) — never cosmetic (AP-CPROG-1).
  let budget = $state(30);
  // PR-18 (ADR-0076): spread the launched program over N days (1 = today's single session).
  let spreadDays = $state(1);
  // CO10/CO17 inputs, loaded once at result time (the UI owns the async eco/analyses reads — the cores
  // stay pure, AP-CPROG-9). `coachAnalyses` is the window the profile was built from (history path) or
  // the single played game; `ecoTable` is the bundled CC0 opening table.
  let coachAnalyses = $state<GameAnalysis[]>([]);
  let ecoTable = $state<EcoEntry[]>([]);

  // CO17: the most-played opening across the analysed games (null when none identifiable → generic
  // reason). Pure derive over loaded data; re-localizes on FR/EN switch (getLocale() is reactive).
  const namedOpening = $derived(namedOpeningForGap(coachAnalyses, ecoTable, getLocale()));
  // The program preview is now $derived so the budget toggle (and a language switch) recompute it
  // live. Feeds buildCoachProgram the goal (C5, 4th arg) AND the named opening (C7, 5th arg).
  const programPreview = $derived<ReturnType<typeof buildCoachProgram>>(
    profile ? buildCoachProgram(profile, budget, getLocale(), profile.goal, { namedOpening: namedOpening ?? undefined }) : [],
  );
  // CO10: descriptive before/after per measurable step (the SAME motifEfficacy read Insights uses).
  // [] for a ladders-only run (no analysed games) → the result renders NO efficacy header (E3).
  const efficacy = $derived(programPreview.length ? programEfficacy(programPreview, coachAnalyses) : []);
  // Joinable by motifKey for the inline per-step advisory (E1).
  const efficacyByKey = $derived(new Map(efficacy.map((e) => [e.motifKey, e])));

  // ── C6 coach-output teaching ──────────────────────────────────────────────
  // The result screen COMMUNICATES + TEACHES (C6). All four surfaces read the SAME profile (and,
  // for the game review, the GameAnalysis the coach used to compute dimensions but previously
  // discarded). Nothing here is persisted (Q-H / AP-CTEACH-6): the review is for the just-played
  // game only, held in transient $state — no new CoachProfile field, no DB_VERSION bump.
  //
  // `gameAnalysis`: the full per-ply analysis retained from finishGame() (was thrown away). Feeds
  // the PURE criticalMoments/winCurve selectors + EvalGraph + F4's SolutionReveal replay. null when
  // no game was analysed (puzzle/history path or an analysis failure).
  let gameAnalysis = $state<GameAnalysis | null>(null);
  // The turning point the user selected in the game review (index into gameAnalysis.plies); null = none.
  let selectedPly = $state<number | null>(null);
  // The concept card for the top weak motif (CO1), behind the "Learn the pattern" toggle. null when
  // no card resolves (honest — cardForThemes returns null for no-card themes), so the toggle hides.
  let topCard = $state<ConceptCardData | null>(null);
  let showCard = $state(false);

  // Narrative + leverage are PURE functions of (profile, locale) — recompute reactively so a
  // FR/EN switch re-localizes them (getLocale() is reactive; ADR-0051/0053). Empty when no profile.
  const narrative = $derived(profile ? buildCoachNarrative(profile, getLocale()) : []);
  const ranked = $derived(profile ? rankByLeverage(profile, getLocale()) : []);
  // The top 2-3 turning points of the just-played game (PURE selector); [] when no game / a clean game.
  const turningPoints = $derived(gameAnalysis ? criticalMoments(gameAnalysis, { max: 3 }) : []);

  // CO1: load (and re-load on language switch) the concept card for the TOP weak MOTIF focus. Mirrors
  // Tactics' $effect pattern — reading getLocale() inside tracks the reactive locale so flipping FR/EN
  // refetches the matching seed. A no-card theme → topCard stays null → the toggle simply won't render.
  $effect(() => {
    const loc = getLocale();
    const topMotif = ranked.find((r) => r.kind === 'motif')?.key;
    if (!topMotif) { topCard = null; return; }
    loadConcepts(loc).then((cards) => { topCard = cardForThemes([topMotif], cards); });
  });

  /** Thin local adapter (FOLD-A5 / F4 FOLD-4): turn explainPly's rich {headline, reasons[]} into the
   *  single string SolutionReveal's source-agnostic `why?` prop accepts — NO fork of SolutionReveal.
   *  The Coach's "why" is the engine-backed explainPly (the coach game HAS a real PlyAnalysis). */
  function explainLine(plyIndex: number): string | null {
    if (!gameAnalysis) return null;
    const ply = gameAnalysis.plies[plyIndex];
    if (!ply) return null;
    const ex = explainPly(ply, getLocale());
    return [ex.headline, ...ex.reasons, ex.better].filter(Boolean).join(' ');
  }

  // ── C4 real-data assessment ───────────────────────────────────────────────
  // The coach can build its profile from a recent WINDOW of the user's real analysed games (imported
  // + played, already unified by loadAllAnalyses) via the SAME buildWeaknessProfile — never a fork
  // (AP-CREAL-1). `historyAvailable` gates the "use my recent games" option at the offer step; it's
  // read once on mount (cheap; loadAllAnalyses is cached). `historyCounts` drives the honest
  // provenance line (FOLD-C4): for the history path it carries the windowed per-source counts; the
  // toy-game path sets a single-game count so the line distinguishes history vs single (FOLD-C6).
  let historyAvailable = $state(false);
  let historyCounts = $state<{ games: number; played: number; imported: number; fromHistory: boolean } | null>(null);
  onMount(async () => {
    try {
      historyAvailable = (await loadAllAnalyses()).length >= COACH_ASSESS_MIN_GAMES;
    } catch { /* storage unavailable — hide the history option, fall back to toy game/ladders */ }
  });

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

  // ── CF4 mid-assessment resume (in-memory, mirrors Session.svelte:54-93) ────────────────────────
  // The wizard's cursor (step + à-la-carte plan + themeIdx + probes-so-far) is mirrored into the
  // in-memory singleton `app.coachAssessment` at each step transition, so navigating away and back
  // RESUMES instead of losing everything (CF4). NOT persisted by default → no schema change
  // (AP-CFUNNEL-3). `resumed` flags a restored run so the UI offers "Start over" (FOLD-C1).
  let resumed = $state(false);
  // Which steps are worth snapshotting/resuming: the declarative, mid-flow ones. `game`/`analysing`
  // hold a LIVE engine/ladder/rAF that can't be serialised; on re-entry such a run resumes at the
  // safe `offer-game` step (the assessment continues there) rather than a broken half-game.
  const RESUMABLE_STEPS = new Set<Step>(['goals', 'ladders', 'timed', 'offer-game']);

  /** Snapshot the current wizard cursor into the singleton (called at each step transition). Only
   *  resumable steps are stored; transient steps clear nothing (the last resumable snapshot stands). */
  function saveAssessment() {
    if (!RESUMABLE_STEPS.has(step)) return;
    // PR-12: a targeted re-probe (seconds long) is NOT resumable — parking it would make the
    // resume path commit a one-motif run as a FULL profile. Guard, don't snapshot.
    if (reprobeTheme) return;
    app.coachAssessment = {
      step,
      plan: $state.snapshot(plan) as ProbeSpec[],
      themeIdx,
      probes: probes.slice(),
    };
  }

  /** Drop the in-memory assessment (on a completed commit or an explicit Start over). */
  function clearAssessment() {
    app.coachAssessment = null;
    resumed = false;
  }

  /** FOLD-C1: discard a resumed assessment and re-enter the intro fresh. */
  function startOver() {
    clearAssessment();
    step = 'intro';
  }

  // Resume on mount if an in-progress assessment is parked in the singleton (CF4). Restore the plan
  // and probes, then re-enter at a safe step: a parked `ladders` rebuilds the ladder for the saved
  // themeIdx via startNextLadder(); a parked `timed` (live rAF can't be restored) resumes at the
  // offer; `goals`/`offer-game` restore directly. Mirrors Session.svelte's resume-on-mount.
  onMount(() => {
    const snap = app.coachAssessment;
    if (!snap) return;
    resumed = true;
    plan = snap.plan;
    themeIdx = snap.themeIdx;
    probes.length = 0;
    probes.push(...snap.probes);
    if (snap.step === 'ladders') {
      startNextLadder(); // rebuilds the ladder at themeIdx (re-serves the current theme's puzzles)
    } else if (snap.step === 'timed' || snap.step === 'offer-game') {
      step = 'offer-game';
    } else {
      step = snap.step as Step; // 'goals'
    }
  });
  const savedTrend = $derived(saved ? buildCoachTrend(saved, savedPrev) : null);
  const savedAgeDays = $derived(saved ? profileAgeDays(saved.assessedAt, nowMs) : null);
  const savedStale = $derived(saved ? isStale(saved.assessedAt, nowMs) : false);
  // Result-screen trend: commit() has already shifted coachProfile→coachProfilePrev, so prev is the
  // run-before-this and `profile` is the new one (correct prev→current direction).
  const resultTrend = $derived(profile ? buildCoachTrend(profile, app.model?.coachProfilePrev) : null);

  // C4 (§2.5/§2.7): the honest provenance "source" phrase fed into coach.directional. Ladders prefix
  // (or "no puzzle data"), then — when a real game contributed dimensions — either the windowed
  // history count ("N recent games (M played, K imported)") or the single short-game suffix, so the
  // text matches what ACTUALLY fed the profile (FOLD-C6 / AP-CREAL-9). Directional, no grade.
  const provenanceSource = $derived.by(() => {
    const ladders = profile?.source.ladders ? t('coach.sourceLadders') : t('coach.sourceNoData');
    if (!profile?.source.game) return ladders;
    if (historyCounts?.fromHistory) {
      // "…two puzzles per motif + your history: N recent games (M played, K imported)"
      return ladders + ' + ' + t('coach.fromHistory') + ': ' + t('coach.basedOnGames', {
        n: historyCounts.games, played: historyCounts.played, imported: historyCounts.imported,
      });
    }
    // single toy game — distinguish from history explicitly (FOLD-C6)
    return ladders + ' + ' + t('coach.fromSingleGame');
  });

  /** Resume WITHOUT re-probing (Q-D / AP-CPROF-6): rebuild the program from the saved profile via the
   *  pure buildCoachProgram, then wrap it exactly like startCoaching. Reload-safe — derived from the
   *  persisted profile, not from the in-memory programPreview. No new persisted state (AP-CPROF-5). */
  async function resumeProgram() {
    if (!saved) return;
    // PR-18 (ADR-0076): a multi-day program resumes at its first unattempted day (progress derived
    // from the sessionLog's I8 stamps). A completed program falls through to the classic resume.
    if (saved.programDays?.length) {
      try {
        const attempted = attemptedDays(await recentSessionLogs(100), programIdOf(saved));
        const day = nextProgramDay(saved.programDays.length, attempted);
        if (day !== null) return startProgramDay(saved.programDays, day);
      } catch {
        /* log read hiccup — classic resume below */
      }
    }
    // Resume re-weights from the goal the saved profile was built with (C5 — persisted on the profile).
    // C7/CO5: honour the chosen budget here too (default 30 ⇒ byte-identical) and stamp it on the
    // session so Session.svelte runs the right budget (AP-CPROG-1). No named opening on the intro path.
    const plan = buildCoachProgram(saved, budget, getLocale(), saved.goal);
    app.activeSession = { plan: buildSession(plan), current: 0, startedAt: Date.now(), reflection: '', budgetMin: budget };
    app.go('session');
  }

  /** PR-18: launch ONE day of the split program as a session, stamped with the I8 identity. */
  function startProgramDay(days: PlanItem[][], day: number) {
    const prof = app.model?.coachProfile;
    if (!prof) return;
    const items = days[day] ?? [];
    const dayMin = items.reduce((s, i) => s + i.minutes, 0);
    app.activeSession = {
      plan: buildSession(items),
      current: 0,
      startedAt: Date.now(),
      reflection: '',
      budgetMin: dayMin || budget,
      programId: programIdOf(prof),
      day,
    };
    app.go('session');
  }

  /** C5: the optional goal picker precedes the ladders. Pre-select the last run's goal (E1), then show
   *  the step; both "pick a goal" and "skip" lead to startLadders(). */
  function startGoals() {
    goal = app.model?.coachProfilePrev?.goal ?? app.model?.coachProfile?.goal;
    step = 'goals';
    saveAssessment(); // CF4: a started assessment is resumable from the goals step on
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
    saveAssessment(); // CF4: snapshot the cursor at the start of each themed ladder
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
    // PR-12 (ADR-0070): a targeted re-probe never continues into timed/game — it merges and exits.
    if (reprobeTheme) return void commitReprobe();
    if (pickTimed && plan.some((p) => p.kind === 'timed')) {
      startTimedBlock();
    } else {
      step = 'offer-game';
      saveAssessment(); // CF4: resumable at the offer step
    }
  }

  // ── PR-12 (ADR-0070, lifts coach-program-v2 D2): targeted motif re-probe ──
  // One themed ladder, then a SURGICAL merge into the saved profile: only that MotifScore moves
  // (baseline kept = the profile's, so deltas stay comparable); the full old profile becomes
  // coachProfilePrev so the trend shows old→new for THIS motif (others read flat). Dimensions,
  // assessedAt and the strengths/weaknesses labels are deliberately untouched — labels refresh at
  // the next full re-assessment (documented in the spec).
  let reprobeTheme = $state<string | null>(null);
  let reprobeDone = $state('');
  let reprobeHot = $state(false); // I10: the read happened right after drilling that motif

  function startReprobe(theme: string) {
    if (!saved || app.puzzles.size === 0) return;
    app.coachAssessment = null; // a parked full assessment must not swallow this scoped run
    reprobeTheme = theme;
    reprobeDone = '';
    reprobeHot = false;
    plan = singleMotifPlan(theme);
    themeIdx = 0;
    totalSpent = 0;
    probes.length = 0;
    probeDims.length = 0;
    probedDims = new Set();
    activeProbe = null;
    probeFeedback = '';
    endgameAnyScored = false;
    coarseAppended = false;
    timedDim = null;
    startNextLadder();
  }

  async function commitReprobe() {
    const theme = reprobeTheme;
    reprobeTheme = null;
    const m = app.model;
    const probe = theme ? probes.find((p) => p.theme === theme) : undefined;
    if (!theme || !m?.coachProfile || !probe || probe.n === 0) {
      reprobeDone = t('coach.reprobeFailed');
      step = 'intro';
      return;
    }
    const prof = m.coachProfile;
    // I10: label (never block) a read taken right after drilling the same motif.
    try {
      reprobeHot = isHotMeasure(await allAttempts(), theme, Date.now());
    } catch {
      reprobeHot = false;
    }
    const merged = {
      theme,
      rating: probe.rating,
      n: probe.n,
      baseline: prof.puzzleRating, // keep the PROFILE baseline so deltas stay comparable
      delta: probe.rating - prof.puzzleRating,
    };
    m.coachProfilePrev = prof;
    m.coachProfile = {
      ...prof,
      motifs: prof.motifs.some((x) => x.theme === theme)
        ? prof.motifs.map((x) => (x.theme === theme ? merged : x))
        : [...prof.motifs, merged],
    };
    await app.persistModel(Date.now());
    reprobeDone = t('coach.reprobeDone', { motif: motifLabelOrRaw(theme, getLocale()) });
    step = 'intro';
  }

  // ── C2/CO15 timed block ──────────────────────────────────────────────────
  // A short opt-in speed read: serve on-level puzzles back-to-back under a fixed-budget Clock until
  // it flags, feeding each finished attempt to the pure timedProbe core. Reuses recordProbe() so each
  // timed solve records through F3's path too (coachProbe:true, no pool leak). The derived
  // timeManagement DimensionScore is handed to buildCoachProfile via the optional timedDim arg.
  let timedLadder: PuzzleLadder | null = null;

  function startTimedBlock() {
    step = 'timed';
    saveAssessment(); // CF4: a parked timed block resumes at the offer step (live rAF can't restore)
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
    saveAssessment(); // CF4: resumable at the offer step
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
    gameFailed = false; // reset; set below only if the even-game engine fails to boot
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
      // CF8: a probe aborts with its own message (probeAborted). The even game previously called
      // finishWithoutGame() SILENTLY — indistinguishable from a deliberate Skip. Surface the failure
      // via the existing `info` slot and flag it so the result note says "engine failed" (AP-CFUNNEL-4).
      if (activeProbe) return abortProbe();
      gameFailed = true;
      info = t('coach.engineFailed');
      return finishWithoutGame();
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
    gameAnalysis = null; // reset on a (re-)run; set below only on a successful analysis
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
      // C6/CO13: HOLD the just-computed analysis (previously discarded) so the result can render the
      // EvalGraph + turning points + F4 replay. Transient $state only — never persisted (Q-H).
      gameAnalysis = analysis;
      // Toy-game provenance (FOLD-C6): a single played game, so the line reads "1 recent game
      // (1 played, 0 imported)" — distinct from the history path's window. Only when the analysis
      // produced dims (else the line stays the single-game text below at render).
      historyCounts = { games: 1, played: 1, imported: 0, fromHistory: false };
    } catch { /* fall through with no game dims */ }
    await commit(gameDimensions);
  }

  async function finishWithoutGame() {
    await commit(null);
  }

  /** C4 (§2.1/§2.3a): assess from the user's REAL recent games. Window the already-unified analyses
   *  (imported + played) and feed the array to the SAME buildWeaknessProfile the coach consumes —
   *  consume, never fork (AP-CREAL-1). Below the floor → fall back to the ladders-only path so we
   *  never render an all-"not measured" radar as an assessment (FOLD-C2 / AP-CREAL-5). Windowing is
   *  pure (sorts the records' own analyzedAt); this function only owns the loadAllAnalyses() read. */
  async function finishWithHistory() {
    step = 'analysing';
    info = t('coach.analysingGame');
    let all: GameAnalysis[] = [];
    try {
      all = await loadAllAnalyses();
    } catch { return finishWithoutGame(); } // storage unavailable → fall back (AP-CREAL-5)
    const window = recentAnalyses(all, COACH_ASSESS_WINDOW);
    if (window.length < COACH_ASSESS_MIN_GAMES) return finishWithoutGame(); // thin history → fall back
    const gameDimensions = buildWeaknessProfile(window, baseline(), getLocale()).dimensions;
    historyCounts = { games: window.length, ...analysesBySource(window), fromHistory: true };
    await commit(gameDimensions);
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
    // C6: reset the transient review surface for a fresh result (the history/skip/probe paths never
    // set gameAnalysis, so it stays null and the game-review section simply doesn't render).
    selectedPly = null;
    showCard = false;
    const p = buildCoachProfile({ puzzleRating: baseline(), probes, gameDimensions, assessedAt: Date.now(), locale: getLocale(), timedDim: timedDim ?? undefined, probeDims: probeDims.length ? probeDims.slice() : undefined });
    // C5: persist the chosen intake goal on the profile (additive; `undefined` when skipped). It both
    // softly weights the program AND lets a re-run pre-select the picker.
    p.goal = goal;
    profile = p;
    // C7/CO10+CO17: load the inputs for the closed loop + opening naming. The eco table + the player's
    // analysed games are read HERE (UI boundary) and handed to the pure cores via $derived. We read
    // ALL analyses (the SAME read Insights' efficacy uses) so the before/after split spans history; a
    // ladders-only run with no games yields [] → no efficacy header (E3). Failures degrade silently:
    // empty table/array → generic reason + no efficacy section (graceful).
    try {
      const [eco, all] = await Promise.all([loadEco(), loadAllAnalyses()]);
      ecoTable = eco;
      coachAnalyses = all;
    } catch {
      ecoTable = [];
      coachAnalyses = [];
    }
    // C5/CO14: ONE descriptive calibration sentence — ONLY when metacog is enabled (opt-in gate) AND
    // there is enough reported data (the readout's own sample floor). Below either ⇒ null = no line
    // (anti-fabrication, AP-CINTAKE-4). Reads the EXISTING attempts/calibration — Insights untouched.
    coachLine = null;
    if (app.settings?.metacogEnabled) {
      try {
        const attempts = (await allAttempts()) as MetacogAttempt[];
        coachLine = metacogCoachLine(calibration(attempts, { locale: getLocale() }), getLocale());
      } catch { /* storage unavailable — simply no coaching line */ }
    }
    if (app.model) {
      // Reload from DB so any weaknessCounters fold written by runAnalysis(source:'played')
      // in finishGame() is preserved — persisting the stale boot snapshot would discard it (I-1).
      const fresh = await loadPlayerModel(Date.now());
      fresh.coachProfilePrev = fresh.coachProfile;
      fresh.coachProfile = p;
      app.model = fresh;
      await app.persistModel(Date.now());
    }
    clearAssessment(); // CF4: the assessment completed — drop the in-memory resume snapshot
    step = 'result';
  }

  /** C7/CO16: the human-readable mastery criterion + cap for a program step, e.g. "4 in a row · ≤8 min".
   *  The cap is always shown (the hard bound, AP-CPROG-3); the criterion part depends on its kind. */
  function masteryBadge(item: ReturnType<typeof buildCoachProgram>[number]): string {
    const cap = t('coach.masteryCap', { min: item.minutes });
    if (!item.mastery) return cap;
    const crit = item.mastery.kind === 'streak'
      ? t('coach.masteryStreak', { n: item.mastery.target })
      : t('coach.masteryMissRate', { pct: Math.round(item.mastery.target * 100) });
    return crit + ' · ' + cap;
  }

  function startCoaching() {
    if (!profile) return;
    // PR-18 (ADR-0076): spread the program across days when asked — split persisted on the
    // profile (additive), day 1 launches now, progress derives from the sessionLog (I8).
    if (spreadDays > 1) {
      const days = splitProgramDays($state.snapshot(programPreview) as PlanItem[], budget, spreadDays);
      if (app.model?.coachProfile && days.length) {
        app.model.coachProfile.programDays = days;
        void app.persistModel(Date.now());
        return startProgramDay(days, 0);
      }
    }
    // C7/CO5: stamp the chosen budget so the launched Session honours it instead of a hardcoded 30
    // (AP-CPROG-1). The program preview already reflects `budget` (it is $derived on it).
    app.activeSession = { plan: buildSession(programPreview), current: 0, startedAt: Date.now(), reflection: '', budgetMin: budget };
    app.go('session');
  }

  /** CF10: export the live coach profile as a JSON snapshot (Q-D=a). Serialises the persisted
   *  CoachProfile VERBATIM (no lossy projection — AP-CFUNNEL-6) via the shared downloadText primitive
   *  (FOLD-C6); filename derived from the profile's assessedAt (pure helper, no Date.now in core).
   *  Reads the live model so the result panel and Settings export the same current profile. Strictly
   *  client-side (AP-CFUNNEL-7) — it's a snapshot, not a printable report or a server share. */
  function exportCoachProfile() {
    const p = app.model?.coachProfile;
    if (!p) return;
    downloadText(JSON.stringify(p, null, 2), coachProfileFilename(p.assessedAt));
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

  <!-- CF4/FOLD-C1: a resumed-assessment banner. When the wizard re-mounted onto a parked assessment
       (navigated away and back), tell the user we resumed and offer to start over. Shown only on the
       in-progress steps (not intro/result). -->
  {#if resumed && step !== 'intro' && step !== 'result'}
    <p class="feedback" style="font-size:0.85rem">
      {t('coach.resumedNote')}
      <button class="link resume-startover" onclick={startOver}>{t('coach.startOver')}</button>
    </p>
  {/if}

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
        <!-- PR-10/F18 (ADR-0068): per-motif sample sizes — the stored `n` finally shown, so a
             thin diagnosis reads as thin (2 puzzles ≠ certainty). -->
        {#if saved.motifs.length}
          <p class="muted" style="font-size:0.75rem">
            {t('coach.sampleSizes')} {saved.motifs.map((m) => `${motifLabelOrRaw(m.theme, getLocale())} ${m.n}`).join(' · ')}
          </p>
        {/if}
        <!-- PR-12 (ADR-0070): targeted re-probe of a WEAK motif — drill it, then re-check just
             that measurement (merges into the profile; a full re-assess stays one click away). -->
        {#if saved.motifs.some((m) => m.delta < 0)}
          <div class="row" style="gap:0.35rem;flex-wrap:wrap;justify-content:center">
            {#each saved.motifs.filter((m) => m.delta < 0) as m (m.theme)}
              <button
                class="ghost"
                style="font-size:0.75rem;padding:0.2rem 0.55rem"
                disabled={app.puzzles.size === 0}
                onclick={() => startReprobe(m.theme)}
              >↻ {t('coach.reprobe', { motif: motifLabelOrRaw(m.theme, getLocale()) })}</button>
            {/each}
          </div>
        {/if}
        {#if reprobeDone}
          <p class="feedback" style="font-size:0.8rem">{reprobeDone}</p>
          {#if reprobeHot}
            <p class="muted" style="font-size:0.75rem">{t('coach.reprobeHot')}</p>
          {/if}
        {/if}
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
          <button style="background:transparent;border:1px solid var(--border)" onclick={startGoals} disabled={app.puzzles.size === 0}>{t('coach.reassess')}</button>
        </div>
        {#if app.puzzles.size === 0}<p class="muted">{t('coach.loadingPuzzles')}</p>{/if}
      </div>
    {:else}
      <p class="muted">{t('coach.intro')}</p>
      {@render scopePicker()}
      <button onclick={startGoals} disabled={app.puzzles.size === 0}>{t('coach.startAssessment')}</button>
      {#if app.puzzles.size === 0}<p class="muted">{t('coach.loadingPuzzles')}</p>{/if}
    {/if}

  {:else if step === 'goals'}
    <!-- C5/CO3 intake: one short, skippable goal that SOFTLY weights the program. Skipping (or picking)
         both proceed to the ladders; the weakness-first plan always leads (AP-CINTAKE-1). -->
    <div class="panel col center" style="gap:0.6rem;width:100%">
      <h3>{t('coach.goalsTitle')}</h3>
      <p class="muted" style="font-size:0.85rem">{t('coach.goalsIntro')}</p>
      <div class="goals col" style="width:100%;gap:0.4rem">
        {#each GOAL_OPTIONS as opt}
          <label class="goal-opt" class:sel={goal === opt.id}>
            <input type="radio" name="coach-goal" value={opt.id} checked={goal === opt.id} onchange={() => (goal = opt.id)} />
            {t(opt.key)}
          </label>
        {/each}
      </div>
      <div class="row center">
        <button onclick={startLadders} disabled={app.puzzles.size === 0}>{t('coach.startAssessment')}</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={() => { goal = undefined; startLadders(); }} disabled={app.puzzles.size === 0}>{t('coach.goalSkip')}</button>
      </div>
      {#if app.puzzles.size === 0}<p class="muted">{t('coach.loadingPuzzles')}</p>{/if}
    </div>

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
      <!-- C4 source choice (§2.3): assess from real recent games (a) — shown only when history exists;
           play a quick game (b, existing); or import more (c). The toy game is one option, not the
           only one. (a) builds dimensions from a recent window via the SAME buildWeaknessProfile. -->
      {#if historyAvailable}
        <div class="row center">
          <button onclick={finishWithHistory}>{t('coach.useMyGames')}</button>
        </div>
        <p class="muted" style="font-size:0.8rem">{t('coach.useMyGamesHint', { n: COACH_ASSESS_WINDOW })}</p>
      {/if}
      <ColorPicker bind:value={coachColorChoice} />
      <div class="row center">
        <button onclick={startGame}>{t('coach.playGame')}</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={() => app.go('import')}>{t('coach.importMore')}</button>
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
      <!-- PR-10/F18 (ADR-0068): per-motif sample sizes on the fresh result too. -->
      {#if profile.motifs.length}
        <p class="muted" style="font-size:0.75rem">
          {t('coach.sampleSizes')} {profile.motifs.map((m) => `${motifLabelOrRaw(m.theme, getLocale())} ${m.n}`).join(' · ')}
        </p>
      {/if}
      <p class="muted" style="font-size:0.8rem">{t('coach.directional', { source: provenanceSource })}</p>
      <!-- CF8/FOLD-C3: when the calibration game's engine failed to boot, say so HONESTLY — the
           profile is puzzles-only, not the result of a deliberate Skip (AP-CFUNNEL-4). -->
      {#if gameFailed}
        <p class="feedback" style="font-size:0.82rem">{t('coach.engineFailedNote')}</p>
      {/if}

      <!-- C6/CO8 + CO9: a DIRECTIONAL prose read (strengths, weaknesses) + the leverage-ranked
           "start here" focus. PURE templated catalogue phrases (narrative.ts) — no grade, no invented
           number (AP-CTEACH-2/3); re-localizes on FR/EN switch via the $derived narrative. -->
      <div class="narrative col" style="width:100%;text-align:left;gap:0.3rem">
        <h4 style="margin:0">{t('coachReview.heading')}</h4>
        {#each narrative as line}<p style="margin:0">{line}</p>{/each}
      </div>
      {#if ranked.length}
        <p class="feedback start-here" style="font-size:0.9rem"><b>{t('dashboard.biggestOpportunity')} </b>{ranked[0].label}</p>
      {/if}

      <div class="row" style="gap:1.5rem;align-items:flex-start">
        <div class="col"><b>{t('coach.strengths')}</b>{#each profile.strengths as s}<span>✔ {s}</span>{:else}<span class="muted">—</span>{/each}</div>
        <div class="col"><b>{t('coach.focusOn')}</b>{#each profile.weaknesses as w}<span>△ {w}</span>{:else}<span class="muted">—</span>{/each}</div>
      </div>

      <!-- C6/CO1: a concept card for the TOP weak motif, behind a toggle. Reuses cardForThemes +
           ConceptCard (ADR-0040; no new content). No card resolved → no toggle (honest). -->
      {#if topCard}
        <button class="link learn-toggle" onclick={() => (showCard = !showCard)}>{t('coachReview.learnPattern')}</button>
        {#if showCard}
          <ConceptCard card={topCard} onClose={() => (showCard = false)} />
        {/if}
      {/if}
      <!-- C5/CO14: ONE descriptive calibration sentence, gated by metacogEnabled + the readout's sample
           floor. If the user's goal is fix-blunders but metacog is OFF, show a gentle enable-hint instead
           of silently dropping the goal's main lever (E2) — never a fabricated line (AP-CINTAKE-4). -->
      {#if coachLine}
        <p class="feedback" style="font-size:0.88rem"><b>{t('coach.metacogTitle')} : </b>{coachLine}</p>
      {:else if goal === 'fix-blunders' && !app.settings?.metacogEnabled}
        <p class="muted" style="font-size:0.82rem">{t('coach.metacogOffHint')}</p>
      {/if}
      <h4 class="row" style="align-items:center;gap:0.5rem">
        {t('coach.yourProgram')}
        <!-- C7/CO5: budget toggle mirroring Insights (insights.min15/30/60 reused). Drives the
             $derived preview AND the launched session (startCoaching stamps budgetMin) — AP-CPROG-1. -->
        <label style="font-size:0.8rem;font-weight:normal" class="muted">
          {t('coach.budgetLabel')}
          <select bind:value={budget} style="margin-left:0.3rem">
            <option value={15}>{t('insights.min15')}</option>
            <option value={30}>{t('insights.min30')}</option>
            <option value={60}>{t('insights.min60')}</option>
          </select>
        </label>
        <!-- PR-18 (ADR-0076): spread the program over days — one budget-sized session per day. -->
        <label style="font-size:0.8rem;font-weight:normal" class="muted">
          {t('coach.spreadLabel')}
          <select bind:value={spreadDays} style="margin-left:0.3rem">
            <option value={1}>{t('coach.spread1')}</option>
            <option value={3}>{t('coach.spreadN', { n: 3 })}</option>
            <option value={5}>{t('coach.spreadN', { n: 5 })}</option>
          </select>
        </label>
      </h4>

      <!-- C7/CO10: the closed loop — DESCRIPTIVE before/after on what you drilled, under the SAME
           honesty caveat as Insights (no causal claim, no verdict — AP-CPROG-4). Rendered only when
           there are measurable steps with analysed games (E3: ladders-only run → no header). The
           per-step numbers appear inline on each step below, joined by mastery.motifKey. -->
      {#if efficacy.length}
        <div class="col" style="width:100%;text-align:left;gap:0.2rem">
          <h5 style="margin:0.25rem 0 0">{t('insights.didItMove')}</h5>
          <p class="muted" style="font-size:0.75rem;margin:0">{t('insights.didItMoveBody')}</p>
        </div>
      {/if}

      <ol style="text-align:left">
        {#each programPreview as item}
          {@const eff = item.mastery?.motifKey ? efficacyByKey.get(item.mastery.motifKey) : undefined}
          <li>
            <b>{labelOrRaw('activity', item.activity, getLocale())}</b>
            {#if item.kind === 'leverage'}<span class="tag tag-leverage">{t('coach.tagLeverage')}</span>{:else if item.kind === 'goal'}<span class="tag tag-goal">{t('coach.tagGoal')}</span>{/if}
            <span class="muted">{t('coach.programItemMeta', { minutes: item.minutes, reason: item.reason })}</span>
            {#if item.mastery}<span class="tag tag-mastery">{masteryBadge(item)}</span>{/if}
            {#if eff}
              <!-- CO10 inline per-step efficacy. Honesty branches (E2/AP-CPROG-5): enoughData → the
                   before/after + soft advisory; neverMeasured → "play some games to see if this moves";
                   thin-but-present → the Insights "too little data" line. Never a fabricated verdict. -->
              <div class="efficacy muted" style="font-size:0.78rem;margin:0.15rem 0 0">
                {#if eff.readout.enoughData}
                  <span>{t('insights.missRate', { early: fmtPct(eff.readout.early.missRate * 100), recent: fmtPct(eff.readout.recent.missRate * 100) })}</span>
                  <span style="color:{eff.readout.deltaPct <= 0 ? 'var(--good)' : 'var(--bad)'}">{t('insights.deltaPts', { sign: eff.readout.deltaPct <= 0 ? '' : '+', pts: Math.round(eff.readout.deltaPct * 100) })}</span>
                  {#if eff.looksImproved}<span class="looks-improved" style="color:var(--good)"> — {t('coach.looksImproved')}</span>{/if}
                {:else if eff.neverMeasured}
                  <span>{t('coach.notMeasuredYet')}</span>
                {:else}
                  <span>{t('insights.tooLittleData')}</span>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ol>
      {#if resultTrend && resultTrend.motifs.length}
        <TrendList trend={resultTrend} />
      {/if}

      <!-- C6/CO13: surface the previously-discarded GameAnalysis — EvalGraph + top turning points +
           per-ply replay via F4's SolutionReveal (consumed, never forked — AP-CTEACH-1). Only when a
           game was actually analysed (gameAnalyzed + held analysis). Player vs opponent swings are
           distinguished so the user is never told they blundered when the opponent did (AP-CTEACH-9). -->
      {#if profile.gameAnalyzed && gameAnalysis}
        <div class="game-review col" style="width:100%;gap:0.4rem">
          <h4 style="margin:0.25rem 0 0">{t('coachReview.gameReviewTitle')}</h4>
          <EvalGraph analysis={gameAnalysis} selected={selectedPly} onSelect={(i) => (selectedPly = i)} />
          <h5 style="margin:0.25rem 0 0">{t('coachReview.turningPoints')}</h5>
          {#if turningPoints.length}
            <ul class="turning-points col" style="list-style:none;padding:0;margin:0;gap:0.3rem;text-align:left">
              {#each turningPoints as m (m.plyIndex)}
                <li>
                  <button
                    class="tp-row {m.side} {selectedPly === m.plyIndex ? 'sel' : ''}"
                    onclick={() => (selectedPly = m.plyIndex)}
                  >
                    {#if m.side === 'player'}
                      {t('coachReview.tpPlayer', { move: m.ply.moveNumber, san: m.ply.san, pct: Math.round(m.winProbLoss) })}
                    {:else}
                      {t('coachReview.tpOpponent', { move: m.ply.moveNumber, san: m.ply.san, pct: Math.round(m.winProbLoss) })}
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="muted" style="font-size:0.85rem">{t('coachReview.noSwings')}</p>
          {/if}

          {#if selectedPly !== null && gameAnalysis.plies[selectedPly]}
            {@const ply = gameAnalysis.plies[selectedPly]}
            <div class="replay col" style="width:100%;gap:0.3rem;border-top:1px solid var(--border);margin-top:0.4rem;padding-top:0.5rem">
              <p class="muted" style="font-size:0.82rem;margin:0"><b>{t('coachReview.replayWhy')}</b></p>
              <SolutionReveal
                fen={ply.fenBefore}
                moves={ply.bestUci ? [ply.bestUci] : []}
                orientation={coachSide === 'w' ? 'white' : 'black'}
                why={explainLine(selectedPly)}
                autoplay
              />
            </div>
          {/if}
        </div>
      {/if}

      <div class="row center">
        <button onclick={startCoaching}>{t('coach.startSession')}</button>
        <!-- CF10: export the current profile as a JSON snapshot (guarded on a persisted profile,
             which always exists on the result screen). Client-side, lossless (AP-CFUNNEL-5/6). -->
        {#if app.model?.coachProfile}
          <button style="background:transparent;border:1px solid var(--border)" onclick={exportCoachProfile}>{t('coach.exportProfile')}</button>
        {/if}
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

  /* C5 intake goal options */
  .goal-opt {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.7rem;
    font-size: 0.92rem;
    cursor: pointer;
  }
  .goal-opt.sel { border-color: var(--accent, #6aa); background: color-mix(in srgb, var(--accent, #6aa) 12%, transparent); }

  /* C5 program-step provenance tags (strength leverage / goal-added) */
  .tag {
    display: inline-block;
    font-size: 0.7rem;
    line-height: 1;
    padding: 0.15rem 0.4rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--muted);
    vertical-align: middle;
  }
  .tag-leverage { border-color: var(--accent, #6aa); color: var(--accent, #6aa); }
  /* C7 mastery criterion + cap badge on a program step (criterion-or-cap, AP-CPROG-2/3). */
  .tag-mastery { font-variant-numeric: tabular-nums; }

  /* CF4/FOLD-C1: "Start over" inline link in the resumed-assessment banner. */
  .resume-startover {
    background: none;
    border: none;
    color: var(--accent, #6aa);
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
    padding: 0 0 0 0.4rem;
  }

  /* C6 coach-output: "Learn the pattern" toggle (mirrors ConceptCard's button.link). */
  .learn-toggle {
    background: none;
    border: none;
    color: var(--accent, #6aa);
    text-decoration: underline;
    cursor: pointer;
    font-size: 0.9rem;
    align-self: flex-start;
  }

  /* C6 turning-point rows: filled = player swing, hollow = opponent (mirrors EvalGraph's side
     semantics) so a swing is never misattributed (AP-CTEACH-9). */
  .tp-row {
    width: 100%;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.35rem 0.6rem;
    font-size: 0.88rem;
    cursor: pointer;
    background: var(--panel-2);
  }
  .tp-row.player { border-left: 3px solid var(--bad, #c55); }
  .tp-row.opponent { border-left: 3px solid var(--border); background: transparent; }
  .tp-row.sel { outline: 2px solid var(--text); outline-offset: 1px; }
</style>
