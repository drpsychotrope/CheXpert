<script lang="ts">
  // Shared "Play as" picker (ADR-0047). Bindable ColorChoice; reused by Play,
  // Coach, and Onboarding. Matches the existing Play <select> control styling.
  import type { ColorChoice } from '../game/color';
  import { t } from '../i18n';
  interface Props { value: ColorChoice; disabled?: boolean; }
  let { value = $bindable(), disabled = false }: Props = $props();
</script>

<label class="muted" style="font-size:0.85rem">
  {t('color.playAs')}
  <select bind:value {disabled}>
    <option value="white">{t('color.white')}</option>
    <option value="black">{t('color.black')}</option>
    <option value="random">{t('color.random')}</option>
  </select>
</label>
