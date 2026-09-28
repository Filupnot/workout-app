<script lang="ts">
  import type { Snippet } from 'svelte';
  let { open = $bindable(), label, children, onclose }: { open: boolean; label: string; children: Snippet; onclose?: () => void } = $props();
  let dialog: HTMLDialogElement;
  // Focus the sheet itself on open, rather than outlining its first button.
  $effect(() => { if (open && !dialog.open) { dialog.showModal(); dialog.focus(); } else if (!open && dialog.open) dialog.close(); });
</script>

<dialog bind:this={dialog} tabindex="-1" aria-label={label} onclose={() => { open = false; onclose?.(); }}>
  <div class="sheet">{@render children()}</div>
</dialog>
