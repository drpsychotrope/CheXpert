<script lang="ts">
  // Calculation trainer (read-only line entry — ADR-0044, AP-CHESS-54/55). The board is FROZEN at the
  // start position; the user taps their FULL forcing line (arrows + a "My line" list), then Submit grades
  // the whole line via gradeCalcLine and animates the real solution. No board feedback during input.
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import SolutionReveal from './SolutionReveal.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { gradeCalcLine, firstWrongUserMove } from '../calc/calc';
  import type { Puzzle } from '../trainer/puzzle';
  import { putAttempt, getAttempt } from '../store/attemptsRepo';
  import { SELF_TAGS, type Confidence, type SelfTag } from '../metacog/metacog';
  import { t, tn } from '../i18n';

  let puzzle = $state<Puzzle | null>(null);
  let display = $state(new ChessGame());
  let fen = $state('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  let orientation = $state<'white' | 'black'>('white');
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');

  // Read-only line-entry state.
  let phase = $state<'input' | 'revealed'>('input');
  let userMoves = $state<string[]>([]);            // UCI, user turns only
  let arrows = $state<Array<[string, string]>>([]); // one per committed user move
  let pendingFrom = $state<string | null>(null);
  let solved = $state(false);
  let startedAt = 0;

  const seen = new Set<string>();
  const model = $derived(app.model);

  // Metacognition (ADR-0037): opt-in, skippable, never gates the flow.
  let confidence = $state<Confidence | undefined>(undefined);
  let selfTag = $state<SelfTag | undefined>(undefined);
  let logged = $state(false);                       // AP-META-5: one attempt per position
  let lastAttemptId = $state<string | undefined>(undefined);
  const metacog = $derived(app.settings?.metacogEnabled ?? false);

  async function load() {
    if (!model) return;
    const p =
      (await app.puzzles.next({ rating: model.puzzleRating.rating, window: 400, exclude: seen, source: 'personal' })) ??
      (await app.puzzles.next({ rating: model.puzzleRating.rating, window: 300, exclude: seen }));
    if (!p) { feedback = t('calc.noPuzzles'); return; }
    seen.add(p.id);
    puzzle = p;
    display = new ChessGame(p.fen);
    fen = display.fen;
    orientation = display.turn === 'w' ? 'white' : 'black';
    phase = 'input';
    userMoves = [];
    arrows = [];
    pendingFrom = null;
    solved = false;
    startedAt = Date.now();
    confidence = undefined;
    selfTag = undefined;
    logged = false;
    lastAttemptId = undefined;
    feedback = '';
    feedbackKind = '';
  }

  async function logAttempt(didSolve: boolean) {
    if (!model || !puzzle || logged) return; // one attempt per position
    logged = true;
    const now = Date.now();
    const ms = now - startedAt;
    const p = $state.snapshot(puzzle); // IndexedDB cannot clone a $state proxy
    const r = model.puzzleRating.rating; // Calculate is not a Glicko writer (rating unchanged)
    const attemptId = `${p.id}:${now}`;
    await putAttempt({
      id: attemptId,
      puzzleId: p.id,
      solved: didSolve,
      ms,
      themes: p.themes,
      ratingBefore: r,
      ratingAfter: r,
      playedAt: now,
      source: p.source,
      confidence,
      selfTag: !didSolve ? selfTag : undefined,
    });
    if (!didSolve) lastAttemptId = attemptId;
  }

  /** UPDATE the existing attempt row's selfTag (re-puts the same id — AP-META-5 preserved). */
  async function updateSelfTag(tag: SelfTag) {
    selfTag = selfTag === tag ? undefined : tag;
    if (!lastAttemptId) return;
    const row = await getAttempt(lastAttemptId);
    if (!row) return;
    await putAttempt({ ...row, selfTag });
  }

  function fmtUci(uci: string): string {
    return `${uci.slice(0, 2)}→${uci.slice(2, 4)}`;
  }

  function sideToMove(): 'white' | 'black' {
    return display.turn === 'w' ? 'white' : 'black';
  }

  // Two taps = one user move. The board never applies it; we only record UCI + an arrow.
  function onSelect(sq: string) {
    if (phase !== 'input') return;
    if (pendingFrom == null) { pendingFrom = sq; return; }   // pick from-square (chessground highlights it)
    if (sq === pendingFrom) { pendingFrom = null; return; }  // tap again to cancel
    userMoves = [...userMoves, pendingFrom + sq];
    arrows = [...arrows, [pendingFrom, sq]];
    pendingFrom = null;
  }

  function undo() {
    if (!userMoves.length) return;
    userMoves = userMoves.slice(0, -1);
    arrows = arrows.slice(0, -1);
    pendingFrom = null;
  }

  async function submit() {
    if (!puzzle || phase !== 'input' || userMoves.length === 0) return;
    pendingFrom = null;
    const g = gradeCalcLine(puzzle.moves, userMoves);
    solved = g.correct;
    if (g.correct) {
      feedback = tn(userMoves.length, 'calc.fullLineOne', 'calc.fullLineMany');
      feedbackKind = 'good';
    } else {
      const k = firstWrongUserMove(g.solvedPlies);
      const played = userMoves[k - 1];
      const want = puzzle.moves[g.solvedPlies];
      feedback = played == null
        ? t('calc.stoppedEarly', { k: k - 1 })
        : t('calc.diverged', { k, played: fmtUci(played), want: fmtUci(want), ok: k - 1 });
      feedbackKind = 'bad';
    }
    await logAttempt(g.correct);
    // Hand the reveal to the shared SolutionReveal surface (AP-TEACH-1): switching to the
    // 'revealed' phase mounts <SolutionReveal autoplay>, which builds the SAN line and steps
    // the board at 350 ms — byte-equivalent to the inline reveal this replaced.
    phase = 'revealed';
    arrows = [];
  }

  $effect(() => {
    if (model && !puzzle && app.puzzles.size > 0) load();
  });
</script>

<section class="col center">
  <h2>{t('calc.title')}</h2>
  <p class="muted" style="max-width:440px;font-size:0.85rem">
    {t('calc.introLead')}
    <b>{t('calc.introTapBold')}</b>{t('calc.introMid')} <b>{t('calc.introSubmitBold')}</b>{t('calc.introSubmitTail')}
    <b>{t('calc.introUndoBold')}</b>{t('calc.introUndoTail')}
  </p>

  {#if metacog && phase === 'input'}
    <div class="row center metacog" role="group" aria-label={t('calc.confidenceGroup')}>
      <span class="muted metacog-label">{t('calc.confidence')}</span>
      <button type="button" class="chip {confidence === 'sure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'sure' ? undefined : 'sure')}>{t('calc.sure')}</button>
      <button type="button" class="chip {confidence === 'unsure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'unsure' ? undefined : 'unsure')}>{t('calc.unsure')}</button>
      <button type="button" class="chip {confidence === 'guess' ? 'on' : ''}" onclick={() => (confidence = confidence === 'guess' ? undefined : 'guess')}>{t('calc.guess')}</button>
    </div>
  {/if}

  <div class="board-wrap">
    {#if phase === 'revealed' && puzzle}
      <!-- Reveal handed to the shared surface (AP-TEACH-1): animated playback + SAN line. -->
      <SolutionReveal fen={puzzle.fen} moves={puzzle.moves} {orientation} autoplay />
    {:else}
      <Board
        {fen}
        {orientation}
        turnColor={sideToMove()}
        movableColor={undefined}
        dests={new Map()}
        check={display.inCheck()}
        lastMove={null}
        {arrows}
        {onSelect}
        showTurn
        turnLabel="play"
      />
    {/if}
  </div>

  {#if phase === 'input'}
    <div class="row center myline">
      <span class="muted">{t('calc.myLine')}</span>
      {#if userMoves.length === 0}
        <span class="muted">{t('calc.tapHint')}</span>
      {:else}
        {#each userMoves as m, i}<span class="ply">{i + 1}.{fmtUci(m)}</span>{/each}
      {/if}
    </div>
  {/if}

  <p class="feedback {feedbackKind}">{feedback}</p>

  {#if metacog && phase === 'revealed' && !solved}
    <div class="col center metacog" role="group" aria-label={t('calc.whyMissGroup')}>
      <span class="muted metacog-label">{t('calc.whyMiss')}</span>
      <div class="row center" style="flex-wrap:wrap">
        {#each SELF_TAGS as tag}
          <button type="button" class="chip {selfTag === tag ? 'on' : ''}" onclick={() => updateSelfTag(tag)}>{t('selfTag.' + tag)}</button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="row center">
    {#if phase === 'input'}
      <button class="ghost" onclick={undo} disabled={userMoves.length === 0}>{t('calc.undo')}</button>
      <button onclick={submit} disabled={userMoves.length === 0}>{t('calc.submit')}</button>
    {/if}
    <button onclick={load}>{t('calc.next')}</button>
  </div>
</section>

<style>
  .metacog { gap: 0.4rem; flex-wrap: wrap; margin: 0.3rem 0; }
  .metacog-label { font-size: 0.82rem; align-self: center; }
  .chip { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 999px; padding: 0.15rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .myline { flex-wrap: wrap; gap: 0.4rem; max-width: 440px; }
  .ply { font-variant-numeric: tabular-nums; font-size: 0.85rem; background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; padding: 0.1rem 0.45rem; }
</style>
