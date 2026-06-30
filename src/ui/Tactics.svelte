<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import ConceptCard from './ConceptCard.svelte';
  import SolutionReveal from './SolutionReveal.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { TacticalTrainer, gradeAttempt } from '../trainer/TacticalTrainer';
  import { acceptAltMove, type LineEval } from '../trainer/altMove';
  import type { Puzzle } from '../trainer/puzzle';
  import { putAttempt, getAttempt, attemptsByPuzzle, recordTacticsAttempt } from '../store/attemptsRepo';
  import { resultToGrade, clampForConfidence } from '../srs/fsrs';
  import { SELF_TAGS, SELF_TAG_LABELS, type Confidence, type SelfTag } from '../metacog/metacog';
  import { cardForThemes, loadConcepts, missWhy, type ConceptCard as ConceptCardData } from '../concepts/concepts';
  import { failCountByPuzzle, isLeech } from '../srs/schedule';
  import { steerFromWeakness } from '../trainer/weaknessSelect';
  import { provenanceOf, bandToQuery, sourceToQuery, type DifficultyBand, type TrainerSource, type PuzzleProvenance } from '../trainer/provenance';
  import { t, getLocale } from '../i18n';
  import { motifLabelOrRaw } from '../i18n/gen';

  // T2 in-trainer theme picker: the common motif themes, written into the SAME app.tacticsFilterThemes
  // the dashboard drill uses (single source of truth, AP-TPERS-11) and labelled via motifLabelOrRaw.
  const PICKER_THEMES = ['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'backRankMate', 'mateIn1', 'mateIn2'];

  let trainer = $state<TacticalTrainer | null>(null);
  let puzzle = $state<Puzzle | null>(null);
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let display = $state(new ChessGame());
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  // The solver's side, fixed for the whole puzzle (the side to move in the start
  // FEN). The board must NOT flip when the opponent's auto-reply changes turn.
  let orientation = $state<'white' | 'black'>('white');
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');
  let solvedThisSession = $state(0);
  let attemptedThisSession = $state(0);
  let mode = $state<'mixed' | 'personal' | 'themed'>('mixed');
  const seen = new Set<string>();

  // T2/TR9: explicit source toggle (persisted as SettingsRecord.trainerSource?, read `?? 'mixed'`)
  // + a session-only coarse difficulty band (NOT persisted — ephemeral by design, AP-TPERS-7).
  const source = $derived<TrainerSource>(app.settings?.trainerSource ?? 'mixed');
  let band = $state<DifficultyBand>('on-level');
  // T2/TR10: explicit theme-exhaustion state (replaces the silent fall-through). When set, the
  // puzzle area shows the message + Widen / Switch-to-mixed instead of a blank board (AP-TPERS-2/3).
  let exhaustedTheme = $state<string | null>(null);
  let exhaustedWidened = $state(false);
  // T2/TR4: after-solve "missed win" SAN, computed at the call site (ChessGame, not the pure core).
  // Set when a personal puzzle is solved; null → the after-solve line is omitted (AP-TPERS-6).
  let solvedSan = $state<string | null>(null);
  // Pre-solve provenance, derived from the current puzzle's meta (null for curated/legacy → generic tag).
  const prov = $derived<PuzzleProvenance | null>(puzzle ? provenanceOf(puzzle) : null);

  // Concept cards (teach-before-test, ADR-0040). Loaded once; [] if the asset is missing
  // (graceful — the link just won't appear). Non-blocking: never gates the next puzzle.
  let cards = $state<ConceptCardData[]>([]);
  let card = $state<ConceptCardData | null>(null);
  let leech = $state(false);
  const LEECH_THRESHOLD = 3; // Q-B

  // T1 accept-alternate-winning (Q-A). A code-level flag (default ON) — no persisted setting,
  // no schema churn (§2 OUT). Off-line moves the engine confirms are also clearly winning are
  // accepted as a solve; on engine error/timeout we fall through to a miss (AP-TFEED-3).
  const acceptAltWinning = true;
  const ALT_EVAL_MOVETIME_MS = 300; // per-eval budget for the two serialized full-strength evals
  // True while the async alt-check runs, so a second move can't race onto the board.
  let checkingAlt = $state(false);

  // Load (and re-load on language switch): reading getLocale() inside the effect
  // tracks the reactive locale, so flipping FR/EN refetches the matching seed and
  // re-resolves the open card's prose for the current puzzle (geometry unchanged).
  $effect(() => {
    const loc = getLocale();
    loadConcepts(loc).then((c) => {
      cards = c;
      if (puzzle) card = cardForThemes(puzzle.themes, c);
    });
  });

  // Timed mode (the time-management drill): a per-puzzle clock; running out = a miss.
  const PUZZLE_SECONDS = 30;
  let timeLeft = $state(0);
  let locked = $state(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  // Metacognition (ADR-0037): opt-in, skippable, never gates the move flow.
  let confidence = $state<Confidence | undefined>(undefined);
  let selfTag = $state<SelfTag | undefined>(undefined);
  let lastAttemptId = $state<string | undefined>(undefined); // id of the most-recently written attempt row
  const metacog = $derived(app.settings?.metacogEnabled ?? false);

  const model = $derived(app.model);
  // Theme filter handed over by the dashboard's "Drill" buttons (loop closure).
  const drillThemes = $derived(app.tacticsFilterThemes);
  const timed = $derived(app.tacticsTimed === true);

  // First-exposure: this motif's card has NOT been offered before. Keyed off the
  // RESOLVED card motif (card.motif), not raw themes (Q-A / spec §2.3). Independent of leech.
  const firstExposure = $derived(!!card && !(model?.conceptSeen ?? []).includes(card.motif));
  // Show the "Learn the pattern" link on EITHER trigger (both non-blocking).
  const showLearn = $derived(!!card && (firstExposure || leech));

  /** Mark this motif's card as offered at first-exposure (one-shot per motif; persisted). */
  async function markConceptOffered(): Promise<void> {
    if (!model || !card) return;
    const seenList = model.conceptSeen ?? [];
    if (seenList.includes(card.motif)) return;
    model.conceptSeen = [...seenList, card.motif];
    await app.persistModel(Date.now());
  }

  let showCard = $state(false);
  // F4: opt-in "Show solution" on a miss (Q-D / AP-TEACH-4). Reset on every load/retry so
  // it never auto-spoils a Retry; toggled on only when the user taps the button.
  let showSolution = $state(false);

  async function openLearn(): Promise<void> {
    showCard = true;
    await markConceptOffered(); // records first-exposure the moment the card is opened
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
  function startTimer() {
    stopTimer();
    locked = false;
    if (!timed) return;
    timeLeft = PUZZLE_SECONDS;
    timer = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        stopTimer();
        void onTimeout();
      }
    }, 1000);
  }
  async function onTimeout() {
    // Don't race a confirmed-miss into an in-flight alt-accept eval (which may resolve to a solve).
    if (!trainer || trainer.state.status !== 'solving' || checkingAlt) return;
    locked = true;
    feedback = t('tactics.timeMiss');
    feedbackKind = 'bad';
    await finish(false);
  }
  onDestroy(stopTimer);

  async function loadNext() {
    if (!model) return;
    feedback = '';
    feedbackKind = '';
    confidence = undefined;
    selfTag = undefined;
    lastAttemptId = undefined;
    showCard = false;
    showSolution = false;
    showTimedOffer = false;
    checkingAlt = false;
    exhaustedTheme = null;
    exhaustedWidened = false;
    solvedSan = null;

    // The coarse difficulty band (T2/TR9) → (rating, window) for the curated/mixed paths. on-level
    // is byte-identical to baseline (window 250). Personal stays wide (TR4 — show your puzzles).
    const bq = bandToQuery(band, model.puzzleRating.rating);

    // Selection priority closes the loop: an active theme (dashboard drill OR the in-trainer theme
    // picker — both write app.tacticsFilterThemes, AP-TPERS-11) wins; else honor the explicit source
    // toggle (T2/TR9); else (no toggle / mixed) prefer personal, then F3-steered curated, then plain
    // curated. A themed query that yields null in-zone is NOT a silent fall-through — it sets the
    // explicit exhaustion state (TR10 / AP-TPERS-2).
    let p: Awaited<ReturnType<typeof app.puzzles.next>> = null;
    if (drillThemes && drillThemes.length) {
      const theme = drillThemes[0];
      p = await app.puzzles.next({ rating: model.puzzleRating.rating, window: 400, exclude: seen, themes: drillThemes });
      if (p) {
        mode = 'themed';
      } else {
        // Honest exhaustion (Q-D=c): explicit message + widen/switch, never a silent mode flip.
        exhaustedTheme = theme;
        return;
      }
    } else if (source === 'curated') {
      // Map the toggle to PuzzleQuery.source through the tested pure helper (single source of truth).
      p = await app.puzzles.next({ ...bq, exclude: seen, source: sourceToQuery(source) });
      if (p) mode = 'mixed';
    } else if (source === 'personal') {
      // Keep the personal window wide (TR4) so the player's own puzzles surface regardless of band.
      p = await app.puzzles.next({ rating: model.puzzleRating.rating, window: 600, exclude: seen, source: sourceToQuery(source) });
      if (p) mode = 'personal';
    } else {
      // Mixed (today's default behaviour): prefer the player's own personal puzzles; else
      // (F3 / TR2, ADR-0055) softly bias the curated zone toward the top weakness theme; else
      // fall back to the plain curated set in the rating zone.
      p = await app.puzzles.next({ rating: model.puzzleRating.rating, window: 600, exclude: seen, source: 'personal' });
      if (p) mode = 'personal';
      // Weakness-steered curated (soft bias, Q-B/Q-D): only when no explicit drill filter is active.
      // steerFromWeakness returns undefined themes when there's no signal → we skip straight to plain
      // curated, so behaviour is byte-identical to baseline for a fresh/empty model. A biased next()
      // returning null also falls through (AP-ATTEMPT-2/3 — never dead-end the loop).
      if (!p) {
        const steer = steerFromWeakness(model.weaknessCounters);
        if (steer.themes) {
          p = await app.puzzles.next({ ...bq, exclude: seen, themes: steer.themes });
          if (p) mode = 'mixed';
        }
      }
      if (!p) {
        p = await app.puzzles.next({ ...bq, exclude: seen });
        if (p) mode = 'mixed';
      }
    }

    if (!p) {
      feedback = t('tactics.noMore');
      return;
    }
    seen.add(p.id);
    // Adopt the puzzle (board/trainer/orientation/timer/card/leech) — shared with widenTheme.
    adoptPuzzle(p);
  }

  function clearDrill() {
    app.tacticsFilterThemes = null;
    app.tacticsTimed = false;
    stopTimer();
    seen.clear();
    trainer = null;
    loadNext();
  }

  /** T2/TR9: change the persisted source toggle, then reload so it takes effect immediately. The
   *  default is always 'mixed' — we never seed a value that buries personal puzzles (AP-TPERS-12). */
  async function setSource(s: TrainerSource) {
    if (!app.settings) return;
    app.settings.trainerSource = s;
    await app.persistSettings();
    seen.clear();
    void loadNext();
  }

  /** T2/TR9: change the session-only coarse difficulty band (not persisted), then reload. */
  function setBand(b: DifficultyBand) {
    band = b;
    seen.clear();
    void loadNext();
  }

  /** T2/TR9 theme picker: write the SAME app.tacticsFilterThemes the dashboard drill uses (single
   *  source of truth, AP-TPERS-11). null/'all' clears the theme back to the toggle's source. */
  function pickTheme(theme: string | null) {
    app.tacticsFilterThemes = theme ? [theme] : null;
    stopTimer();
    seen.clear();
    trainer = null;
    void loadNext();
  }

  /** T2/TR10 exhaustion action — Widen range: re-query the SAME theme at a larger window (400→800).
   *  If that still yields null, escalate to the "even widened, none left — switch?" message instead
   *  of silently dead-ending (AP-TPERS-3). */
  async function widenTheme() {
    if (!model || !exhaustedTheme) return;
    const theme = exhaustedTheme;
    const p = await app.puzzles.next({ rating: model.puzzleRating.rating, window: 800, exclude: seen, themes: [theme] });
    if (p) {
      exhaustedTheme = null;
      exhaustedWidened = false;
      mode = 'themed';
      seen.add(p.id);
      adoptPuzzle(p);
    } else {
      exhaustedWidened = true; // escalate the message; offer Switch-to-mixed
    }
  }

  /** T2/TR10 exhaustion action — Switch to mixed: clear the theme AND set the source to mixed, then
   *  reload. The honest non-dead-end exit from a drained theme (Q-D=c). */
  async function switchToMixed() {
    app.tacticsFilterThemes = null;
    app.tacticsTimed = false;
    exhaustedTheme = null;
    exhaustedWidened = false;
    if (app.settings && app.settings.trainerSource !== 'mixed') {
      app.settings.trainerSource = 'mixed';
      await app.persistSettings();
    }
    stopTimer();
    seen.clear();
    trainer = null;
    void loadNext();
  }

  /** Adopt a freshly-selected puzzle into the board/trainer (shared by loadNext + widenTheme). */
  function adoptPuzzle(p: Puzzle) {
    puzzle = p;
    trainer = new TacticalTrainer(p, Date.now());
    display = new ChessGame(p.fen);
    fen = display.fen;
    lastMove = null;
    orientation = display.turn === 'w' ? 'white' : 'black';
    startTimer();
    card = cardForThemes(p.themes, cards);
    void refreshLeech(p.id);
  }

  /** Recompute the leech flag for `puzzleId` from stored attempts (prior failures only). */
  async function refreshLeech(puzzleId: string): Promise<void> {
    leech = false;
    try {
      const prior = await attemptsByPuzzle(puzzleId);
      const fails = failCountByPuzzle(prior).get(puzzleId) ?? 0;
      leech = isLeech(fails, LEECH_THRESHOLD);
    } catch {
      leech = false; // never block the loop on a count failure
    }
  }

  function sideToMove(): 'white' | 'black' {
    return display.turn === 'w' ? 'white' : 'black';
  }

  async function onMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!trainer || !puzzle || trainer.state.status !== 'solving' || locked || checkingAlt) return;
    const fenBefore = display.fen; // position BEFORE the move, for the alt-move engine check
    const uci = from + to + (display.isPromotion(from, to) ? promo : '');
    const result = trainer.playUserMove(uci);

    if (result === 'retry') {
      // T1/TR6: one on-board second try. Leave the wrong move visible (do NOT reset to puzzle.fen)
      // and stay solving; the miss is already recorded in the trainer (AP-TFEED-2). The next move
      // resumes the normal flow. Timed mode keeps running — the clock is the drill.
      display = new ChessGame(fenBefore);
      display.moveUci(uci);
      fen = display.fen;
      lastMove = [from, to];
      feedback = t('tactics.secondTry');
      feedbackKind = 'bad';
      return;
    }

    if (result === 'wrong') {
      // T1 accept-alternate-winning (Q-A): before committing the miss, ask the engine whether the
      // off-line move is itself a clear win. Honest fall-through: reject / illegal / error / timeout
      // → the normal miss path (never hang — AP-TFEED-3).
      if (acceptAltWinning && (await tryAcceptAlt(fenBefore, uci, from, to))) return;
      await commitMiss();
      return;
    }

    // Correct: sync the display board to the trainer's internal position
    // (which already applied the user move + any auto opponent reply).
    display = new ChessGame(trainer.getFen());
    fen = display.fen;
    lastMove = [from, to];

    if (result === 'solved') {
      stopTimer();
      feedback = t('tactics.solved');
      feedbackKind = 'good';
      await finish(true);
    } else {
      feedback = t('tactics.keepGoing');
      feedbackKind = 'good';
    }
  }

  /** Commit a confirmed miss: feedback, grade as a fail, reset the board for a one-click Retry. */
  async function commitMiss() {
    if (!trainer || !puzzle) return;
    stopTimer();
    feedback = t('tactics.wrong');
    feedbackKind = 'bad';
    await finish(false);
    // Reset the board to the puzzle's start so Retry is one click away.
    display = new ChessGame(puzzle.fen);
    fen = display.fen;
    lastMove = null;
  }

  /**
   * Accept-alternate-winning engine check (Q-A). Returns true iff the off-line `uci` was
   * accepted as a solve (and drove the trainer forward); false to fall through to the miss path.
   * Two FULL-STRENGTH evals run back-to-back (the engine is serialized): the mainline best for the
   * position before the move, and the eval of the position after the move. Any null move / engine
   * error → false (honest default = miss; AP-TFEED-3/6).
   */
  async function tryAcceptAlt(fenBefore: string, uci: string, from: string, to: string): Promise<boolean> {
    if (!trainer || !puzzle) return false;
    const solver = orientation; // the solver's side, fixed for the puzzle
    checkingAlt = true;
    const prevFeedback = feedback;
    feedback = t('tactics.checkingAlt');
    feedbackKind = '';
    try {
      // The resulting position after the played move (opponent to move). Clone first.
      const after = new ChessGame(fenBefore);
      if (after.moveUci(uci) == null) return false;

      // best line for the position BEFORE the move (multipv 1, White-POV), then the played-move eval.
      const best = (await app.engine.analyzeLines(fenBefore, { multipv: 1, movetime: ALT_EVAL_MOVETIME_MS, fullStrength: true }))[0];
      if (!best) return false;
      const played = await app.engine.evaluate(after.fen, { movetime: ALT_EVAL_MOVETIME_MS, fullStrength: true });

      const bestLine: LineEval = { uci: best.uci, whiteCp: best.whiteCp, mate: best.mate };
      // EvalResult exposes the raw mover-POV score; its `.score.mate` is the after-position mate.
      const playedLine: LineEval = { uci, whiteCp: played.whiteCp, mate: played.score.mate };

      if (!acceptAltMove(solver, bestLine, playedLine)) return false;

      const r = trainer.acceptUserMove(uci);
      if (r === 'wrong') return false; // defensive: illegal in current position → miss path

      stopTimer();
      display = new ChessGame(trainer.getFen());
      fen = display.fen;
      lastMove = [from, to];
      if (r === 'solved') {
        feedback = t('tactics.altAccepted');
        feedbackKind = 'good';
        await finish(true); // records a genuine solve (Q-H)
      } else {
        feedback = t('tactics.altAccepted');
        feedbackKind = 'good';
      }
      return true;
    } catch {
      feedback = prevFeedback; // engine failure: restore and let the caller commit the miss
      return false;
    } finally {
      checkingAlt = false;
    }
  }

  async function finish(solved: boolean) {
    if (!model || !puzzle || !trainer) return;
    attemptedThisSession += 1;
    if (solved) solvedThisSession += 1;

    // T2/TR4 after-solve "the win you left": render the puzzle's solution move (moves[0], a UCI) as
    // SAN via the EXISTING ChessGame.moveUci on a fresh board from the puzzle's start FEN (enrich E1).
    // Personal puzzles with provenance only; on null (illegal/unparseable) the line is omitted, not
    // crashed (AP-TPERS-6). The pure formatter never parses FEN/UCI — we compute SAN here, at the call site.
    if (solved && prov && puzzle.source === 'personal') {
      const first = puzzle.moves[0];
      solvedSan = first ? new ChessGame(puzzle.fen).moveUci(first) : null;
    }

    const graded = gradeAttempt(model.puzzleRating, puzzle, solved);
    model.puzzleRating = graded.player;

    // Track a nascent weakness counter when failing (Phase 2 builds on this).
    if (!solved) {
      for (const t of puzzle.themes) {
        model.weaknessCounters[t] = (model.weaknessCounters[t] ?? 0) + 1;
      }
    }

    const now = Date.now();
    const ms = trainer.elapsedMs(now);
    // IndexedDB cannot structured-clone a Svelte 5 $state proxy ("could not be cloned"),
    // and `puzzle` is $state — its proxied arrays (themes/moves/meta) make these db.put()s
    // throw, silently aborting finish() so NOTHING persists (no attempt, no SRS card → empty
    // Review, no "misses"). Snapshot to a plain, cloneable object first (cf. woodpecker.saveSet).
    const p = $state.snapshot(puzzle);
    const attemptId = `${p.id}:${now}`;
    // Remember the row id so self-tag clicks can UPDATE the same row (not insert a new one).
    if (!solved) lastAttemptId = attemptId;
    const updatedPuzzle = { ...p, rating: Math.round(graded.puzzle.rating), ratingDeviation: Math.round(graded.puzzle.rd) };
    // One atomic transaction (audit W11): attempt log + puzzle rating + FSRS card + player model —
    // a mid-write failure can no longer leave an attempt with no SRS card (a puzzle missing from Review).
    await recordTacticsAttempt({
      attempt: {
        id: attemptId,
        puzzleId: p.id,
        solved,
        ms,
        themes: p.themes,
        ratingBefore: graded.player.rating,
        ratingAfter: model.puzzleRating.rating,
        playedAt: now,
        source: p.source,
        // metacognition: whichever were set (undefined drops cleanly on structured clone).
        confidence,
        selfTag: !solved ? selfTag : undefined,
      },
      puzzle: updatedPuzzle,
      model: $state.snapshot(model),
      // T1/TR3 (Q-E): a low-confidence (guess/unsure) SOLVE is clamped to ≤ Good so a self-flagged
      // lucky solve doesn't earn a long interval. No-op on a miss (Again floor) / high confidence.
      srs: { kind: 'puzzle', refId: puzzle.id, grade: clampForConfidence(resultToGrade(solved, ms), confidence) },
      now,
    });
    app.puzzles.updateCached(updatedPuzzle);
  }

  /** UPDATE the existing attempt row's selfTag after the chips render post-miss.
   * This is NOT a new insert — it re-puts the same id so AP-META-5 is preserved. */
  async function updateSelfTag(tag: SelfTag) {
    selfTag = selfTag === tag ? undefined : tag;
    reactToSelfTag(); // T1/TR3 (Q-C): react to the just-set tag (Tactics-only; metacog-gated)
    if (!lastAttemptId) return;
    const row = await getAttempt(lastAttemptId);
    if (!row) return;
    await putAttempt({ ...row, selfTag });
  }

  // T1/TR3 reactions (Q-C). One-tap offers/hints, never verdicts (AP-TFEED-3/7). They attach
  // ONLY to Tactics' existing chips and only when metacog is on; no reaction is invented for tags
  // without a clean single action (miscalculated / wrong-plan / missed-opponent-resource / other).
  let showTimedOffer = $state(false);

  /** Surface the matching reaction for the current self-tag (re-evaluated on each toggle). */
  function reactToSelfTag() {
    showTimedOffer = false;
    if (!metacog) return;
    if (selfTag === 'unfamiliar-pattern') {
      // Surface the motif's concept card prominently (reuse openLearn → ConceptCard; AP-TFEED-1/5).
      // showLearn already drives the "Learn the pattern" link; openLearn also marks first-exposure.
      if (card) void openLearn();
    } else if (selfTag === 'rushed') {
      // Offer timed mode (reuse the existing app.tacticsTimed mechanism; FOLD-5).
      showTimedOffer = true;
    }
  }

  /** TR3 `rushed` reaction: switch to the existing timed drill and load a fresh puzzle. */
  function tryTimed() {
    app.tacticsTimed = true;
    showTimedOffer = false;
    seen.clear();
    void loadNext();
  }

  // Load the first puzzle once the model is ready.
  $effect(() => {
    if (model && !trainer && app.puzzles.size > 0) loadNext();
  });

  function hint() {
    if (trainer) {
      const m = trainer.expectedMove();
      if (m) {
        feedback = t('tactics.hint', { sq: m.slice(0, 2) });
        feedbackKind = '';
      }
    }
  }

  /** Re-attempt the SAME puzzle from the start (after a miss). Already graded, so
   * this does not re-score — it's pure practice of the position. */
  function retry() {
    if (!puzzle) return;
    trainer = new TacticalTrainer(puzzle, Date.now());
    display = new ChessGame(puzzle.fen);
    fen = display.fen;
    lastMove = null;
    feedback = t('tactics.retryFind');
    feedbackKind = '';
    confidence = undefined;
    selfTag = undefined;
    lastAttemptId = undefined;
    showSolution = false; // AP-TEACH-4: a fresh Retry must not show the answer
    showTimedOffer = false;
    checkingAlt = false;
    startTimer();
  }
</script>

<section class="col center">
  <h2>{t('tactics.title')}</h2>
  {#if model}
    <p class="muted">
      {t('tactics.ratingLine', { rating: Math.round(model.puzzleRating.rating), rd: Math.round(model.puzzleRating.rd), solved: solvedThisSession, attempted: attemptedThisSession })}
    </p>
  {/if}
  {#if drillThemes && drillThemes.length}
    <p class="feedback">
      {t('tactics.drilling', { themes: drillThemes.map((th) => motifLabelOrRaw(th, getLocale())).slice(0, 3).join(', ') })}
      <button class="link" onclick={clearDrill}>{t('tactics.clear')}</button>
    </p>
  {:else}
    <!-- T2/TR9: source toggle + theme + difficulty in ONE compact control row. Shown only in the
         no-drill state (E9) — a dashboard drill already fixes the theme, so we don't crowd the board.
         Theme writes the SAME app.tacticsFilterThemes the drill uses (AP-TPERS-11). -->
    <div class="row center controls" style="gap:0.6rem;flex-wrap:wrap">
      <span class="muted ctl-label">{t('tactics.sourceLabel')}</span>
      <div class="seg" role="group" aria-label={t('tactics.sourceLabel')}>
        <button type="button" class="chip {source === 'mixed' ? 'on' : ''}" onclick={() => setSource('mixed')}>{t('tactics.sourceMixed')}</button>
        <button type="button" class="chip {source === 'personal' ? 'on' : ''}" onclick={() => setSource('personal')}>{t('tactics.sourcePersonal')}</button>
        <button type="button" class="chip {source === 'curated' ? 'on' : ''}" onclick={() => setSource('curated')}>{t('tactics.sourceCurated')}</button>
      </div>

      <label class="muted ctl-label">
        {t('tactics.themePickerLabel')}
        <select value="" onchange={(e) => pickTheme(e.currentTarget.value || null)}>
          <option value="">{t('tactics.themeAll')}</option>
          {#each PICKER_THEMES as th (th)}
            <option value={th}>{motifLabelOrRaw(th, getLocale())}</option>
          {/each}
        </select>
      </label>

      <span class="muted ctl-label">{t('tactics.diffLabel')}</span>
      <div class="seg" role="group" aria-label={t('tactics.diffLabel')}>
        <button type="button" class="chip {band === 'easier' ? 'on' : ''}" onclick={() => setBand('easier')}>{t('tactics.diffEasier')}</button>
        <button type="button" class="chip {band === 'on-level' ? 'on' : ''}" onclick={() => setBand('on-level')}>{t('tactics.diffOnLevel')}</button>
        <button type="button" class="chip {band === 'harder' ? 'on' : ''}" onclick={() => setBand('harder')}>{t('tactics.diffHarder')}</button>
      </div>
    </div>
    {#if mode === 'personal' && !prov}
      <p class="muted" style="font-size:0.85rem">{t('tactics.fromYourGames')}</p>
    {/if}
  {/if}
  {#if timed}
    <p class="feedback {timeLeft <= 5 ? 'bad' : ''}">{t('tactics.beatClock', { n: timeLeft })}
      <button class="link" onclick={clearDrill}>{t('tactics.clear')}</button>
    </p>
  {/if}

  <!-- T2/TR4 pre-solve provenance (Q-A=b): for a personal puzzle while solving, tell the player which
       move they played + how bad (severity via the closed sev.* namespace), replacing the generic
       star. AP-TPERS-1. (sev.* not severity.* — see i18n/messages/severity.ts for the prefix note.) -->
  {#if prov && trainer?.state.status === 'solving'}
    <p class="feedback">
      {t('tactics.provenancePre', { move: prov.moveNumber, played: prov.playedMove, severity: t('sev.' + prov.severity) })}
    </p>
  {/if}

  <!-- T2/TR10 honest theme exhaustion (Q-D=c): explicit message + Widen / Switch-to-mixed instead of
       a silent fall-through to personal/curated. Never a blank board (AP-TPERS-2/3). -->
  {#if exhaustedTheme}
    <div class="col center" style="gap:0.4rem">
      <p class="feedback bad">
        {exhaustedWidened
          ? t('tactics.themeExhaustedWidened', { theme: motifLabelOrRaw(exhaustedTheme, getLocale()) })
          : t('tactics.themeExhausted', { theme: motifLabelOrRaw(exhaustedTheme, getLocale()) })}
      </p>
      <div class="row center">
        {#if !exhaustedWidened}
          <button onclick={widenTheme}>{t('tactics.widenRange')}</button>
        {/if}
        <button onclick={switchToMixed}>{t('tactics.switchToMixed')}</button>
      </div>
    </div>
  {/if}

  {#if metacog && trainer?.state.status === 'solving'}
    <div class="row center metacog" role="group" aria-label={t('tactics.confidenceGroup')}>
      <span class="muted metacog-label">{t('tactics.confidence')}</span>
      <button type="button" class="chip {confidence === 'sure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'sure' ? undefined : 'sure')}>{t('tactics.sure')}</button>
      <button type="button" class="chip {confidence === 'unsure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'unsure' ? undefined : 'unsure')}>{t('tactics.unsure')}</button>
      <button type="button" class="chip {confidence === 'guess' ? 'on' : ''}" onclick={() => (confidence = confidence === 'guess' ? undefined : 'guess')}>{t('tactics.guess')}</button>
    </div>
  {/if}

  <div class="board-wrap">
    <Board
      {fen}
      {orientation}
      turnColor={sideToMove()}
      showTurn={trainer?.state.status === 'solving'}
      turnLabel="play"
      movableColor={!locked && trainer?.state.status === 'solving' ? sideToMove() : undefined}
      dests={!locked && trainer?.state.status === 'solving' ? display.dests() : new Map()}
      {lastMove}
      check={display.inCheck()}
      {onMove}
      onMoveText={(t) => {
        if (locked || !trainer || !puzzle || trainer.state.status !== 'solving') return false;
        const r = display.resolveMove(t);
        if (!r) return false;
        void onMove(r.from, r.to, r.promo ?? 'q');
        return true;
      }}
    />
  </div>

  <p class="feedback {feedbackKind}">{feedback}</p>

  <!-- T2/TR4 after-solve provenance (Q-A=b): once a personal puzzle is solved, name what you left.
       SAN computed at the call site (finish, via ChessGame.moveUci); on null it's omitted (E1/AP-TPERS-6).
       'missed-win' → "the win you left"; 'mistake' → "the move you missed" (branch on prov.kind). -->
  {#if prov && solvedSan && trainer?.state.status === 'solved'}
    <p class="feedback good">
      {prov.kind === 'missed-win'
        ? t('tactics.provenancePostWin', { san: solvedSan })
        : t('tactics.provenancePostMove', { san: solvedSan })}
    </p>
  {/if}

  {#if trainer?.state.status === 'failed' && puzzle}
    <!-- F4: opt-in "Show solution" on a miss (Q-D). Non-blocking & Retry-safe (AP-TEACH-4):
         the board reset + Retry above stay; this only animates the line when tapped, with a
         theme-derived pattern hint (missWhy — null when no high-confidence motif; AP-TEACH-2). -->
    <button class="link" onclick={() => (showSolution = !showSolution)}>
      {showSolution ? t('reveal.hideSolution') : t('reveal.showSolution')}
    </button>
    {#if showSolution}
      <SolutionReveal
        fen={puzzle.fen}
        moves={puzzle.moves}
        {orientation}
        why={missWhy(puzzle.themes, getLocale())}
        autoplay
      />
    {/if}
  {/if}

  {#if showLearn && card}
    <p class="feedback">
      {#if leech}{t('tactics.leech')}{/if}
      <button class="link" onclick={openLearn}>{t('tactics.learnPattern')}</button>
      <button class="link" onclick={() => { app.conceptFocusMotif = card!.motif; app.go('concepts'); }}>{t('tactics.openInLibrary')}</button>
    </p>
  {/if}

  {#if showCard && card}
    <ConceptCard {card} onClose={() => (showCard = false)} />
  {/if}

  {#if metacog && trainer?.state.status === 'failed'}
    <div class="col center metacog" role="group" aria-label={t('tactics.whyMissGroup')}>
      <span class="muted metacog-label">{t('tactics.whyMiss')}</span>
      <div class="row center" style="flex-wrap:wrap">
        {#each SELF_TAGS as tag}
          <button type="button" class="chip {selfTag === tag ? 'on' : ''}" onclick={() => updateSelfTag(tag)}>{SELF_TAG_LABELS[tag]}</button>
        {/each}
      </div>
      <!-- TR3 (Q-C): `rushed` → one-tap offer of timed mode (reuses app.tacticsTimed; FOLD-5).
           An offer, not a verdict (AP-TFEED-3/7). `unfamiliar-pattern` opens the concept card
           via reactToSelfTag()/openLearn; the "Learn the pattern" affordance below also covers it. -->
      {#if showTimedOffer && !timed}
        <p class="feedback">
          {t('tactics.offerTimed')}
          <button class="link" onclick={tryTimed}>{t('tactics.tryTimed')}</button>
        </p>
      {/if}
    </div>
  {/if}

  <div class="row center">
    <button onclick={hint} disabled={trainer?.state.status !== 'solving' || locked}>{t('tactics.hintBtn')}</button>
    <button onclick={retry} disabled={!puzzle}>{t('tactics.retryBtn')}</button>
    <button onclick={loadNext}>{t('tactics.nextBtn')}</button>
  </div>
  {#if puzzle}
    <p class="muted" style="font-size:0.8rem">
      {t('tactics.themes', { themes: puzzle.themes.map((th) => motifLabelOrRaw(th, getLocale())).join(', ') || t('tactics.themesEmpty') })}
      <!-- AP-TPERS-1: the generic tag is ONLY for the null-provenance case (curated, or a legacy
           personal puzzle without full meta). When prov is present, the pre/post lines carry it. -->
      {#if puzzle.source === 'personal' && !prov}{t('tactics.fromYourGameTag')}{/if}
    </p>
  {/if}
</section>

<style>
  button.link { background: none; border: none; color: var(--accent); padding: 0 0 0 0.4rem; text-decoration: underline; cursor: pointer; }
  .metacog { gap: 0.4rem; flex-wrap: wrap; margin: 0.3rem 0; }
  .metacog-label { font-size: 0.82rem; align-self: center; }
  .chip { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 999px; padding: 0.15rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  /* T2 control row: source toggle + theme + difficulty in one compact line (E9). */
  .controls { margin: 0.3rem 0; }
  .ctl-label { font-size: 0.82rem; align-self: center; }
  .seg { display: inline-flex; gap: 0.25rem; }
</style>
