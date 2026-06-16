<script lang="ts">
  // Calculation / board-vision drills (ADR-0043). Drills that force locating/relating REAL
  // squares — no closed-form shortcut. Single-square drills (coordinate, blindfold) persist
  // per-square retention as FSRS 'vision-square' cards; relational/calc drills (relation,
  // knight, find-all) persist per-drill stats on PlayerModel.visionStats.
  import {
    squareFrom, knightShortestPath, knightDistance,
  } from '../vision/vision';
  import { genRelation } from '../vision/geometry';
  import { pieceAt, genBlindfold } from '../vision/blindfold';
  import { VISION_GRADE_THRESHOLDS, blindfoldGrade } from '../vision/grading';
  import { recordDrill } from '../vision/visionStats';
  import { visionMastery } from '../vision/weakSquares';
  import { allChecks, allCaptures, hangingPieces } from '../vision/tacticsVision';
  import { reviewItem, allCards } from '../srs/SrsStore';
  import { resultToGrade } from '../srs/fsrs';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';

  type Drill = 'menu' | 'coordinate' | 'blindfold' | 'relation' | 'knight' | 'findall';
  let drill = $state<Drill>('menu');

  // --- shared scoring ---
  let asked = $state(0);
  let correct = $state(0);
  let streak = $state(0);
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');
  let promptAt = 0; // ms when the current answerable prompt was shown (UI owns time)
  let mastery = $state(0);

  const EMPTY_FEN = '8/8/8/8/8/8/8/8';
  function rnd(): number { return Math.random(); }
  function elapsed(): number { return Date.now() - promptAt; }

  async function loadMastery() { mastery = visionMastery(await allCards()); }
  loadMastery();

  function score(ok: boolean, msg: string) {
    asked += 1;
    if (ok) { correct += 1; streak += 1; feedback = `✔ ${msg}`; feedbackKind = 'good'; }
    else { streak = 0; feedback = `✗ ${msg}`; feedbackKind = 'bad'; }
  }
  function persistDrill(key: 'diagonal' | 'knight' | 'findall', ok: boolean, ms: number) {
    if (!app.model) return;
    app.model.visionStats = recordDrill(app.model.visionStats ?? {}, key, ok, ms, Date.now());
    void app.persistModel(Date.now());
  }

  // Seed coordinate/blindfold onto due weak squares when a session set them; else uniform random.
  let weakIdx = 0;
  function nextSquare(): string {
    const weak = app.visionWeakSquares;
    if (weak && weak.length) return weak[weakIdx++ % weak.length];
    return squareFrom(rnd());
  }

  // --- coordinate→square drill: show a coordinate, click the square on a blank board.
  // The reverse "name the lit square" mode was dropped — naming a square on an empty,
  // unlabeled board is orientation-ambiguous, so a correct read could be typed/counted as a
  // different square and wrongly marked incorrect (ADR-0043). Clicking is unambiguous.
  let coordTarget = $state('');
  function newCoordinate() {
    coordTarget = nextSquare();
    feedback = ''; feedbackKind = '';
    promptAt = Date.now();
  }
  async function gradeCoordinate(ok: boolean) {
    score(ok, ok ? `${coordTarget}.` : `it was ${coordTarget}.`);
    await reviewItem('vision-square', coordTarget, resultToGrade(ok, elapsed(), VISION_GRADE_THRESHOLDS), Date.now());
    setTimeout(newCoordinate, 750);
  }
  function onCoordClick(sq: string) { if (!feedback) void gradeCoordinate(sq === coordTarget); }

  // --- blindfold drill ---
  const FALLBACK_FENS = [
    'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
    '2kr3r/ppp2ppp/2n5/2bqp3/8/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 0 1',
    'r3k2r/pp1n1ppp/2p1pn2/q7/2BP4/2N1PN2/PP3PPP/R2Q1RK1 w kq - 0 1',
  ];
  const WHITE_PIECES: Array<[string, string]> = [['K', '♔'], ['Q', '♕'], ['R', '♖'], ['B', '♗'], ['N', '♘'], ['P', '♙']];
  const BLACK_PIECES: Array<[string, string]> = [['k', '♚'], ['q', '♛'], ['r', '♜'], ['b', '♝'], ['n', '♞'], ['p', '♟']];
  let blindFen = $state('');
  let blindSquare = $state('');
  let blindAnswer: string | null = null;
  let blindPhase = $state<'show' | 'ask'>('show');
  let blindTimer: ReturnType<typeof setTimeout> | null = null;
  function newBlindfold() {
    const p = app.model ? app.puzzles.next({ rating: app.model.puzzleRating.rating, window: 600, exclude: new Set() }) : null;
    blindFen = p?.fen ?? FALLBACK_FENS[Math.floor(rnd() * FALLBACK_FENS.length)];
    const weak = app.visionWeakSquares;
    blindSquare = weak && weak.length ? nextSquare() : genBlindfold(blindFen, rnd()).square;
    blindAnswer = pieceAt(blindFen, blindSquare);
    blindPhase = 'show';
    feedback = ''; feedbackKind = '';
    if (blindTimer) clearTimeout(blindTimer);
    blindTimer = setTimeout(() => { blindPhase = 'ask'; promptAt = Date.now(); }, 3000);
  }
  async function answerBlindfold(pick: string | null) {
    if (blindPhase !== 'ask' || feedback) return;
    const ok = pick === blindAnswer;
    const truth = blindAnswer ? `${blindSquare} = ${blindAnswer}` : `${blindSquare} is empty`;
    score(ok, ok ? `${truth}.` : `${truth}.`);
    await reviewItem('vision-square', blindSquare, blindfoldGrade(ok), Date.now());
    setTimeout(newBlindfold, 900);
  }

  // --- relation drill (diagonal / line / colour) ---
  let rel = $state<ReturnType<typeof genRelation> | null>(null);
  let relGuess = $state('');
  function newRelation() {
    rel = genRelation(rnd());
    relGuess = '';
    feedback = ''; feedbackKind = '';
    promptAt = Date.now();
  }
  function answerRelation(guess: boolean | number) {
    if (!rel || feedback) return;
    const ok = guess === rel.answer;
    score(ok, `answer: ${typeof rel.answer === 'boolean' ? (rel.answer ? 'yes' : 'no') : rel.answer}.`);
    persistDrill('diagonal', ok, elapsed());
    setTimeout(newRelation, 800);
  }

  // --- knight-distance drill ---
  let kFrom = $state('');
  let kTo = $state('');
  let kAnswer = $state('');
  let kRevealed = $state<string[] | null>(null);
  function newKnight() {
    kFrom = squareFrom(rnd());
    do { kTo = squareFrom(rnd()); } while (kTo === kFrom);
    kAnswer = ''; kRevealed = null;
    feedback = ''; feedbackKind = '';
    promptAt = Date.now();
  }
  function answerKnight() {
    if (feedback) return; // already graded this prompt — don't double-count (audit v2 P1-13)
    const truth = knightDistance(kFrom, kTo);
    const ok = Number(kAnswer) === truth;
    score(ok, `${truth} move${truth === 1 ? '' : 's'}.`);
    if (!ok) kRevealed = knightShortestPath(kFrom, kTo);
    persistDrill('knight', ok, elapsed());
  }

  // --- find-all drill ---
  let faFen = $state('');
  let faTask = $state<'checks' | 'captures' | 'hanging'>('checks');
  let faTargets: string[] = [];
  let faAnswer = $state('');
  const faLabel = { checks: 'checking moves', captures: 'captures', hanging: 'pieces you can win' };
  function newFindAll() {
    const p = app.model ? app.puzzles.next({ rating: app.model.puzzleRating.rating, window: 600, exclude: new Set() }) : null;
    faFen = p?.fen ?? FALLBACK_FENS[Math.floor(rnd() * FALLBACK_FENS.length)];
    const tasks = ['checks', 'captures', 'hanging'] as const;
    faTask = tasks[Math.floor(rnd() * 3)];
    faTargets = faTask === 'checks' ? allChecks(faFen) : faTask === 'captures' ? allCaptures(faFen) : hangingPieces(faFen);
    faAnswer = '';
    feedback = ''; feedbackKind = '';
    promptAt = Date.now();
  }
  function answerFindAll() {
    if (feedback) return; // already graded this prompt — don't double-count (audit v2 P1-13)
    const truth = faTargets.length;
    const ok = Number(faAnswer) === truth;
    score(ok, `there ${truth === 1 ? 'is' : 'are'} ${truth} ${faLabel[faTask]}.`);
    persistDrill('findall', ok, elapsed());
  }

  function startDrill(which: Drill) {
    asked = 0; correct = 0; streak = 0; weakIdx = 0;
    drill = which;
    if (which === 'coordinate') newCoordinate();
    else if (which === 'blindfold') newBlindfold();
    else if (which === 'relation') newRelation();
    else if (which === 'knight') newKnight();
    else if (which === 'findall') newFindAll();
  }
  function backToMenu() {
    if (blindTimer) clearTimeout(blindTimer);
    drill = 'menu';
    void loadMastery();
  }
</script>

<section class="col center">
  <h2>Calculation & vision</h2>

  {#if drill === 'menu'}
    <p class="muted" style="max-width:580px">
      Board vision you can't fake — every drill needs you to locate or relate real squares, not
      compute a formula. Per-square recall is spaced-repeated so weak squares come back.
    </p>
    <p class="muted">Board mastery: <b>{Math.round(mastery * 100)}%</b></p>
    <div class="drills">
      <button class="drill-card" onclick={() => startDrill('coordinate')}>
        <b>Coordinate → square</b>
        <span class="muted">A coordinate is named — click it on a blank board, as fast as you can.</span>
      </button>
      <button class="drill-card" onclick={() => startDrill('blindfold')}>
        <b>Blindfold</b>
        <span class="muted">Study a position, then recall what stands on a square from memory.</span>
      </button>
      <button class="drill-card" onclick={() => startDrill('relation')}>
        <b>Lines & diagonals</b>
        <span class="muted">Same diagonal? Same colour? How many squares between?</span>
      </button>
      <button class="drill-card" onclick={() => startDrill('knight')}>
        <b>Knight distance</b>
        <span class="muted">How many moves does a knight need from A to B?</span>
      </button>
      <button class="drill-card" onclick={() => startDrill('findall')}>
        <b>Find them all</b>
        <span class="muted">Count every check, capture, or hanging piece in a position.</span>
      </button>
    </div>

  {:else if drill === 'coordinate'}
    <p class="muted">Score {correct}/{asked} · streak {streak}</p>
    <div class="prompt">{coordTarget}</div>
    <p class="muted">Click this square.</p>
    <div class="board-wrap" style="max-width:300px">
      <Board fen={EMPTY_FEN} coords={false} onSelect={onCoordClick} />
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    <button class="ghost" onclick={backToMenu}>← Drills</button>

  {:else if drill === 'blindfold'}
    <p class="muted">Score {correct}/{asked} · streak {streak}</p>
    {#if blindPhase === 'show'}
      <p class="muted">Memorise — board hides in a moment…</p>
      <div class="board-wrap" style="max-width:300px">
        <Board fen={blindFen} viewOnly={true} />
      </div>
    {:else}
      <p class="muted">What piece is on <b>{blindSquare}</b>?</p>
      <div class="piece-pick">
        {#each WHITE_PIECES as [ch, sym]}<button class="pc" onclick={() => answerBlindfold(ch)}>{sym}</button>{/each}
      </div>
      <div class="piece-pick">
        {#each BLACK_PIECES as [ch, sym]}<button class="pc" onclick={() => answerBlindfold(ch)}>{sym}</button>{/each}
      </div>
      <button onclick={() => answerBlindfold(null)}>Empty</button>
    {/if}
    <p class="feedback {feedbackKind}">{feedback}</p>
    <button class="ghost" onclick={backToMenu}>← Drills</button>

  {:else if drill === 'relation'}
    <p class="muted">Score {correct}/{asked} · streak {streak}</p>
    <div class="prompt small">{rel?.prompt}</div>
    {#if rel && rel.kind === 'between'}
      <div class="row center">
        <input type="number" min="0" max="6" bind:value={relGuess} style="width:5rem"
          onkeydown={(e) => e.key === 'Enter' && answerRelation(Number(relGuess))} />
        <button onclick={() => answerRelation(Number(relGuess))} disabled={relGuess === ''}>Check</button>
      </div>
    {:else}
      <div class="row center">
        <button onclick={() => answerRelation(true)}>Yes</button>
        <button onclick={() => answerRelation(false)}>No</button>
      </div>
    {/if}
    <p class="feedback {feedbackKind}">{feedback}</p>
    <button class="ghost" onclick={backToMenu}>← Drills</button>

  {:else if drill === 'knight'}
    <p class="muted">Score {correct}/{asked} · streak {streak}</p>
    <div class="prompt small">{kFrom} → {kTo}</div>
    <p class="muted">Fewest knight moves?</p>
    <div class="row center">
      <input type="number" min="1" max="8" bind:value={kAnswer} style="width:5rem"
        onkeydown={(e) => e.key === 'Enter' && answerKnight()} />
      <button onclick={answerKnight} disabled={kAnswer === ''}>Check</button>
      <button class="ghost" onclick={newKnight}>Next →</button>
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    {#if kRevealed}
      <p class="muted" style="font-size:0.85rem">Path: {kRevealed.join(' → ')}</p>
    {/if}
    <button class="ghost" onclick={backToMenu}>← Drills</button>

  {:else if drill === 'findall'}
    <p class="muted">Score {correct}/{asked} · streak {streak}</p>
    <div class="board-wrap" style="max-width:300px">
      <Board fen={faFen} viewOnly={true} orientation="white" turnColor={faFen.split(' ')[1] === 'w' ? 'white' : 'black'} showTurn turnLabel="move" />
    </div>
    <p class="muted">How many <b>{faLabel[faTask]}</b> for the side to move?</p>
    <div class="row center">
      <input type="number" min="0" max="40" bind:value={faAnswer} style="width:5rem"
        onkeydown={(e) => e.key === 'Enter' && answerFindAll()} />
      <button onclick={answerFindAll} disabled={faAnswer === ''}>Check</button>
      <button class="ghost" onclick={newFindAll}>Next →</button>
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    <button class="ghost" onclick={backToMenu}>← Drills</button>
  {/if}
</section>

<style>
  .drills { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; max-width: 560px; }
  .drill-card { display: flex; flex-direction: column; gap: 0.3rem; text-align: left; align-items: flex-start; background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 0.8rem 1rem; border-radius: 10px; cursor: pointer; }
  .drill-card .muted { font-size: 0.8rem; }
  .prompt { font-size: 3rem; font-weight: 700; letter-spacing: 0.1em; padding: 1rem 0; }
  .prompt.small { font-size: 1.6rem; }
  .piece-pick { display: flex; gap: 0.3rem; }
  .pc { font-size: 1.6rem; line-height: 1; padding: 0.3rem 0.5rem; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
