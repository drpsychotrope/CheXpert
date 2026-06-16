<script lang="ts">
  import { app } from '../state/app.svelte';
  import AnalysisResult from './AnalysisResult.svelte';
  import { parsePgn, inferPlayerColor } from '../analysis/pgn';
  import { runAnalysis } from '../analysis/runAnalysis';
  import type { GameAnalysis } from '../analysis/types';

  let pgn = $state('');
  let playerName = $state('');
  let colorChoice = $state<'auto' | 'w' | 'b'>('auto');
  let status = $state<'idle' | 'analyzing' | 'done' | 'error'>('idle');
  let progress = $state(0);
  let total = $state(0);
  let error = $state('');
  let result = $state<GameAnalysis | null>(null);
  let puzzlesMade = $state(0);
  let elapsedMs = $state(0);
  let notice = $state('');

  const model = $derived(app.model);

  /** Tiny stable string hash (djb2) — content-addresses an import so re-analysing the same PGN
   *  overwrites itself while distinct games never collide on players+ply-count (audit v2 P1-11). */
  function shortHash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  const SAMPLE =
    '[Event "Casual"]\n[White "You"]\n[Black "Opponent"]\n[TimeControl "300+3"]\n\n' +
    '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 ' +
    '7. Qf3+ Ke6 8. Nc3 Ncb4 9. a3 *';

  async function analyze() {
    error = '';
    result = null;
    puzzlesMade = 0;
    notice = '';
    status = 'analyzing';
    progress = 0;

    try {
      // A multi-game PGN (Lichess/Chess.com "export all", studies) makes chess.js throw a cryptic
      // error; detect it, analyse the first game, and tell the user (audit v2 P1-10).
      const games = pgn.split(/\n\s*\n(?=\[Event\s)/i).map((s) => s.trim()).filter(Boolean);
      const source = games.length > 1 ? games[0] : pgn;
      if (games.length > 1) {
        notice = `Detected ${games.length} games — analysing the first. Paste one game at a time for the rest.`;
      }
      const parsed = parsePgn(source); // throws on malformed
      if (parsed.plies.length === 0) {
        // Headers-only / move-less PGN — don't persist an all-zeros junk analysis (audit v2 L21).
        error = 'No moves found in this PGN.';
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
          error =
            `Couldn't auto-detect your colour (White: "${parsed.headers.White ?? '?'}", ` +
            `Black: "${parsed.headers.Black ?? '?'}"). Type your name as it appears in the PGN, ` +
            `or pick White/Black above, then Analyse again.`;
          status = 'error';
          return;
        }
        color = detected;
      } else {
        color = colorChoice;
      }

      const baseRating = model ? Math.round(model.puzzleRating.rating) : 1200;
      // Content-addressed id: distinct games never collide on players+ply-count (audit v2 P1-11).
      const gameId = `import:${parsed.headers.White ?? '?'}-${parsed.headers.Black ?? '?'}-${shortHash(source)}`;
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
  <h2>Analyse a game</h2>
  <p class="muted">
    Paste a PGN from an external game. We run the engine locally over every move, flag your
    inaccuracies / mistakes / blunders, tag the missed idea, and turn your real mistakes into
    personalised puzzles. Nothing leaves your device. (Games you play in <b>Play</b> can be analysed
    in one click — no paste needed.)
  </p>

  <textarea
    bind:value={pgn}
    rows="8"
    placeholder="Paste PGN here…"
    style="width:100%;font-family:monospace;font-size:0.85rem"
  ></textarea>

  <div class="row">
    <label style="flex:1">
      Your name in the PGN (optional)
      <input bind:value={playerName} placeholder="e.g. You" />
    </label>
    <label>
      You played
      <select bind:value={colorChoice}>
        <option value="auto">Auto-detect</option>
        <option value="w">White</option>
        <option value="b">Black</option>
      </select>
    </label>
  </div>

  <div class="row">
    <button onclick={analyze} disabled={status === 'analyzing' || pgn.trim().length === 0}>
      {status === 'analyzing' ? 'Analysing…' : 'Analyse'}
    </button>
    <button class="ghost" onclick={() => (pgn = SAMPLE)} disabled={status === 'analyzing'}>
      Load sample
    </button>
  </div>

  {#if status === 'analyzing'}
    <div class="panel">
      <p>Analysing position {progress} / {total}…</p>
      <div class="bar"><div class="bar-fill" style="width:{total ? (progress / total) * 100 : 0}%"></div></div>
    </div>
  {/if}

  {#if status === 'error'}
    <p class="feedback bad">Could not analyse: {error}</p>
  {/if}

  {#if notice}
    <p class="feedback">{notice}</p>
  {/if}

  {#if status === 'done' && result}
    <div class="panel col">
      <h3>Result</h3>
      <p class="muted">Analysed in {(elapsedMs / 1000).toFixed(1)}s ({result.movetimeMs}ms/ply)</p>
      <AnalysisResult analysis={result} {puzzlesMade} />
    </div>
  {/if}
</section>

<style>
  .bar { height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
  .bar-fill { height: 100%; background: var(--accent); transition: width 0.1s linear; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
