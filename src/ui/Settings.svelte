<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clearAllData } from '../store/playerModel';

  const settings = $derived(app.settings);

  async function toggleCoached() {
    if (!settings) return;
    settings.coachedMode = !settings.coachedMode;
    await app.persistSettings();
  }

  async function wipe() {
    const ok = confirm(
      'This permanently deletes ALL local data: your ratings, games, puzzle history, and settings. This cannot be undone. Continue?',
    );
    if (!ok) return;
    await clearAllData();
    location.reload();
  }
</script>

<section class="col" style="max-width:560px;margin:0 auto">
  <h2>Settings</h2>

  <div class="panel col">
    <h3>Coaching</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.coachedMode ?? false} onchange={toggleCoached} />
      Coached mode — warn me before an obvious blunder while playing
    </label>
    <p class="muted" style="font-size:0.85rem">
      Best-effort in Phase 1 (a quick engine check). Full pre-move gaffe alerts + mandatory post-game
      review come with Phase 2.
    </p>
  </div>

  <div class="panel col">
    <h3>Privacy</h3>
    <p class="muted">
      Everything stays on this device. Your games, puzzle history, and player model live in your
      browser's IndexedDB. Nothing is sent anywhere.
      {#if settings && !settings.allowNetwork}<br /><b>Network: off</b> (default).{/if}
    </p>
    <p class="muted" style="font-size:0.85rem">
      (The Syzygy endgame trainer in Phase 3 will be the only feature that makes a network call — and
      only with your consent.)
    </p>
  </div>

  <div class="panel col">
    <h3>Your data</h3>
    <button onclick={() => app.go('onboarding')} style="background:var(--panel-2)">Re-run skill evaluation</button>
    <button onclick={wipe} style="background:var(--bad)">Delete all my data</button>
  </div>
</section>
