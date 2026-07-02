<script lang="ts">
  import { onMount } from 'svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { MASTER_GAMES, type MasterGame } from '../guess/games';
  import { GuessGame } from '../guess/guess';
  import { getAllGames, getAnalyzedGameIds, getAnalysis } from '../store/gamesRepo';
  import { explainPly } from '../analysis/explain';
  import type { GameRecord } from '../store/db';
  import type { GameAnalysis, PlyAnalysis } from '../analysis/types';
  import { t, fmtPct, getLocale } from '../i18n';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  let mode = $state<'pick' | 'play'>('pick');
  let chosen = $state<MasterGame | null>(null);
  let guess = $state<GuessGame | null>(null);
  let display = $state(new ChessGame());
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | null>(null);
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');
  // PR-14 (ADR-0072): guess-the-move on YOUR OWN analysed games. The stored per-ply analysis
  // enriches each reveal: when the move you originally played was classified a mistake, the
  // feedback says so and shows the stored better-move line — prediction practice ON your history.
  let ownGames = $state<Array<{ rec: GameRecord; analysis: GameAnalysis }>>([]);
  let ownActive = $state<GameAnalysis | null>(null);

  const OWN_PICKER_MAX = 10;

  onMount(async () => {
    try {
      const [games, analyzedIds] = await Promise.all([getAllGames(), getAnalyzedGameIds()]);
      const candidates = games
        .filter((g) => analyzedIds.has(g.id) && (g.variant ?? 'standard') === 'standard')
        .slice(-OWN_PICKER_MAX)
        .reverse(); // newest first
      const withAnalyses = await Promise.all(
        candidates.map(async (rec) => ({ rec, analysis: await getAnalysis(rec.id) })),
      );
      ownGames = withAnalyses.filter((x): x is { rec: GameRecord; analysis: GameAnalysis } => !!x.analysis);
    } catch {
      ownGames = []; // storage hiccup — the master games still work
    }
  });

  function start(g: MasterGame) {
    chosen = g;
    ownActive = null;
    guess = new GuessGame(g.pgn, g.guessColor);
    sync();
    feedback = g.guessColor === 'w' ? t('guess.youAreWhite') : t('guess.youAreBlack');
    feedbackKind = '';
    mode = 'play';
  }

  /** PR-14: replay one of your own analysed games — you guess YOUR side's moves. */
  function startOwn(rec: GameRecord, analysis: GameAnalysis) {
    const color = rec.playerColor ?? analysis.playerColor;
    chosen = null;
    ownActive = analysis;
    guess = new GuessGame(rec.pgn, color);
    sync();
    feedback = color === 'w' ? t('guess.youAreWhite') : t('guess.youAreBlack');
    feedbackKind = '';
    mode = 'play';
  }

  /** The stored classification of the ply that was just guessed/revealed (own games only). */
  function ownSeverityNote(ply: PlyAnalysis | null): string {
    if (!ownActive || !ply) return '';
    const stored = ownActive.plies[ply.ply];
    if (!stored || (stored.severity !== 'inaccuracy' && stored.severity !== 'mistake' && stored.severity !== 'blunder')) return '';
    const ex = explainPly(stored, getLocale());
    return ` ${t('guess.ownWasClassified', { severity: stored.severity })}${ex.better ? ` ${ex.better}` : ''}`;
  }

  function fmtOwnDate(ms: number): string {
    return new Intl.DateTimeFormat(getLocale() === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium' }).format(new Date(ms));
  }

  function sync() {
    if (!guess) return;
    display = new ChessGame(guess.fen());
    fen = display.fen;
  }

  function side(): 'white' | 'black' {
    // Works for both sources: the driver knows the guess side (PR-14).
    return guess?.guessColor === 'b' ? 'black' : 'white';
  }

  function onMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (!guess || guess.done) return;
    const uci = from + to + (display.isPromotion(from, to) ? promo : '');
    const before = guess.fen();
    const exp = guess.expected(); // PR-14: captured before the driver advances
    const res = guess.guess(uci);
    if (res === 'wrong') {
      feedback = t('guess.wrong');
      feedbackKind = 'bad';
      display = new ChessGame(before); // no advance
      fen = display.fen;
      return;
    }
    sync();
    lastMove = [from, to];
    feedback = guess.done
      ? t('guess.gameOverScored', { score: guess.score, guesses: guess.guesses, pct: fmtPct(guess.accuracy() * 100) })
      : t('guess.correct') + ownSeverityNote(exp as PlyAnalysis | null);
    feedbackKind = 'good';
  }

  function reveal() {
    if (!guess || guess.done) return;
    const shown = guess.reveal();
    sync();
    if (shown) {
      lastMove = [shown.uci.slice(0, 2), shown.uci.slice(2, 4)];
      feedback = t('guess.theMoveWas', { san: shown.san }) + ownSeverityNote(shown as PlyAnalysis | null);
      feedbackKind = '';
    }
    if (guess.done) feedback = t('guess.gameOver', { score: guess.score, guesses: guess.guesses });
  }
</script>

<section class="col center">
  <h2>{t('guess.title')}</h2>
  <p class="muted" style="max-width:560px">
    {t('guess.intro')}
  </p>

  {#if mode === 'pick'}
    <!-- PR-14 (ADR-0072): your own analysed games first — replay yourself, see which of your
         moves the analysis disliked, then the classics below. -->
    {#if ownGames.length}
      <h3 style="color:var(--muted);margin:0.4rem 0 0">{t('guess.ownTitle')}</h3>
      <div class="games">
        {#each ownGames as og (og.rec.id)}
          <button class="game-card" onclick={() => startOwn(og.rec, og.analysis)}>
            <b>{fmtOwnDate(og.rec.playedAt)}</b>
            <span class="muted">{t('guess.ownCard', {
              result: og.rec.result === 'win' ? t('history.resultWin') : og.rec.result === 'loss' ? t('history.resultLoss') : t('history.resultDraw'),
              elo: og.rec.botElo,
            })}</span>
            <span class="muted note">{t('guess.ownNote', { acpl: og.analysis.acpl })}</span>
          </button>
        {/each}
      </div>
      <h3 style="color:var(--muted);margin:0.6rem 0 0">{t('guess.mastersTitle')}</h3>
    {/if}
    <div class="games">
      {#each MASTER_GAMES as g}
        <button class="game-card" onclick={() => start(g)}>
          <b>{g.name}</b>
          <span class="muted">{t('guess.versus', { white: g.white, black: g.black })}</span>
          <span class="muted note">{g.note}</span>
        </button>
      {/each}
    </div>
  {:else if mode === 'play' && guess && (chosen || ownActive)}
    <p class="muted">
      {#if chosen}
        {t('guess.header', { name: chosen.name, white: chosen.white, black: chosen.black, score: guess.score, guesses: guess.guesses })}
      {:else}
        {t('guess.ownHeader', { score: guess.score, guesses: guess.guesses })}
      {/if}
    </p>
    <div class="board-wrap">
      <Board
        {fen}
        orientation={side()}
        turnColor={display.turn === 'w' ? 'white' : 'black'}
        showTurn={!guess.done}
        turnLabel="play"
        movableColor={guess.done ? undefined : side()}
        dests={guess.done ? new Map() : display.dests()}
        {lastMove}
        check={display.inCheck()}
        {onMove}
        onMoveText={(text) => {
          if (!guess || guess.done) return false;
          const r = display.resolveMove(text);
          if (!r) return false;
          onMove(r.from, r.to, r.promo ?? 'q');
          return true;
        }}
      />
    </div>
    <p class="feedback {feedbackKind}">{feedback}</p>
    <div class="row center">
      {#if !guess.done}
        <button class="ghost" onclick={reveal}>{t('guess.revealMove')}</button>
      {/if}
      <button class="ghost" onclick={() => (mode = 'pick')}>{t('guess.backToGames')}</button>
    </div>
  {/if}
</section>

<style>
  .games { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; max-width: 720px; }
  .game-card { display: flex; flex-direction: column; gap: 0.3rem; text-align: left; align-items: flex-start; background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 0.8rem 1rem; border-radius: 10px; cursor: pointer; }
  .game-card .muted { font-size: 0.8rem; font-weight: 400; }
  .game-card .note { font-style: italic; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
