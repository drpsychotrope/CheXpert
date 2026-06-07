<script lang="ts">
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { buildLine, saveLine, listLines, deleteLine, RepertoireDrill } from '../repertoire/repertoire';
  import type { RepertoireLine } from '../repertoire/types';
  import { reviewItem } from '../srs/SrsStore';
  import { resultToGrade } from '../srs/fsrs';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  let lines = $state<RepertoireLine[]>([]);
  let mode = $state<'list' | 'build' | 'drill'>('list');

  // Builder.
  let name = $state('');
  let color = $state<'w' | 'b'>('w');
  let movesText = $state('');
  let buildError = $state('');

  // Drill.
  let drill = $state<RepertoireDrill | null>(null);
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  let drillFeedback = $state('');
  let drillKind = $state<'good' | 'bad' | ''>('');
  let drillStartedAt = 0;

  async function refresh() {
    lines = await listLines();
  }

  $effect(() => {
    if (mode === 'list') void refresh();
  });

  async function save() {
    buildError = '';
    const sans = movesText.trim().split(/[\s,]+/).filter(Boolean)
      // strip move numbers like "1." or "1...".
      .filter((t) => !/^\d+\.+$/.test(t))
      .map((t) => t.replace(/^\d+\.+/, ''));
    const id = `rep:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${color}`;
    const res = buildLine(id, name || 'Untitled line', color, sans, Date.now());
    if (!res.ok || !res.line) {
      buildError = res.error ?? 'Could not build line';
      return;
    }
    await saveLine(res.line);
    name = '';
    movesText = '';
    mode = 'list';
  }

  async function remove(id: string) {
    if (!confirm('Delete this repertoire line and its review card?')) return;
    await deleteLine(id);
    await refresh();
  }

  function startDrill(line: RepertoireLine) {
    drill = new RepertoireDrill(line);
    fen = drill.fen();
    lastMove = null;
    drillFeedback = '';
    drillKind = '';
    drillStartedAt = Date.now();
    mode = 'drill';
  }

  function drillSide(): 'white' | 'black' {
    return drill?.line.color === 'b' ? 'black' : 'white';
  }

  function dests() {
    if (!drill || drill.done) return new Map<string, string[]>();
    // Full legal dests for the side to move; wrong moves are caught by the drill.
    return new ChessGame(drill.fen()).dests();
  }

  async function onDrillMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!drill || drill.done) return;
    const uci = from + to + (new ChessGame(drill.fen()).isPromotion(from, to) ? promo : '');
    const res = drill.play(uci);
    if (res === 'wrong') {
      drillFeedback = 'Not your repertoire move — try again.';
      drillKind = 'bad';
      return;
    }
    fen = drill.fen();
    lastMove = [from, to];
    if (res === 'done') {
      const ms = Date.now() - drillStartedAt;
      const solved = drill.mistakes === 0;
      drillFeedback = solved ? 'Line complete, no mistakes ✔' : `Line complete (${drill.mistakes} mistake${drill.mistakes === 1 ? '' : 's'}).`;
      drillKind = solved ? 'good' : '';
      await reviewItem('repertoire', drill.line.id, resultToGrade(solved, ms), Date.now());
    } else {
      drillFeedback = 'Correct.';
      drillKind = 'good';
    }
  }
</script>

<section class="col center">
  <h2>Opening repertoire</h2>

  {#if mode === 'list'}
    <p class="muted">Build the lines you want to play, then drill them with spaced repetition until they're automatic.</p>
    <div class="row center">
      <button onclick={() => (mode = 'build')}>+ New line</button>
    </div>

    {#if lines.length === 0}
      <p class="muted">No lines yet.</p>
    {:else}
      <div class="lines">
        {#each lines as l (l.id)}
          <div class="line-card">
            <div class="col" style="gap:0.2rem;align-items:flex-start">
              <b>{l.name}</b>
              <span class="muted" style="font-size:0.8rem">{l.color === 'w' ? 'White' : 'Black'} · {l.san.join(' ')}</span>
            </div>
            <div class="row">
              <button onclick={() => startDrill(l)}>Drill</button>
              <button class="ghost" onclick={() => remove(l.id)}>✕</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  {:else if mode === 'build'}
    <div class="panel col" style="max-width:520px;width:100%">
      <label>Name<input bind:value={name} placeholder="e.g. Italian — main line" /></label>
      <label>You play
        <select bind:value={color}>
          <option value="w">White</option>
          <option value="b">Black</option>
        </select>
      </label>
      <label>Moves (SAN, space-separated)
        <textarea bind:value={movesText} rows="3" placeholder="e4 e5 Nf3 Nc6 Bc4 Bc5"></textarea>
      </label>
      {#if buildError}<p class="feedback bad">{buildError}</p>{/if}
      <div class="row">
        <button onclick={save} disabled={!movesText.trim()}>Save line</button>
        <button class="ghost" onclick={() => (mode = 'list')}>Cancel</button>
      </div>
    </div>

  {:else if mode === 'drill' && drill}
    <p><b>{drill.line.name}</b> — play your moves</p>
    <div class="board-wrap">
      <Board
        {fen}
        orientation={drillSide()}
        turnColor={fen.split(' ')[1] === 'w' ? 'white' : 'black'}
        movableColor={drill.done ? undefined : drillSide()}
        dests={dests()}
        {lastMove}
        onMove={onDrillMove}
      />
    </div>
    <p class="feedback {drillKind}">{drillFeedback}</p>
    <div class="row center">
      {#if drill.done}<button onclick={() => drill && startDrill(drill.line)}>Again</button>{/if}
      <button class="ghost" onclick={() => (mode = 'list')}>← Lines</button>
    </div>
  {/if}
</section>

<style>
  .lines { display: flex; flex-direction: column; gap: 0.5rem; max-width: 560px; width: 100%; }
  .line-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem 0.9rem; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  textarea { width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 8px; border: 1px solid var(--border); background: var(--panel-2); color: var(--text); font-family: monospace; }
</style>
