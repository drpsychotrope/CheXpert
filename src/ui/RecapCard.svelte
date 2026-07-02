<script lang="ts">
  // Shared recap-card primitive (PR-03, ADR-0061; reused by the session recap — roadmap I6).
  // Purely presentational: a titled panel of label/value rows + an optional muted note.
  // Rows with an empty value are skipped so callers can pass optional data unconditionally.
  interface Row {
    label: string;
    value: string;
  }
  let { title, rows, note = '' }: { title: string; rows: Row[]; note?: string } = $props();
</script>

<div class="panel recap">
  <h3>{title}</h3>
  <dl>
    {#each rows.filter((r) => r.value) as row (row.label)}
      <dt>{row.label}</dt>
      <dd>{row.value}</dd>
    {/each}
  </dl>
  {#if note}
    <p class="muted note">{note}</p>
  {/if}
</div>

<style>
  .recap {
    max-width: 420px;
    margin: 0.75rem auto 0;
    text-align: left;
  }
  .recap h3 {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.9rem;
    margin: 0;
  }
  dt {
    color: var(--muted);
    font-size: 0.85rem;
  }
  dd {
    margin: 0;
    font-size: 0.85rem;
  }
  .note {
    font-size: 0.78rem;
    margin: 0.6rem 0 0;
  }
</style>
