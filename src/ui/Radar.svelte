<script lang="ts">
  // Minimal dependency-free SVG radar chart for the weakness dimensions.
  import type { DimensionScore } from '../analysis/weakness';
  import { t } from '../i18n';

  interface Props {
    dimensions: DimensionScore[];
    size?: number;
  }
  let { dimensions, size = 320 }: Props = $props();

  const cx = $derived(size / 2);
  const cy = $derived(size / 2);
  const r = $derived(size * 0.36);

  // Dimension labels resolve through the bilingual catalogue (dimShort.* — abbreviated for
  // the chart), so the radar follows the language switch and stays single-sourced (V2-W18).
  function point(i: number, value01: number): [number, number] {
    const n = dimensions.length;
    const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI;
    return [cx + r * value01 * Math.cos(angle), cy + r * value01 * Math.sin(angle)];
  }

  const polygon = $derived(
    // Unmeasured axes (sampleSize 0) collapse to the centre so the filled shape never implies a
    // measurement at the expectation ring (audit v2 L17 — completes PR #21's honest no-data axes).
    dimensions
      .map((d, i) => point(i, d.sampleSize === 0 ? 0.02 : Math.max(0.02, d.score / 100)).join(','))
      .join(' '),
  );
  const baseline = $derived(dimensions.map((_, i) => point(i, 0.5).join(',')).join(' '));
  const rings = [0.25, 0.5, 0.75, 1];
</script>

<svg viewBox="0 0 {size} {size}" width={size} height={size} class="radar">
  {#each rings as ring}
    <polygon
      points={dimensions.map((_, i) => point(i, ring).join(',')).join(' ')}
      class="ring"
    />
  {/each}
  <!-- 50% = level-band expectation -->
  <polygon points={baseline} class="baseline" />
  <polygon points={polygon} class="value" />
  {#each dimensions as d, i}
    {@const na = d.sampleSize === 0}
    {@const [lx, ly] = point(i, 1.18)}
    <!-- PR-10/F18 (ADR-0068): the stored plain-language `detail` + sample size, surfaced as a
         native SVG tooltip on hover/focus — the honesty data was computed all along. -->
    <text x={lx} y={ly} class="label" class:na text-anchor="middle" dominant-baseline="middle">
      <title>{na ? t('radar.noData') : `${d.detail} (n=${d.sampleSize})`}</title>
      {t('dimShort.' + d.dimension)}
      {#if na}<tspan x={lx} dy="1.15em" class="na-tag">n/a</tspan>{/if}
    </text>
    {@const [dx, dy] = point(i, na ? 0.02 : d.score / 100)}
    <circle cx={dx} cy={dy} r="3" class="dot" class:na>
      <title>{na ? t('radar.noData') : `${d.detail} (n=${d.sampleSize})`}</title>
    </circle>
  {/each}
</svg>

<style>
  .radar { display: block; margin: 0 auto; max-width: 100%; }
  .ring { fill: none; stroke: var(--border); stroke-width: 1; opacity: 0.5; }
  .baseline { fill: none; stroke: var(--muted); stroke-width: 1; stroke-dasharray: 4 3; opacity: 0.7; }
  .value { fill: color-mix(in srgb, var(--accent) 30%, transparent); stroke: var(--accent); stroke-width: 2; }
  .dot { fill: var(--accent); }
  .dot.na { fill: transparent; stroke: var(--muted); stroke-width: 1.5; }
  .label { fill: var(--text); font-size: 12px; }
  .label.na { fill: var(--muted); }
  .na-tag { fill: var(--muted); font-size: 9px; letter-spacing: 0.5px; }
</style>
