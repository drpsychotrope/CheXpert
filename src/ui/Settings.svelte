<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clearAllData } from '../store/playerModel';

  const settings = $derived(app.settings);

  async function toggleCoached() {
    if (!settings) return;
    settings.coachedMode = !settings.coachedMode;
    await app.persistSettings();
  }

  async function toggleMetacog() {
    if (!settings) return;
    settings.metacogEnabled = !(settings.metacogEnabled ?? false);
    await app.persistSettings();
  }

  async function toggleNetwork(e: Event) {
    if (!settings) return;
    const wantOn = (e.currentTarget as HTMLInputElement).checked;
    if (wantOn) {
      const ok = confirm(
        'Allow network access?\n\nThis lets the Endgame trainer query the Lichess Syzygy tablebase ' +
          '(tablebase.lichess.ovh) for perfect endgame feedback. Only the board position (a FEN) is sent — ' +
          'no identity, no account, nothing else. Results are cached locally. You can turn this off any time.',
      );
      if (!ok) {
        (e.currentTarget as HTMLInputElement).checked = false;
        return;
      }
    }
    settings.allowNetwork = wantOn;
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
    <h3>Metacognition</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.metacogEnabled ?? false} onchange={toggleMetacog} />
      Track confidence & error cause on puzzles
    </label>
    <p class="muted" style="font-size:0.85rem">
      When on, Tactics and Calculation show optional chips: how sure you were (before the reveal) and,
      after a miss, why you think you missed. Insights then shows a descriptive calibration readout —
      how your confidence lines up with your results. Off by default; the chips are always skippable and
      never block solving.
    </p>
  </div>

  <div class="panel col">
    <h3>Privacy</h3>
    <p class="muted">
      Everything stays on this device. Your games, puzzle history, and player model live in your
      browser's IndexedDB. Nothing is sent anywhere by default.
    </p>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.allowNetwork ?? false} onchange={toggleNetwork} />
      Allow network for the Syzygy endgame tablebase
    </label>
    <p class="muted" style="font-size:0.85rem">
      The endgame trainer's perfect feedback comes from the Lichess Syzygy API. With this off, endgame
      drills still work against the engine — you just won't get tablebase-perfect move grading. When on,
      only the position (a FEN) is sent; results are cached so each position is fetched at most once.
      <br /><b>Network: {settings?.allowNetwork ? 'on' : 'off'}</b>
    </p>
  </div>

  <div class="panel col">
    <h3>Your data</h3>
    <button onclick={() => app.go('onboarding')} style="background:var(--panel-2)">Re-run skill evaluation</button>
    <button onclick={wipe} style="background:var(--bad)">Delete all my data</button>
  </div>
</section>
