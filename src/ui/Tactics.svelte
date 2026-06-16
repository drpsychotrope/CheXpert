<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import ConceptCard from './ConceptCard.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { TacticalTrainer, gradeAttempt } from '../trainer/TacticalTrainer';
  import type { Puzzle } from '../trainer/puzzle';
  import { putAttempt, getAttempt, attemptsByPuzzle, recordTacticsAttempt } from '../store/attemptsRepo';
  import { resultToGrade } from '../srs/fsrs';
  import { SELF_TAGS, SELF_TAG_LABELS, type Confidence, type SelfTag } from '../metacog/metacog';
  import { cardForThemes, loadConcepts, type ConceptCard as ConceptCardData } from '../concepts/concepts';
  import { failCountByPuzzle, isLeech } from '../srs/schedule';
  import { t, getLocale } from '../i18n';

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

  // Concept cards (teach-before-test, ADR-0040). Loaded once; [] if the asset is missing
  // (graceful — the link just won't appear). Non-blocking: never gates the next puzzle.
  let cards = $state<ConceptCardData[]>([]);
  let card = $state<ConceptCardData | null>(null);
  let leech = $state(false);
  const LEECH_THRESHOLD = 3; // Q-B

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
    if (!trainer || trainer.state.status !== 'solving') return;
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

    // Selection priority closes the loop: a dashboard drill filter wins; else
    // prefer the player's own personal puzzles (from their real mistakes); else
    // fall back to the curated set in the player's rating zone.
    let p =
      drillThemes && drillThemes.length
        ? await app.puzzles.next({ rating: model.puzzleRating.rating, window: 400, exclude: seen, themes: drillThemes })
        : null;
    if (p) mode = 'themed';

    if (!p) {
      p = await app.puzzles.next({ rating: model.puzzleRating.rating, window: 600, exclude: seen, source: 'personal' });
      if (p) mode = 'personal';
    }
    if (!p) {
      p = await app.puzzles.next({ rating: model.puzzleRating.rating, window: 250, exclude: seen });
      if (p) mode = 'mixed';
    }

    if (!p) {
      feedback = t('tactics.noMore');
      return;
    }
    seen.add(p.id);
    puzzle = p;
    trainer = new TacticalTrainer(p, Date.now());
    display = new ChessGame(p.fen);
    fen = display.fen;
    lastMove = null;
    // Orient the board to the solver's side, fixed for the whole puzzle.
    orientation = display.turn === 'w' ? 'white' : 'black';
    startTimer();
    // Resolve the teaching card for this puzzle's motif (null → no link shown).
    card = cardForThemes(p.themes, cards);
    // Leech = this puzzle has already been failed >= N times (PRIOR attempts only).
    void refreshLeech(p.id);
  }

  function clearDrill() {
    app.tacticsFilterThemes = null;
    app.tacticsTimed = false;
    stopTimer();
    seen.clear();
    trainer = null;
    loadNext();
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
    if (!trainer || !puzzle || trainer.state.status !== 'solving' || locked) return;
    const uci = from + to + (display.isPromotion(from, to) ? promo : '');
    const result = trainer.playUserMove(uci);

    if (result === 'wrong') {
      stopTimer();
      feedback = t('tactics.wrong');
      feedbackKind = 'bad';
      await finish(false);
      // Reset the board to the puzzle's start so Retry is one click away.
      display = new ChessGame(puzzle.fen);
      fen = display.fen;
      lastMove = null;
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

  async function finish(solved: boolean) {
    if (!model || !puzzle || !trainer) return;
    attemptedThisSession += 1;
    if (solved) solvedThisSession += 1;

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
      srs: { kind: 'puzzle', refId: puzzle.id, grade: resultToGrade(solved, ms) },
      now,
    });
    app.puzzles.updateCached(updatedPuzzle);
  }

  /** UPDATE the existing attempt row's selfTag after the chips render post-miss.
   * This is NOT a new insert — it re-puts the same id so AP-META-5 is preserved. */
  async function updateSelfTag(tag: SelfTag) {
    selfTag = selfTag === tag ? undefined : tag;
    if (!lastAttemptId) return;
    const row = await getAttempt(lastAttemptId);
    if (!row) return;
    await putAttempt({ ...row, selfTag });
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
      {t('tactics.drilling', { themes: drillThemes.slice(0, 3).join(', ') })}
      <button class="link" onclick={clearDrill}>{t('tactics.clear')}</button>
    </p>
  {:else if mode === 'personal'}
    <p class="muted" style="font-size:0.85rem">{t('tactics.fromYourGames')}</p>
  {/if}
  {#if timed}
    <p class="feedback {timeLeft <= 5 ? 'bad' : ''}">{t('tactics.beatClock', { n: timeLeft })}
      <button class="link" onclick={clearDrill}>{t('tactics.clear')}</button>
    </p>
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
    </div>
  {/if}

  <div class="row center">
    <button onclick={hint} disabled={trainer?.state.status !== 'solving' || locked}>{t('tactics.hintBtn')}</button>
    <button onclick={retry} disabled={!puzzle}>{t('tactics.retryBtn')}</button>
    <button onclick={loadNext}>{t('tactics.nextBtn')}</button>
  </div>
  {#if puzzle}
    <p class="muted" style="font-size:0.8rem">
      {t('tactics.themes', { themes: puzzle.themes.join(', ') || t('tactics.themesEmpty') })}
      {#if puzzle.source === 'personal'}{t('tactics.fromYourGameTag')}{/if}
    </p>
  {/if}
</section>

<style>
  button.link { background: none; border: none; color: var(--accent); padding: 0 0 0 0.4rem; text-decoration: underline; cursor: pointer; }
  .metacog { gap: 0.4rem; flex-wrap: wrap; margin: 0.3rem 0; }
  .metacog-label { font-size: 0.82rem; align-self: center; }
  .chip { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 999px; padding: 0.15rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
