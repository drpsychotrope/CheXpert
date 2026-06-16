<script lang="ts">
  // Reusable, accessible, NON-BLOCKING confirm dialog (audit v2 W12/F5). Replaces native
  // confirm() — which blocks the JS event loop (freezing the rAF clock) and can't be themed or
  // translated. role=dialog + aria-modal, Escape cancels, focus is trapped and restored, the
  // primary action is autofocused. W14 will reuse this for the other confirm() sites + the promo picker.
  import { t } from '../i18n';
  interface Props {
    open: boolean;
    title: string;
    body?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Style the confirm button as destructive. */
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }
  let {
    open,
    title,
    body = '',
    confirmLabel,
    cancelLabel,
    danger = false,
    onConfirm,
    onCancel,
  }: Props = $props();
  // Defaults resolve through t() at render so they follow the live locale (W18).
  const confirmText = $derived(confirmLabel ?? t('common.ok'));
  const cancelText = $derived(cancelLabel ?? t('common.cancel'));

  let card = $state<HTMLDivElement | undefined>(undefined);
  let confirmBtn = $state<HTMLButtonElement | undefined>(undefined);
  let restoreTo: HTMLElement | null = null;

  // On open: remember the previously focused element, focus the primary action. On close: restore.
  $effect(() => {
    if (open) {
      restoreTo = document.activeElement as HTMLElement | null;
      confirmBtn?.focus();
    } else if (restoreTo) {
      restoreTo.focus();
      restoreTo = null;
    }
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Tab' && card) {
      const btns = [...card.querySelectorAll<HTMLElement>('button')];
      if (btns.length === 0) return;
      const first = btns[0];
      const last = btns[btns.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
</script>

{#if open}
  <div
    class="cd-overlay"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}
  >
    <div
      class="cd-card"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      bind:this={card}
      onkeydown={onKeydown}
    >
      <h3 class="cd-title">{title}</h3>
      {#if body}<p class="cd-body">{body}</p>{/if}
      <div class="cd-actions">
        <button type="button" class="ghost" onclick={onCancel}>{cancelText}</button>
        <button type="button" class="cd-confirm" class:danger bind:this={confirmBtn} onclick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .cd-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
  }
  .cd-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.2rem 1.4rem;
    max-width: 420px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  }
  .cd-title {
    margin: 0 0 0.5rem;
    font-size: 1.05rem;
    color: var(--text);
  }
  .cd-body {
    margin: 0 0 1rem;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.4;
  }
  .cd-actions {
    display: flex;
    gap: 0.6rem;
    justify-content: flex-end;
  }
  .cd-confirm.danger {
    background: var(--bad, #c0392b);
    color: #fff;
  }
</style>
