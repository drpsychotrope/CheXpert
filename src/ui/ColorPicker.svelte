<script lang="ts">
  // Shared "Play as" picker (ADR-0047). Bindable ColorChoice; reused by Play,
  // Coach, and Onboarding. Matches the existing Play <select> control styling.
  import type { ColorChoice } from '../game/color';
  interface Props { value: ColorChoice; disabled?: boolean; }
  let { value = $bindable(), disabled = false }: Props = $props();
</script>

<label class="muted" style="font-size:0.85rem">
  Play as:
  <select bind:value {disabled}>
    <option value="white">White</option>
    <option value="black">Black</option>
    <option value="random">Random</option>
  </select>
</label>
