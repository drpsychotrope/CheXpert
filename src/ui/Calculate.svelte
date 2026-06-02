<script lang="ts">
  // Calculation trainer (spec C / 3a): solve a tactic with NO hints — you must see the
  // whole line before you move. The line is validated against the puzzle's stored
  // solution (gradeCalcLine); a final verdict reports how far you calculated.
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { TacticalTrainer } from '../trainer/TacticalTrainer';
  import { gradeCalcLine } from '../calc/calc';
  import type { Puzzle } from '../trainer/puzzle';
  import { openTrainerDB } from '../store/db';
  import { SELF_TAGS, SELF_TAG_LABELS, type Confidence, type SelfTag } from '../metacog/metacog';

  let puzzle = $state<Puzzle | null>(null);
  let trainer = $state<TacticalTrainer | null>(null);
  let display = $state(new ChessGame());
  let fen = $state('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  let orientation = $state<'white' | 'black'>('white');
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');
  let userMoves: string[] = [];
  const seen = new Set<string>();
  const model = $derived(app.model);

  // Metacognition (ADR-0037): opt-in, skippable, never gates the move flow.
  let confidence = $state<Confidence | undefined>(undefined);
  let selfTag = $state<SelfTag | undefined>(undefined);
  let logged = $state(false); // guard: exactly one attempt per position (AP-META-5)
  let lastAttemptId = $state<string | undefined>(undefined); // id of the most-recently written attempt row
  const metacog = $derived(app.settings?.metacogEnabled ?? false);

  function load() {
    if (!model) return;
    const p =
      app.puzzles.next({ rating: model.puzzleRating.rating, window: 400, exclude: seen, source: 'personal' }) ??
      app.puzzles.next({ rating: model.puzzleRating.rating, window: 300, exclude: seen });
    if (!p) { feedback = 'No puzzles in range.'; return; }
    seen.add(p.id);
    puzzle = p;
    trainer = new TacticalTrainer(p, Date.now());
    display = new ChessGame(p.fen);
    fen = display.fen;
    orientation = display.turn === 'w' ? 'white' : 'black';
    userMoves = [];
    confidence = undefined;
    selfTag = undefined;
    logged = false;
    lastAttemptId = undefined;
    feedback = 'Calculate the whole line in your head, then play it. No hints.';
    feedbackKind = '';
  }

  async function logAttempt(solved: boolean) {
    if (!model || !puzzle || logged) return; // one attempt per position
    logged = true;
    const now = Date.now();
    const ms = trainer ? trainer.elapsedMs(now) : 0;
    const p = $state.snapshot(puzzle); // IndexedDB cannot clone a $state proxy
    const r = model.puzzleRating.rating; // Calculate is not a Glicko writer (rating unchanged)
    const attemptId = `${p.id}:${now}`;
    const db = await openTrainerDB();
    await db.put('puzzleAttempts', {
      id: attemptId,
      puzzleId: p.id,
      solved,
      ms,
      themes: p.themes,
      ratingBefore: r,
      ratingAfter: r,
      playedAt: now,
      source: p.source,
      confidence,
      selfTag: !solved ? selfTag : undefined,
    });
    // Remember the row id so self-tag clicks can UPDATE the same row (not insert a new one).
    if (!solved) lastAttemptId = attemptId;
  }

  /** UPDATE the existing attempt row's selfTag after the chips render post-miss.
   * This is NOT a new insert — it re-puts the same id so AP-META-5 is preserved. */
  async function updateSelfTag(tag: SelfTag) {
    selfTag = selfTag === tag ? undefined : tag;
    if (!lastAttemptId) return;
    const db = await openTrainerDB();
    const row = await db.get('puzzleAttempts', lastAttemptId);
    if (!row) return;
    await db.put('puzzleAttempts', { ...row, selfTag });
  }

  function sideToMove(): 'white' | 'black' {
    return display.turn === 'w' ? 'white' : 'black';
  }

  async function onMove(from: string, to: string) {
    if (!trainer || !puzzle || trainer.state.status !== 'solving') return;
    const uci = from + to + (display.isPromotion(from, to) ? 'q' : '');
    const res = trainer.playUserMove(uci);
    userMoves.push(uci);
    if (res === 'wrong') {
      const g = gradeCalcLine(puzzle.moves, userMoves);
      feedback = `Miss — you calculated ${g.solvedPlies} correct ${g.solvedPlies === 1 ? 'ply' : 'plies'}. Solution: ${puzzle.moves.join(' ')}`;
      feedbackKind = 'bad';
      display = new ChessGame(puzzle.fen);
      fen = display.fen;
      await logAttempt(false);
      return;
    }
    display = new ChessGame(trainer.getFen());
    fen = display.fen;
    if (res === 'solved') {
      const g = gradeCalcLine(puzzle.moves, userMoves);
      feedback = `Calculated the full line (${g.solvedPlies} plies)! ✔`;
      feedbackKind = 'good';
      await logAttempt(true);
    } else {
      feedback = 'Keep going — play the rest of your line.';
      feedbackKind = '';
    }
  }

  $effect(() => {
    if (model && !trainer && app.puzzles.size > 0) load();
  });
</script>

<section class="col center">
  <h2>Calculation</h2>
  <p class="muted" style="max-width:420px;font-size:0.85rem">
    No hints. See the whole forcing line before you touch a piece, then play it out.
  </p>
  {#if metacog && trainer?.state.status === 'solving'}
    <div class="row center metacog" role="group" aria-label="How confident are you?">
      <span class="muted metacog-label">Confidence:</span>
      <button type="button" class="chip {confidence === 'sure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'sure' ? undefined : 'sure')}>Sure</button>
      <button type="button" class="chip {confidence === 'unsure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'unsure' ? undefined : 'unsure')}>Unsure</button>
      <button type="button" class="chip {confidence === 'guess' ? 'on' : ''}" onclick={() => (confidence = confidence === 'guess' ? undefined : 'guess')}>Guess</button>
    </div>
  {/if}

  <div class="board-wrap">
    <Board
      {fen}
      {orientation}
      turnColor={sideToMove()}
      movableColor={trainer?.state.status === 'solving' ? sideToMove() : undefined}
      dests={trainer?.state.status === 'solving' ? display.dests() : new Map()}
      check={display.inCheck()}
      {onMove}
    />
  </div>
  <p class="feedback {feedbackKind}">{feedback}</p>

  {#if metacog && trainer?.state.status === 'failed'}
    <div class="col center metacog" role="group" aria-label="Why did you miss?">
      <span class="muted metacog-label">Why did you miss? (optional)</span>
      <div class="row center" style="flex-wrap:wrap">
        {#each SELF_TAGS as tag}
          <button type="button" class="chip {selfTag === tag ? 'on' : ''}" onclick={() => updateSelfTag(tag)}>{SELF_TAG_LABELS[tag]}</button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="row center">
    <button onclick={load}>Next position →</button>
  </div>
</section>

<style>
  .metacog { gap: 0.4rem; flex-wrap: wrap; margin: 0.3rem 0; }
  .metacog-label { font-size: 0.82rem; align-self: center; }
  .chip { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 999px; padding: 0.15rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
