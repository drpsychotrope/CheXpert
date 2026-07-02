<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import AnalysisResult from './AnalysisResult.svelte';
  import { parsePgn, inferPlayerColor } from '../analysis/pgn';
  import { runAnalysis } from '../analysis/runAnalysis';
  import { splitPgnGames, importGameId, importBulk, type ImportBulkResult } from '../analysis/bulkImport';
  import { getAllGames, getAnalyzedGameIds, getAnalysis } from '../store/gamesRepo';
  import { downloadPgn, pgnFilename } from './pgnDownload';
  import type { GameRecord } from '../store/db';
  import type { GameAnalysis } from '../analysis/types';
  import { t, fmtNum, getLocale } from '../i18n';

  let pgn = $state('');
  let playerName = $state('');
  let colorChoice = $state<'auto' | 'w' | 'b'>('auto');
  let status = $state<'idle' | 'analyzing' | 'done' | 'error' | 'bulk' | 'bulk-done'>('idle');
  // PR-06 (ADR-0064): bulk multi-game import. `bulkSources` holds the split games awaiting the
  // user's explicit choice (all vs first only — no silent first-only anymore); the counters drive
  // the "game i/N" line; `bulkCancel` is polled between games (never mid-game).
  let bulkSources = $state<string[] | null>(null);
  let bulkIndex = $state(0);
  let bulkTotal = $state(0);
  let bulkCancel = false;
  let bulkSummary = $state<ImportBulkResult | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let progress = $state(0);
  let total = $state(0);
  let error = $state('');
  let result = $state<GameAnalysis | null>(null);
  let puzzlesMade = $state(0);
  let elapsedMs = $state(0);
  let notice = $state('');

  // Played-game history (F5, ADR-0056). Newest-first list + the set of ids that already have an
  // analysis (one batched read, FOLD-G1). `analysingId` tracks the row currently being analysed.
  let games = $state<GameRecord[]>([]);
  let analyzedIds = $state<Set<string>>(new Set());
  let analysingId = $state<string | null>(null);

  const model = $derived(app.model);

  async function loadHistory() {
    const [all, ids] = await Promise.all([getAllGames(), getAnalyzedGameIds()]);
    games = all.reverse(); // index read is ascending by playedAt → reverse for newest-first
    analyzedIds = ids;
  }

  onMount(loadHistory);

  /** Localized "played on" date for a history row (locale-aware, derived from playedAt). */
  function fmtPlayedAt(ms: number): string {
    return new Intl.DateTimeFormat(getLocale() === 'fr' ? 'fr-FR' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ms));
  }

  function resultLabel(r: GameRecord['result']): string {
    return r === 'win' ? t('history.resultWin') : r === 'loss' ? t('history.resultLoss') : t('history.resultDraw');
  }

  /** Time-control / variant badge for a row (960 > untimed > category). */
  function tcBadge(g: GameRecord): string {
    if (g.variant === 'chess960') return t('history.chess960');
    if (!g.timeControl || g.timeControl.untimed) return t('history.untimed');
    const cat = g.timeControl.category;
    return cat === 'bullet'
      ? t('history.catBullet')
      : cat === 'blitz'
        ? t('history.catBlitz')
        : cat === 'rapid'
          ? t('history.catRapid')
          : t('history.catClassical');
  }

  /** Re-analyse a played game from history. Reuses the Play-tail pipeline (same as analyzePlayed):
   *  idempotent via getAnalysis, 960 excluded by the caller (button disabled). Renders the result
   *  in the shared AnalysisResult panel below and refreshes the analysed set. */
  /** Side the human played, for re-analysis. Prefer the persisted value (F5); for legacy records
   *  with no `playerColor`, derive from a terminal checkmate + the recorded result; else default
   *  to White. Wrong colour would corrupt player-attributed metrics (audit v2 P0-02), so this is
   *  best-effort only for pre-F5 records. */
  function playerColorOf(game: GameRecord): 'w' | 'b' {
    if (game.playerColor) return game.playerColor;
    if (game.result !== 'draw') {
      const plies = parsePgn(game.pgn).plies;
      const last = plies[plies.length - 1];
      if (last && last.san.includes('#')) {
        const winner = last.color; // the side that delivered mate
        return game.result === 'win' ? winner : winner === 'w' ? 'b' : 'w';
      }
    }
    return 'w';
  }

  async function analyzeFromHistory(game: GameRecord) {
    if (!model || analysingId) return;
    const color = playerColorOf(game);
    analysingId = game.id;
    error = '';
    notice = '';
    result = null;
    puzzlesMade = 0;
    elapsedMs = 0; // history re-analysis reuses the result panel; hide the import "analysed in" line
    status = 'analyzing';
    progress = 0;
    try {
      const existing = await getAnalysis(game.id);
      if (existing) {
        result = existing;
        status = 'done';
        analyzedIds = new Set(analyzedIds).add(game.id);
        return;
      }
      await app.engine.resetVariant();
      const res = await runAnalysis(app.engine, app.puzzles, {
        gameId: game.id,
        pgn: game.pgn,
        playerColor: color,
        source: 'played',
        baseRating: Math.round(model.puzzleRating.rating),
        now: Date.now(),
        movetimeMs: 200,
        onProgress: (d, t) => {
          progress = d;
          total = t;
        },
      });
      result = res.analysis;
      puzzlesMade = res.puzzles.length;
      status = 'done';
      analyzedIds = new Set(analyzedIds).add(game.id);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'error';
    } finally {
      analysingId = null;
    }
  }

  const SAMPLE =
    '[Event "Casual"]\n[White "You"]\n[Black "Opponent"]\n[TimeControl "300+3"]\n\n' +
    '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 ' +
    '7. Qf3+ Ke6 8. Nc3 Ncb4 9. a3 *';

  /** Entry: detect multi-game pastes (PR-06). N>1 → present an explicit choice (all vs first) —
   *  the old silent analyse-first-only is gone; N==1 → straight to the single-game flow. */
  function analyze() {
    const games = splitPgnGames(pgn);
    if (games.length > 1) {
      bulkSources = games;
      bulkSummary = null;
      notice = t('import.detectedGames', { n: games.length });
      return;
    }
    void analyzeSingle(pgn);
  }

  /** PR-06 (ADR-0064): run the whole detected batch through the sequential, cancellable loop. */
  async function runBulk() {
    const sources = bulkSources;
    if (!sources || !sources.length) return;
    bulkSources = null;
    notice = '';
    error = '';
    result = null;
    bulkCancel = false;
    bulkIndex = 0;
    bulkTotal = sources.length;
    bulkSummary = null;
    status = 'bulk';
    const summary = await importBulk(
      app.engine,
      app.puzzles,
      model ? Math.round(model.puzzleRating.rating) : 1200,
      sources,
      playerName,
      colorChoice,
      {
        isCancelled: () => bulkCancel,
        onGameStart: (i, n) => {
          bulkIndex = i;
          bulkTotal = n;
          progress = 0;
          total = 0;
        },
        onPositionProgress: (d, n) => {
          progress = d;
          total = n;
        },
      },
    );
    bulkSummary = summary;
    result = summary.last;
    puzzlesMade = summary.puzzles;
    elapsedMs = 0;
    status = 'bulk-done';
  }

  /** PR-06: load a .pgn file straight into the paste area (then the normal detect flow applies). */
  async function onPgnFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!file) return;
    pgn = await file.text();
    bulkSources = null;
    bulkSummary = null;
    notice = '';
  }

  async function analyzeSingle(raw: string) {
    error = '';
    result = null;
    puzzlesMade = 0;
    notice = '';
    bulkSources = null;
    status = 'analyzing';
    progress = 0;

    try {
      const source = raw.trim();
      const parsed = parsePgn(source); // throws on malformed
      if (parsed.plies.length === 0) {
        // Headers-only / move-less PGN — don't persist an all-zeros junk analysis (audit v2 L21).
        error = t('import.noMoves');
        status = 'error';
        return;
      }
      total = parsed.plies.length + 1;
      let color: 'w' | 'b';
      if (colorChoice === 'auto') {
        const detected = inferPlayerColor(parsed.headers, playerName);
        if (!detected) {
          // Don't silently default to White — a Black-side game analysed from White's POV
          // corrupts every player-attributed metric and the weakness profile (audit v2 C-3 / P0-02).
          error = t('import.colorNotDetected', {
            white: parsed.headers.White ?? '?',
            black: parsed.headers.Black ?? '?',
          });
          status = 'error';
          return;
        }
        color = detected;
      } else {
        color = colorChoice;
      }

      const baseRating = model ? Math.round(model.puzzleRating.rating) : 1200;
      // Content-addressed id: distinct games never collide (audit v2 P1-11; shared with bulk — PR-06).
      const gameId = importGameId(parsed.headers, source);
      const now = Date.now();
      const t0 = performance.now();

      // Persist the imported game record first.
      const { putImportedGame } = await import('../store/gamesRepo');
      await putImportedGame({
        id: gameId,
        pgn: source,
        playerColor: color,
        headers: parsed.headers,
        importedAt: now,
        analyzed: false,
      });

      await app.engine.resetVariant();
      const res = await runAnalysis(app.engine, app.puzzles, {
        gameId,
        pgn: source,
        playerColor: color,
        source: 'imported',
        baseRating,
        now,
        movetimeMs: 200,
        onProgress: (d, t) => {
          progress = d;
          total = t;
        },
      });

      await putImportedGame({
        id: gameId,
        pgn: source,
        playerColor: color,
        headers: parsed.headers,
        importedAt: now,
        analyzed: true,
      });

      elapsedMs = Math.round(performance.now() - t0);
      result = res.analysis;
      puzzlesMade = res.puzzles.length;
      status = 'done';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'error';
    }
  }
</script>

<section class="col" style="max-width:680px;margin:0 auto">
  <h2>{t('import.title')}</h2>
  <p class="muted">
    {t('import.introBefore')}<b>{t('import.playTab')}</b>{t('import.introAfter')}
  </p>

  <textarea
    bind:value={pgn}
    rows="8"
    placeholder={t('import.pgnPlaceholder')}
    style="width:100%;font-family:monospace;font-size:0.85rem"
  ></textarea>

  <div class="row">
    <label style="flex:1">
      {t('import.nameLabel')}
      <input bind:value={playerName} placeholder={t('import.namePlaceholder')} />
    </label>
    <label>
      {t('import.youPlayed')}
      <select bind:value={colorChoice}>
        <option value="auto">{t('import.autoDetect')}</option>
        <option value="w">{t('import.white')}</option>
        <option value="b">{t('import.black')}</option>
      </select>
    </label>
  </div>

  <div class="row">
    <button onclick={analyze} disabled={status === 'analyzing' || status === 'bulk' || pgn.trim().length === 0}>
      {status === 'analyzing' ? t('import.analysing') : t('import.analyse')}
    </button>
    <!-- PR-06: load a whole .pgn file (Lichess/Chess.com "export all") into the paste area. -->
    <button class="ghost" onclick={() => fileInput?.click()} disabled={status === 'analyzing' || status === 'bulk'}>
      {t('import.loadFile')}
    </button>
    <input type="file" accept=".pgn,application/x-chess-pgn,text/plain" style="display:none" bind:this={fileInput} onchange={onPgnFile} />
    <button class="ghost" onclick={() => (pgn = SAMPLE)} disabled={status === 'analyzing' || status === 'bulk'}>
      {t('import.loadSample')}
    </button>
  </div>

  {#if notice}
    <p class="feedback">{notice}</p>
  {/if}

  <!-- PR-06 (ADR-0064): explicit multi-game choice — all (sequential batch) or first only. -->
  {#if bulkSources}
    <div class="row">
      <button onclick={runBulk}>{t('import.analyseAll', { n: bulkSources.length })}</button>
      <button class="ghost" onclick={() => void analyzeSingle(bulkSources?.[0] ?? '')}>{t('import.analyseFirstOnly')}</button>
    </div>
  {/if}

  {#if status === 'analyzing'}
    <div class="panel">
      <p>{t('import.progress', { progress, total })}</p>
      <div class="bar"><div class="bar-fill" style="width:{total ? (progress / total) * 100 : 0}%"></div></div>
    </div>
  {/if}

  {#if status === 'bulk'}
    <div class="panel col" style="gap:0.4rem">
      <p>{t('import.bulkProgress', { i: bulkIndex, n: bulkTotal })}</p>
      <div class="bar"><div class="bar-fill" style="width:{total ? (progress / total) * 100 : 0}%"></div></div>
      <button class="ghost" onclick={() => (bulkCancel = true)}>{t('import.bulkCancel')}</button>
    </div>
  {/if}

  {#if status === 'bulk-done' && bulkSummary}
    <div class="panel col" style="gap:0.25rem">
      <b>{t('import.bulkDoneTitle')}</b>
      <span style="font-size:0.85rem">{t('import.bulkDoneLine', { analyzed: bulkSummary.analyzed, puzzles: bulkSummary.puzzles })}</span>
      {#if bulkSummary.skippedColor}
        <span class="muted" style="font-size:0.82rem">{t('import.bulkSkippedColor', { n: bulkSummary.skippedColor })}</span>
      {/if}
      {#if bulkSummary.skippedDup}
        <span class="muted" style="font-size:0.82rem">{t('import.bulkSkippedDup', { n: bulkSummary.skippedDup })}</span>
      {/if}
      {#if bulkSummary.failed}
        <span class="muted" style="font-size:0.82rem;color:var(--bad)">{t('import.bulkFailed', { n: bulkSummary.failed })}</span>
      {/if}
    </div>
  {/if}

  {#if status === 'error'}
    <p class="feedback bad">{t('import.couldNotAnalyse', { error })}</p>
  {/if}

  {#if (status === 'done' || status === 'bulk-done') && result}
    <div class="panel col">
      <h3>{t('import.resultTitle')}</h3>
      {#if elapsedMs > 0}
        <p class="muted">{t('import.analysedIn', { seconds: fmtNum(elapsedMs / 1000, 1), ms: result.movetimeMs })}</p>
      {/if}
      <AnalysisResult analysis={result} {puzzlesMade} />
    </div>
  {/if}

  <!-- Played-game history (F5, ADR-0056): the `games` store made readable. -->
  <section class="col" style="margin-top:1.5rem">
    <h3>{t('history.title')}</h3>
    <p class="muted" style="font-size:0.85rem">{t('history.subtitle')}</p>

    {#if games.length === 0}
      <p class="muted">{t('history.empty')}</p>
    {:else}
      <ul class="history">
        {#each games as g (g.id)}
          {@const analysed = analyzedIds.has(g.id)}
          <li class="hrow">
            <div class="hmeta col">
              <span class="hdate">{fmtPlayedAt(g.playedAt)}</span>
              <span class="muted" style="font-size:0.82rem">
                {resultLabel(g.result)} · {t('history.botElo', { elo: g.botElo })} · {tcBadge(g)}
              </span>
            </div>
            <div class="hactions row">
              <span class="badge {analysed ? 'ok' : ''}">
                {analysed ? t('history.analysed') : t('history.notAnalysed')}
              </span>
              {#if !analysed && g.variant !== 'chess960'}
                <button
                  class="ghost"
                  onclick={() => analyzeFromHistory(g)}
                  disabled={analysingId !== null}
                >
                  {analysingId === g.id ? t('import.analysing') : t('history.analyse')}
                </button>
              {/if}
              <button class="ghost" onclick={() => downloadPgn(g.pgn, pgnFilename(g.playedAt, g.result))}>
                {t('history.export')}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</section>

<style>
  .bar { height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
  .bar-fill { height: 100%; background: var(--accent); transition: width 0.1s linear; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }

  .history { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  .hrow {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;
    padding: 0.5rem 0.7rem; background: var(--panel-2); border-radius: 6px;
  }
  .hmeta { gap: 0.1rem; }
  .hdate { font-weight: 600; }
  .hactions { gap: 0.4rem; align-items: center; flex-wrap: wrap; }
  .badge {
    font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px;
    background: var(--panel); border: 1px solid var(--border); color: var(--muted, var(--text));
  }
  .badge.ok { border-color: var(--accent); color: var(--accent); }
</style>
