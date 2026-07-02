<script lang="ts">
  // Rating-over-time line chart (PR-04, ADR-0062). Presentational: the pure selectors in
  // analysis/progress.ts prepared the series; this draws one polyline in a 100×100 viewBox with
  // min/max anchors and the point count. No smoothing, no interpolation claims — dots mark the
  // real observations so a sparse series reads as sparse (doctrine honnêteté).
  import { toPolyline, type SeriesPoint } from '../analysis/progress';

  let { title, series, latestRd }: { title: string; series: SeriesPoint[]; latestRd?: number } = $props();

  const geom = $derived(toPolyline(series));
  const dots = $derived(
    !geom || series.length > 60
      ? [] // dense series: the line carries the shape; dots would smear
      : geom.points.split(' ').map((p) => {
          const [x, y] = p.split(',');
          return { x, y };
        }),
  );
</script>

{#if geom}
  <div class="chart">
    <div class="head">
      <span class="title">{title}</span>
      <span class="muted meta">{Math.round(series[series.length - 1].rating)}{latestRd != null ? ` ±${Math.round(latestRd)}` : ''} · n={series.length}</span>
    </div>
    <div class="plot-row">
      <div class="scale muted">
        <span>{geom.max}</span>
        <span>{geom.min}</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={geom.points} fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" />
        {#each dots as d (d.x + ',' + d.y)}
          <circle cx={d.x} cy={d.y} r="1.6" fill="var(--accent)" />
        {/each}
      </svg>
    </div>
  </div>
{/if}

<style>
  .chart {
    background: var(--panel);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.6rem;
    margin-bottom: 0.4rem;
  }
  .title {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .meta {
    font-size: 0.78rem;
  }
  .plot-row {
    display: flex;
    gap: 0.4rem;
    align-items: stretch;
  }
  .scale {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 0.7rem;
    text-align: right;
    min-width: 2.4rem;
  }
  svg {
    flex: 1;
    height: 84px;
    background: var(--panel-2);
    border-radius: 4px;
  }
</style>
