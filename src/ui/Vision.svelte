<script lang="ts">
  // Calculation / visualisation drills (no board needed — pure mental vision).
  //   1) Square colour: name a random square's colour, fast.
  //   2) Knight distance: how many knight moves from A to B (shortest)?
  import {
    squareColor, squareFrom, allSquares, knightShortestPath, knightDistance,
  } from '../vision/vision';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { allChecks, allCaptures, hangingPieces } from '../vision/tacticsVision';

  let drill = $state<'menu' | 'color' | 'knight' | 'findall'>('menu');

  // --- shared scoring ---
  let asked = $state(0);
  let correct = $state(0);
  let streak = $state(0);
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');

  // We can't use Math.random in the pure core, but the UI may — seed each prompt.
  function rnd(): number {
    return Math.random();
  }

  // --- square-colour drill ---
  let colorSquare = $state('');

  function newColor() {
    colorSquare = squareFrom(rnd());
    feedback = '';
    feedbackKind = '';
  }

  function answerColor(guess: 'light' | 'dark') {
    asked += 1;
    if (squareColor(colorSquare) === guess) {
      correct += 1;
      streak += 1;
      feedback = `✔ ${colorSquare} is ${guess}.`;
      feedbackKind = 'good';
    } else {
      streak = 0;
      feedback = `✗ ${colorSquare} is ${squareColor(colorSquare)}.`;
      feedbackKind = 'bad';
    }
    setTimeout(newColor, 700);
  }

  // --- knight-distance drill ---
  let kFrom = $state('');
  let kTo = $state('');
  let kAnswer = $state('');
  let kRevealed = $state<string[] | null>(null);

  function newKnight() {
    const all = allSquares();
    kFrom = all[Math.floor(rnd() * 64)];
    do {
      kTo = all[Math.floor(rnd() * 64)];
    } while (kTo === kFrom);
    kAnswer = '';
    kRevealed = null;
    feedback = '';
    feedbackKind = '';
  }

  function answerKnight() {
    const guess = Number(kAnswer);
    const truth = knightDistance(kFrom, kTo);
    asked += 1;
    if (guess === truth) {
      correct += 1;
      streak += 1;
      feedback = `✔ ${truth} move${truth === 1 ? '' : 's'}.`;
      feedbackKind = 'good';
    } else {
      streak = 0;
      feedback = `✗ shortest is ${truth} move${truth === 1 ? '' : 's'}.`;
      feedbackKind = 'bad';
      kRevealed = knightShortestPath(kFrom, kTo);
    }
  }

  // --- find-all drill (checks / captures / hanging pieces) ---
  const FALLBACK_FENS = [
    'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
    '2kr3r/ppp2ppp/2n5/2bqp3/8/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 0 1',
    'r3k2r/pp1n1ppp/2p1pn2/q7/2BP4/2N1PN2/PP3PPP/R2Q1RK1 w kq - 0 1',
  ];
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
    feedback = '';
    feedbackKind = '';
  }

  function answerFindAll() {
    asked += 1;
    const truth = faTargets.length;
    if (Number(faAnswer) === truth) {
      correct += 1;
      streak += 1;
      feedback = `✔ ${truth} ${faLabel[faTask]}.`;
      feedbackKind = 'good';
    } else {
      streak = 0;
      feedback = `✗ there ${truth === 1 ? 'is' : 'are'} ${truth} ${faLabel[faTask]}.`;
      feedbackKind = 'bad';
    }
  }

  function startDrill(which: 'color' | 'knight' | 'findall') {
    asked = 0;
    correct = 0;
    streak = 0;
    drill = which;
    if (which === 'color') newColor();
    else if (which === 'knight') newKnight();
    else newFindAll();
  }
</script>

<section class="col center">
  <h2>Calculation & vision</h2>

  {#if drill === 'menu'}
    <p class="muted" style="max-width:560px">
      Pure visualisation — no board to lean on. Train the board vision and calculation that make
      tactics faster: instant square colours, and knight geometry.
    </p>
    <div class="drills">
      <button class="drill-card" onclick={() => startDrill('color')}>
        <b>Square colours</b>
        <span class="muted">Name a square's colour from memory, as fast as you can.</span>
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

  {:else if drill === 'color'}
    <p class="muted">Score {correct}/{asked} · streak {streak}</p>
    <div class="prompt">{colorSquare}</div>
    <p class="muted">What colour is this square?</p>
    <div class="row center">
      <button onclick={() => answerColor('light')} style="background:#e8d5b0;color:#333">Light</button>
      <button onclick={() => answerColor('dark')} style="background:#7a5a3a">Dark</button>
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    <button class="ghost" onclick={() => (drill = 'menu')}>← Drills</button>

  {:else if drill === 'knight'}
    <p class="muted">Score {correct}/{asked} · streak {streak}</p>
    <div class="prompt small">{kFrom} → {kTo}</div>
    <p class="muted">Fewest knight moves?</p>
    <div class="row center">
      <input type="number" min="1" max="8" bind:value={kAnswer} style="width:5rem" onkeydown={(e) => e.key === 'Enter' && answerKnight()} />
      <button onclick={answerKnight} disabled={kAnswer === ''}>Check</button>
      <button class="ghost" onclick={newKnight}>Next →</button>
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    {#if kRevealed}
      <p class="muted" style="font-size:0.85rem">Path: {kRevealed.join(' → ')}</p>
    {/if}
    <button class="ghost" onclick={() => (drill = 'menu')}>← Drills</button>

  {:else if drill === 'findall'}
    <p class="muted">Score {correct}/{asked} · streak {streak}</p>
    <div class="board-wrap" style="max-width:300px">
      <Board fen={faFen} viewOnly={true} orientation="white" />
    </div>
    <p class="muted">How many <b>{faLabel[faTask]}</b> for the side to move?</p>
    <div class="row center">
      <input type="number" min="0" max="40" bind:value={faAnswer} style="width:5rem" onkeydown={(e) => e.key === 'Enter' && answerFindAll()} />
      <button onclick={answerFindAll} disabled={faAnswer === ''}>Check</button>
      <button class="ghost" onclick={newFindAll}>Next →</button>
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    <button class="ghost" onclick={() => (drill = 'menu')}>← Drills</button>
  {/if}
</section>

<style>
  .drills { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; max-width: 560px; }
  .drill-card { display: flex; flex-direction: column; gap: 0.3rem; text-align: left; align-items: flex-start; background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 0.8rem 1rem; border-radius: 10px; cursor: pointer; }
  .drill-card .muted { font-size: 0.8rem; }
  .prompt { font-size: 3rem; font-weight: 700; letter-spacing: 0.1em; padding: 1rem 0; }
  .prompt.small { font-size: 2rem; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
