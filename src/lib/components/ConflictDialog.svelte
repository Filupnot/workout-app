<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  import Dialog from './Dialog.svelte';
  let { app }: { app: WorkoutApp } = $props();
  let open = $state(false);
  $effect(() => { open = !!app.conflict; });
</script>

<Dialog bind:open label="Review sync conflict" onclose={() => (app.conflict = null)}>
  {#if app.conflict}
    {#if app.conflict.kind === 'conflict'}
      <h2>Two versions</h2>
      <p>Another device saved a change to this record before this device synced. Nothing has been overwritten. Choose which version to keep.</p>
    {:else}
      <h2>A change couldn't be saved online</h2>
      <p>The server rejected a change from this device as invalid. It is still saved here. Keep trying it, or use the online version.</p>
    {/if}
    <div class="compare">
      <section><h3>On this device</h3><ul>{#each app.conflict.local as line, i (i)}<li>{line}</li>{/each}</ul></section>
      <section><h3>Saved online</h3><ul>{#each app.conflict.server as line, i (i)}<li>{line}</li>{/each}</ul></section>
    </div>
    <button class="primary full" onclick={() => app.resolveConflict('local')} disabled={app.busy}>Keep this device's changes</button>
    <button class="secondary full" onclick={() => app.resolveConflict('server')} disabled={app.busy}>Use the online version</button>
    <button class="text-button full" onclick={() => (open = false)}>Decide later</button>
  {/if}
</Dialog>
