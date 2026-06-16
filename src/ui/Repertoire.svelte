<script lang="ts">
  import Board from './Board.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { buildLine, saveLine, listLines, deleteLine, RepertoireDrill } from '../repertoire/repertoire';
  import type { RepertoireLine } from '../repertoire/types';
  import { reviewItem } from '../srs/SrsStore';
  import { resultToGrade } from '../srs/fsrs';
  import { t, tn } from '../i18n';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  let lines = $state<RepertoireLine[]>([]);
  let mode = $state<'list' | 'build' | 'drill'>('list');
  let pendingDelete = $state<string | null>(null); // themed delete confirm (audit v2 W14/H39)

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

  /** Tiny stable string hash (djb2) — disambiguates repertoire-line ids by their moves. */
  function shortHash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  async function save() {
    buildError = '';
    if (!name.trim()) {
      buildError = t('repertoire.giveName');
      return;
    }
    const sans = movesText.trim().split(/[\s,]+/).filter(Boolean)
      // strip move numbers like "1." or "1...".
      .filter((t) => !/^\d+\.+$/.test(t))
      .map((t) => t.replace(/^\d+\.+/, ''));
    // Include a hash of the moves so two different lines with the same name+colour don't silently
    // overwrite each other; re-saving the identical line stays idempotent (audit v2 P1-12).
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = `rep:${slug}:${color}:${shortHash(sans.join(' '))}`;
    const res = buildLine(id, name.trim(), color, sans, Date.now());
    if (!res.ok || !res.line) {
      buildError = res.error ?? t('repertoire.couldNotBuild');
      return;
    }
    await saveLine(res.line);
    name = '';
    movesText = '';
    mode = 'list';
  }

  function remove(id: string) {
    pendingDelete = id;
  }
  async function confirmRemove() {
    const id = pendingDelete;
    pendingDelete = null;
    if (!id) return;
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
      drillFeedback = t('repertoire.notYourMove');
      drillKind = 'bad';
      return;
    }
    fen = drill.fen();
    lastMove = [from, to];
    if (res === 'done') {
      const ms = Date.now() - drillStartedAt;
      const solved = drill.mistakes === 0;
      drillFeedback = solved
        ? t('repertoire.lineCompleteNoMistakes')
        : tn(drill.mistakes, 'repertoire.lineCompleteMistakesOne', 'repertoire.lineCompleteMistakesMany');
      drillKind = solved ? 'good' : '';
      await reviewItem('repertoire', drill.line.id, resultToGrade(solved, ms), Date.now());
    } else {
      drillFeedback = t('repertoire.correct');
      drillKind = 'good';
    }
  }
</script>

<section class="col center">
  <h2>{t('repertoire.title')}</h2>

  {#if mode === 'list'}
    <p class="muted">{t('repertoire.intro')}</p>
    <div class="row center">
      <button onclick={() => (mode = 'build')}>{t('repertoire.newLine')}</button>
    </div>

    {#if lines.length === 0}
      <p class="muted">{t('repertoire.noLines')}</p>
    {:else}
      <div class="lines">
        {#each lines as l (l.id)}
          <div class="line-card">
            <div class="col" style="gap:0.2rem;align-items:flex-start">
              <b>{l.name}</b>
              <span class="muted" style="font-size:0.8rem">{l.color === 'w' ? t('repertoire.white') : t('repertoire.black')} · {l.san.join(' ')}</span>
            </div>
            <div class="row">
              <button onclick={() => startDrill(l)}>{t('repertoire.drill')}</button>
              <button class="ghost" onclick={() => remove(l.id)} aria-label={t('repertoire.deleteLineAria')}>✕</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  {:else if mode === 'build'}
    <div class="panel col" style="max-width:520px;width:100%">
      <label>{t('repertoire.nameLabel')}<input bind:value={name} placeholder={t('repertoire.namePlaceholder')} /></label>
      <label>{t('repertoire.youPlay')}
        <select bind:value={color}>
          <option value="w">{t('repertoire.white')}</option>
          <option value="b">{t('repertoire.black')}</option>
        </select>
      </label>
      <label>{t('repertoire.movesLabel')}
        <textarea bind:value={movesText} rows="3" placeholder="e4 e5 Nf3 Nc6 Bc4 Bc5"></textarea>
      </label>
      {#if buildError}<p class="feedback bad">{buildError}</p>{/if}
      <div class="row">
        <button onclick={save} disabled={!movesText.trim()}>{t('repertoire.saveLine')}</button>
        <button class="ghost" onclick={() => (mode = 'list')}>{t('repertoire.cancel')}</button>
      </div>
    </div>

  {:else if mode === 'drill' && drill}
    <p><b>{drill.line.name}</b> — {t('repertoire.playYourMoves')}</p>
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
      {#if drill.done}<button onclick={() => drill && startDrill(drill.line)}>{t('repertoire.again')}</button>{/if}
      <button class="ghost" onclick={() => (mode = 'list')}>{t('repertoire.linesBack')}</button>
    </div>
  {/if}

  <ConfirmDialog
    open={pendingDelete !== null}
    title={t('repertoire.deleteTitle')}
    body={t('repertoire.deleteBody')}
    confirmLabel={t('repertoire.deleteConfirm')}
    danger
    onConfirm={confirmRemove}
    onCancel={() => (pendingDelete = null)}
  />
</section>

<style>
  .lines { display: flex; flex-direction: column; gap: 0.5rem; max-width: 560px; width: 100%; }
  .line-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem 0.9rem; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  textarea { width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 8px; border: 1px solid var(--border); background: var(--panel-2); color: var(--text); font-family: monospace; }
</style>
