<script lang="ts">
  // Minimal local opening explorer (spec B / ADR-0028): type moves, get the named
  // line + book continuations from the bundled ECO table. No game-frequency stats
  // (that's a follow-up needing a stats DB).
  import { onMount } from 'svelte';
  import { Chess } from 'chess.js';
  import { loadEco, nameOpening, type EcoEntry, type OpeningName } from '../opening/eco';

  let input = $state('1. e4 c5 2. Nf3 d6');
  let table: EcoEntry[] = [];
  let named = $state<OpeningName | null>(null);
  let conts = $state<EcoEntry[]>([]);
  let err = $state('');
  let done = $state(false);

  onMount(async () => {
    table = await loadEco();
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
        err = `Illegal move: ${tok}`;
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
  <h2>Opening explorer</h2>
  <p class="muted">Type moves (SAN) to name the line and see book continuations.</p>
  <textarea bind:value={input} rows="2" style="width:100%;font-family:monospace;font-size:0.9rem"></textarea>
  <div class="row"><button onclick={look}>Look up</button></div>

  {#if err}
    <p class="feedback bad">{err}</p>
  {:else if done && named}
    <p>Line: <b>{named.name}</b> <span class="muted">({named.eco})</span></p>
  {:else if done}
    <p class="muted">Not in the seed book (run <code>npm run etl:eco</code> for the full set).</p>
  {/if}

  {#if conts.length}
    <h4>Book continuations</h4>
    <ul>
      {#each conts as c (c.name)}<li>{c.name} <span class="muted">({c.eco})</span></li>{/each}
    </ul>
  {/if}
</section>
