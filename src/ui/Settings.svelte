<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clearAllData } from '../store/playerModel';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { t, getLocale, type Locale } from '../i18n';

  const settings = $derived(app.settings);

  async function changeLocale(e: Event) {
    await app.setLocale((e.currentTarget as HTMLSelectElement).value as Locale);
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
