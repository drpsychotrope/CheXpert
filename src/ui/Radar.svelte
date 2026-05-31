<script lang="ts">
  // Minimal dependency-free SVG radar chart for the weakness dimensions.
  import type { DimensionScore } from '../analysis/weakness';

  interface Props {
    dimensions: DimensionScore[];
    size?: number;
  }
  let { dimensions, size = 320 }: Props = $props();

  const cx = $derived(size / 2);
  const cy = $derived(size / 2);
  const r = $derived(size * 0.36);

  const labels: Record<string, string> = {
    tactics: 'Tactics',
    openingAccuracy: 'Opening',
    endgameConversion: 'Endgame',
    timeManagement: 'Time',
    resilience: 'Resilience',
  };

  function point(i: number, value01: number): [number, number] {
    const n = dimensions.length;
    const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI;
    return [cx + r * value01 * Math.cos(angle), cy + r * value01 * Math.sin(angle)];
  }

  const polygon = $derived(
    dimensions.map((d, i) => point(i, Math.max(0.02, d.score / 100)).join(',')).join(' '),
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
    {@const [lx, ly] = point(i, 1.18)}
    <text x={lx} y={ly} class="label" text-anchor="middle" dominant-baseline="middle">
      {labels[d.dimension] ?? d.dimension}
    </text>
    {@const [dx, dy] = point(i, d.score / 100)}
    <circle cx={dx} cy={dy} r="3" class="dot" />
  {/each}
</svg>

<style>
  .radar { display: block; margin: 0 auto; max-width: 100%; }
  .ring { fill: none; stroke: var(--border); stroke-width: 1; opacity: 0.5; }
  .baseline { fill: none; stroke: var(--muted); stroke-width: 1; stroke-dasharray: 4 3; opacity: 0.7; }
  .value { fill: color-mix(in srgb, var(--accent) 30%, transparent); stroke: var(--accent); stroke-width: 2; }
  .dot { fill: var(--accent); }
  .label { fill: var(--text); font-size: 12px; }
</style>
