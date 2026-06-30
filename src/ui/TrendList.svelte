<script lang="ts">
  // Coach progress-trend fragment (C1, spec §4.3). Directional only — arrow + absolute rating
  // delta + both sample sizes; NO grade, NO aggregate score (AP-CPROF-2). Reused on the intro
  // card (saved profile) AND the result screen (just-finished run), so it lives in its own file
  // (mirrors Radar.svelte). The low-sample marker reuses the existing dashboard.lowData key
  // (FOLD-2 / AP-CPROF-7 — no new i18n).
  import type { CoachTrend } from '../coach/coachTrend';
  import { t } from '../i18n';

  let { trend }: { trend: CoachTrend } = $props();
  const ARROW = { up: '↑', down: '↓', flat: '≈' } as const;
</script>

<div class="col" style="width:100%">
  <b>{t('coach.trendTitle')}</b>
  {#if trend.tacticsDir}
    {@const td = trend.tacticsDelta ?? 0}
    <span class="muted" style="font-size:0.82rem">{t('coach.trendTactics', { arrow: ARROW[trend.tacticsDir], delta: (td >= 0 ? '+' : '') + td })}</span>
  {/if}
  {#each trend.motifs as m}
    <span style="font-size:0.85rem">{ARROW[m.dir]} {t('motif.' + m.theme)} <span class="muted">{t('coach.trendMotif', { delta: (m.delta >= 0 ? '+' : '') + m.delta, nPrev: m.nPrev, nCurrent: m.nCurrent })}{#if m.lowData}{t('dashboard.lowData')}{/if}</span></span>
  {/each}
  <span class="muted" style="font-size:0.75rem">{t('coach.trendDisclaimer')}</span>
</div>
