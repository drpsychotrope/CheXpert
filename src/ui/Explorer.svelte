<script lang="ts">
  // Minimal local opening explorer (spec B / ADR-0028): type moves, get the named
  // line + book continuations from the bundled ECO table. No game-frequency stats
  // (that's a follow-up needing a stats DB).
  import { onMount } from 'svelte';
  import { Chess } from 'chess.js';
  import { loadEco, nameOpening, localizedOpeningName, type EcoEntry, type OpeningName } from '../opening/eco';
  import { ownOpeningStats, type OwnOpeningStat } from '../opening/ownStats';
  import { getAllGames, getAnalyzedGameIds, getAnalysis } from '../store/gamesRepo';
  import { t, getLocale } from '../i18n';

  let input = $state('1. e4 c5 2. Nf3 d6');
  let table: EcoEntry[] = [];
  let named = $state<OpeningName | null>(null);
  let conts = $state<EcoEntry[]>([]);
  let err = $state('');
  let done = $state(false);
  // PR-15 (ADR-0073): YOUR results by opening — computed from analysed played games at load.
  let ownStats = $state<OwnOpeningStat[]>([]);

  onMount(async () => {
    table = await loadEco();
    try {
      const [games, analyzedIds] = await Promise.all([getAllGames(), getAnalyzedGameIds()]);
      const played = games.filter((g) => analyzedIds.has(g.id) && (g.variant ?? 'standard') === 'standard');
      const items = (
        await Promise.all(played.map(async (g) => ({ analysis: await getAnalysis(g.id), result: g.result })))
      ).filter((x): x is { analysis: NonNullable<typeof x.analysis>; result: typeof x.result } => !!x.analysis);
      ownStats = ownOpeningStats(items, table);
    } catch {
      ownStats = []; // storage hiccup — the explorer still works
    }
  });

  function look() {
    err = '';
    named = null;
    conts = [];
    done = true;
    const chess = new Chess();
    const uci: string[] = [];
    for (const tok of input.replace(/\d+\.(\.\.)?/g, '').trim().split(/\s+/)) {
      if (!tok) continue;
      try {
        const m = chess.move(tok);
        uci.push(m.from + m.to + (m.promotion ?? ''));
      } catch {
        err = t('explorer.illegalMove', { move: tok });
        return;
      }
    }
    named = nameOpening(uci, table);
    conts = table.filter(
      (e) => e.uci.length === uci.length + 1 && e.uci.slice(0, uci.length).every((m, i) => m === uci[i]),
    );
  }
</script>

<section class="col" style="max-width:560px;margin:0 auto">
  <h2>{t('explorer.title')}</h2>
  <p class="muted">{t('explorer.intro')}</p>
  <textarea bind:value={input} rows="2" style="width:100%;font-family:monospace;font-size:0.9rem"></textarea>
  <div class="row"><button onclick={look}>{t('explorer.lookUp')}</button></div>

  {#if err}
    <p class="feedback bad">{err}</p>
  {:else if done && named}
    <p>{t('explorer.line')} <b>{localizedOpeningName(named, getLocale())}</b> <span class="muted">({named.eco})</span></p>
  {:else if done}
    <p class="muted">{t('explorer.notInBookBefore')}<code>npm run etl:eco</code>{t('explorer.notInBookAfter')}</p>
  {/if}

  {#if conts.length}
    <h4>{t('explorer.bookContinuations')}</h4>
    <ul>
      {#each conts as c (c.name)}<li>{localizedOpeningName(c, getLocale())} <span class="muted">({c.eco})</span></li>{/each}
    </ul>
  {/if}

  <!-- PR-15 (ADR-0073): your own results by opening — which lines actually cost you points. -->
  {#if ownStats.length}
    <h4>{t('explorer.ownStatsTitle')}</h4>
    <div class="col" style="gap:0.25rem">
      {#each ownStats as s (s.eco + s.name)}
        <div class="row panel" style="justify-content:space-between;gap:0.8rem;font-size:0.85rem;padding:0.4rem 0.7rem">
          <span><b>{localizedOpeningName(s, getLocale())}</b> <span class="muted">({s.eco})</span></span>
          <span class="muted">{t('explorer.ownStatsLine', { score: s.scorePct, n: s.n, acpl: s.avgOpeningAcpl })}</span>
        </div>
      {/each}
    </div>
    <p class="muted" style="font-size:0.75rem">{t('explorer.ownStatsNote')}</p>
  {/if}
</section>
