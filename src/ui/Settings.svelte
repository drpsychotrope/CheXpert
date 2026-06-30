<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clearAllData, DEFAULT_DAILY_GOAL } from '../store/playerModel';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { coachProfileFilename } from '../coach/funnel';
  import { downloadText } from './pgnDownload';
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
  let confirmKind = $state<null | 'network' | 'wipe'>(null);

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
    }
  }
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
    <button onclick={wipe} style="background:var(--bad)">{t('settings.deleteData')}</button>
  </div>

  <ConfirmDialog
    open={confirmKind !== null}
    title={confirmKind === 'wipe' ? t('settings.wipeTitle') : t('settings.allowTitle')}
    body={confirmKind === 'wipe' ? t('settings.wipeBody') : t('settings.allowBody')}
    confirmLabel={confirmKind === 'wipe' ? t('settings.wipeConfirm') : t('settings.allowConfirm')}
    danger={confirmKind === 'wipe'}
    onConfirm={onConfirm}
    onCancel={() => (confirmKind = null)}
  />
</section>
