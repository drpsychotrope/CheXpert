<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clearAllData, DEFAULT_DAILY_GOAL } from '../store/playerModel';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { coachProfileFilename } from '../coach/funnel';
  import { downloadText } from './pgnDownload';
  import { exportAll, importAll, validateBackup, backupFilename, type BackupFile, type BackupError } from '../store/backup';
  import { setSoundEnabled, playSound } from './sound';
  import { t, getLocale, type Locale } from '../i18n';

  const settings = $derived(app.settings);
  const model = $derived(app.model);

  async function changeLocale(e: Event) {
    await app.setLocale((e.currentTarget as HTMLSelectElement).value as Locale);
  }

  // T3/TR8: the daily puzzle goal (Q-E, default 10). Persisted on the player model via the
  // existing atomic write; clamped to a sane floor so the progress readout never divides oddly.
  async function changeDailyGoal(e: Event) {
    if (!model) return;
    const n = Math.round(Number((e.currentTarget as HTMLInputElement).value));
    model.dailyGoal = Number.isFinite(n) && n >= 1 ? n : DEFAULT_DAILY_GOAL;
    await app.persistModel(Date.now());
  }
  // Themed, non-blocking confirmations instead of native confirm() (audit v2 W14/H39).
  let confirmKind = $state<null | 'network' | 'wipe' | 'import'>(null);

  // PR-01 data-backup (ADR-0059): full-profile export + replace-everything restore.
  // The parsed+validated backup waits here while the ConfirmDialog asks; Date.now() stays at
  // this boundary (AP-BACKUP-5) and the DOM file-read stays out of the store core.
  let pendingBackup = $state<BackupFile | null>(null);
  let importError = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  const IMPORT_ERR_KEY: Record<BackupError, string> = {
    'not-a-backup': 'settings.importErrNotBackup',
    'newer-schema': 'settings.importErrNewer',
    malformed: 'settings.importErrMalformed',
  };

  async function exportBackup() {
    const now = Date.now();
    downloadText(await exportAll(now), backupFilename(now));
  }

  async function onBackupFile(e: Event) {
    importError = '';
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = ''; // re-selecting the same file re-fires change
    if (!file) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      importError = t('settings.importErrNotBackup');
      return;
    }
    const v = validateBackup(parsed);
    if (!v.ok) {
      importError = t(IMPORT_ERR_KEY[v.error]);
      return;
    }
    pendingBackup = v.backup;
    confirmKind = 'import';
  }

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

  // P1 (play-loop-closure §4.6): opt-in auto-analyse of the just-finished game.
  async function toggleAutoAnalyze() {
    if (!settings) return;
    settings.autoAnalyzeOnFinish = !(settings.autoAnalyzeOnFinish ?? false);
    await app.persistSettings();
  }

  // P2 (play-in-game-ux): opt-in on-demand takeback during a normal game (ADR-0058). A takeback in a
  // rated game forfeits the rating for that game (the help text states this).
  async function toggleTakeback() {
    if (!settings) return;
    settings.takebackInPlay = !(settings.takebackInPlay ?? false);
    await app.persistSettings();
  }

  // PR-05 (ADR-0063): the sound kill-switch (Q-F=a — ON by default). The module flag is synced
  // here AND at boot so playSound sites never read Settings themselves.
  async function toggleSound() {
    if (!settings) return;
    const next = !(settings.soundEnabled ?? true);
    settings.soundEnabled = next;
    setSoundEnabled(next);
    if (next) playSound('move'); // audible confirmation the switch works
    await app.persistSettings();
  }

  async function toggleNetwork(e: Event) {
    if (!settings) return;
    const wantOn = (e.currentTarget as HTMLInputElement).checked;
    if (wantOn) {
      // Revert the optimistic check and ask first; enable only on confirm.
      (e.currentTarget as HTMLInputElement).checked = false;
      confirmKind = 'network';
      return;
    }
    settings.allowNetwork = false;
    await app.persistSettings();
  }

  function wipe() {
    confirmKind = 'wipe';
  }

  // CF10: export the saved coach profile as a JSON snapshot from Settings → Your data. Same client-
  // side, lossless export as the Coach result panel (JSON.stringify verbatim — AP-CFUNNEL-6), via the
  // shared downloadText primitive (FOLD-C6); filename derived from assessedAt (pure helper).
  function exportCoachProfile() {
    const p = model?.coachProfile;
    if (!p) return;
    downloadText(JSON.stringify(p, null, 2), coachProfileFilename(p.assessedAt));
  }

  async function onConfirm() {
    const kind = confirmKind;
    confirmKind = null;
    if (kind === 'network') {
      if (!settings) return;
      settings.allowNetwork = true;
      await app.persistSettings();
    } else if (kind === 'wipe') {
      await clearAllData();
      location.reload();
    } else if (kind === 'import') {
      if (!pendingBackup) return;
      await importAll(pendingBackup);
      pendingBackup = null;
      // Reload so every in-memory state (model, settings, caches) rehydrates from the restored
      // stores — the exact pattern the wipe uses.
      location.reload();
    }
  }

  // Dialog copy per kind (3 states now — the binary ternaries stopped scaling).
  const dialogTitle = $derived(
    confirmKind === 'wipe' ? t('settings.wipeTitle')
    : confirmKind === 'import' ? t('settings.importTitle')
    : t('settings.allowTitle'),
  );
  const dialogBody = $derived(
    confirmKind === 'wipe' ? t('settings.wipeBody')
    : confirmKind === 'import' ? t('settings.importBody')
    : t('settings.allowBody'),
  );
  const dialogConfirm = $derived(
    confirmKind === 'wipe' ? t('settings.wipeConfirm')
    : confirmKind === 'import' ? t('settings.importConfirm')
    : t('settings.allowConfirm'),
  );
</script>

<section class="col" style="max-width:560px;margin:0 auto">
  <h2>{t('settings.title')}</h2>

  <div class="panel col">
    <h3>{t('settings.language')}</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      {t('settings.languageLabel')}
      <select value={getLocale()} onchange={changeLocale}>
        <option value="fr">{t('settings.languageFr')}</option>
        <option value="en">{t('settings.languageEn')}</option>
      </select>
    </label>
  </div>

  <div class="panel col">
    <h3>{t('settings.coaching')}</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.coachedMode ?? false} onchange={toggleCoached} />
      {t('settings.coachedLabel')}
    </label>
    <p class="muted" style="font-size:0.85rem">{t('settings.coachedHint')}</p>
  </div>

  <div class="panel col">
    <h3>{t('settings.metacog')}</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.metacogEnabled ?? false} onchange={toggleMetacog} />
      {t('settings.metacogLabel')}
    </label>
    <p class="muted" style="font-size:0.85rem">{t('settings.metacogHint')}</p>
  </div>

  <div class="panel col">
    <h3>{t('home.analyseGame')}</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.autoAnalyzeOnFinish ?? false} onchange={toggleAutoAnalyze} />
      {t('play.loop.autoAnalyzeLabel')}
    </label>
    <p class="muted" style="font-size:0.85rem">{t('play.loop.autoAnalyzeHelp')}</p>
  </div>

  <div class="panel col">
    <h3>{t('settings.play')}</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.takebackInPlay ?? false} onchange={toggleTakeback} />
      {t('settings.takebackInPlay')}
    </label>
    <p class="muted" style="font-size:0.85rem">{t('settings.takebackInPlayHelp')}</p>
  </div>

  <div class="panel col">
    <h3>{t('settings.sound')}</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.soundEnabled ?? true} onchange={toggleSound} />
      {t('settings.soundLabel')}
    </label>
    <p class="muted" style="font-size:0.85rem">{t('settings.soundHint')}</p>
  </div>

  <div class="panel col">
    <h3>{t('settings.training')}</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      {t('settings.dailyGoalLabel')}
      <input
        type="number"
        min="1"
        max="200"
        value={model?.dailyGoal ?? DEFAULT_DAILY_GOAL}
        onchange={changeDailyGoal}
        style="width:5rem"
      />
    </label>
    <p class="muted" style="font-size:0.85rem">{t('settings.dailyGoalHint')}</p>
  </div>

  <div class="panel col">
    <h3>{t('settings.privacy')}</h3>
    <p class="muted">{t('settings.privacyBody')}</p>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.allowNetwork ?? false} onchange={toggleNetwork} />
      {t('settings.networkLabel')}
    </label>
    <p class="muted" style="font-size:0.85rem">
      {t('settings.networkHint')}
      <br /><b>{t('settings.networkStatus', { state: settings?.allowNetwork ? t('settings.on') : t('settings.off') })}</b>
    </p>
  </div>

  <div class="panel col">
    <h3>{t('settings.yourData')}</h3>
    <button onclick={() => app.go('onboarding')} style="background:var(--panel-2)">{t('settings.rerunEval')}</button>
    <button class="ghost" onclick={() => app.go('coach')}>{t('settings.rerunCoach')}</button>
    <!-- CF10: export the coach profile as JSON — only when one exists (guarded). Client-side snapshot. -->
    {#if model?.coachProfile}
      <button class="ghost" onclick={exportCoachProfile}>{t('coach.exportProfile')}</button>
    {/if}
    <!-- PR-01 (ADR-0059): full-profile backup + restore. Restore = replace-everything after an
         explicit themed confirmation; a bad file surfaces a typed error, never a silent no-op. -->
    <button class="ghost" onclick={exportBackup}>{t('settings.exportAll')}</button>
    <p class="muted" style="font-size:0.85rem">{t('settings.exportAllHint')}</p>
    <button class="ghost" onclick={() => fileInput?.click()}>{t('settings.importAll')}</button>
    <input
      type="file"
      accept="application/json,.json"
      style="display:none"
      bind:this={fileInput}
      onchange={onBackupFile}
    />
    {#if importError}
      <p class="muted" style="font-size:0.85rem;color:var(--bad)">{importError}</p>
    {/if}
    <button onclick={wipe} style="background:var(--bad)">{t('settings.deleteData')}</button>
  </div>

  <ConfirmDialog
    open={confirmKind !== null}
    title={dialogTitle}
    body={dialogBody}
    confirmLabel={dialogConfirm}
    danger={confirmKind === 'wipe' || confirmKind === 'import'}
    onConfirm={onConfirm}
    onCancel={() => { confirmKind = null; pendingBackup = null; }}
  />
</section>
