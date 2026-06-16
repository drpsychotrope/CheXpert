<script lang="ts">
  // Win-probability sparkline for an analysed game (ADR-0021). Inline SVG — no
  // charting dependency. Player-POV curve; markers on mistakes/blunders, player vs
  // opponent distinguished; click/Enter selects a ply. NO global accuracy grade.
  import type { GameAnalysis } from '../analysis/types';
  import { winCurve } from '../analysis/criticalMoments';
  import { t, fmtPct } from '../i18n';

  interface Props {
    analysis: GameAnalysis;
    selected?: number | null;
    onSelect?: (plyIndex: number) => void;
  }
  let { analysis, selected = null, onSelect }: Props = $props();

  const W = 600;
  const H = 120;
  const PAD = 8;

  const curve = $derived(winCurve(analysis));
  const n = $derived(curve.length);

  function x(i: number): number {
    if (n <= 1) return PAD;
    return PAD + (i / (n - 1)) * (W - 2 * PAD);
  }
  function y(winPct: number): number {
    return PAD + (1 - winPct / 100) * (H - 2 * PAD);
  }

  const linePoints = $derived(curve.map((p) => `${x(p.plyIndex)},${y(p.winPct)}`).join(' '));

  // Markers: the player's and opponent's significant errors.
  const markers = $derived(
    analysis.plies
      .map((p, i) => ({ i, p }))
      .filter(({ p }) => p.severity === 'mistake' || p.severity === 'blunder')
      .map(({ i, p }) => ({
        i,
        cx: x(i),
        cy: y(curve[i].winPct),
        severity: p.severity,
        side: p.color === analysis.playerColor ? 'player' : 'opponent',
        label: t('evalGraph.markerLabel', { move: p.moveNumber, san: p.san, severity: p.severity, pct: fmtPct(p.winProbLoss) }),
      })),
  );

  function pick(i: number) {
    onSelect?.(i);
  }
</script>

<figure class="eval-graph">
  <svg viewBox="0 0 {W} {H}" role="img" aria-label={t('evalGraph.ariaLabel')}>
    <!-- 50% reference line -->
    <line x1={PAD} y1={y(50)} x2={W - PAD} y2={y(50)} class="mid" />
    {#if n > 1}
      <polyline points={linePoints} class="curve" fill="none" />
    {/if}
    {#each markers as m (m.i)}
      <circle
        cx={m.cx}
        cy={m.cy}
        r={selected === m.i ? 6 : 4}
        class="marker {m.severity} {m.side} {selected === m.i ? 'sel' : ''}"
        role="button"
        tabindex="0"
        aria-label={m.label}
        onclick={() => pick(m.i)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && pick(m.i)}
      />
    {/each}
  </svg>
  <figcaption class="muted">
    {t('evalGraph.caption')}
  </figcaption>
</figure>

<style>
  .eval-graph { margin: 0; }
  svg { width: 100%; height: auto; display: block; background: var(--panel-2); border-radius: 6px; }
  .mid { stroke: var(--border); stroke-width: 1; stroke-dasharray: 4 4; }
  .curve { stroke: var(--accent); stroke-width: 2; }
  .marker { cursor: pointer; stroke-width: 2; }
  .marker.blunder { fill: var(--bad); stroke: var(--bad); }
  .marker.mistake { fill: var(--accent); stroke: var(--accent); }
  .marker.opponent { fill: var(--panel-2); }
  .marker.sel { stroke: var(--text); }
  .marker:focus { outline: 2px solid var(--text); outline-offset: 1px; }
  figcaption { font-size: 0.75rem; margin-top: 0.3rem; }
</style>
