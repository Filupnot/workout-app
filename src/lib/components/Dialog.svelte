<script lang="ts">
  import type { Snippet } from 'svelte';
  let { open = $bindable(), label, children, onclose }: { open: boolean; label: string; children: Snippet; onclose?: () => void } = $props();
  let dialog: HTMLDialogElement;
  $effect(() => { if (open && !dialog.open) dialog.showModal(); else if (!open && dialog.open) dialog.close(); });
</script>

<dialog bind:this={dialog} aria-label={label} onclose={() => { open = false; onclose?.(); }}>
  <div class="sheet">{@render children()}</div>
</dialog>
