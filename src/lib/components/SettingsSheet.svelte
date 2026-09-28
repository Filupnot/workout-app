<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  import type { Profile } from '$lib/domain/model';
  import Dialog from './Dialog.svelte';
  let { app, open = $bindable() }: { app: WorkoutApp; open: boolean } = $props();
  let leaving = $state(false);
</script>

<Dialog bind:open label="Settings" onclose={() => (leaving = false)}>
  {#if !leaving}
    <div class="card-heading"><h2>Settings</h2><button class="text-button" onclick={() => (open = false)}>Done</button></div>
    <label>Appearance
      <select value={app.profile.theme} onchange={e => app.updateProfile({ theme: e.currentTarget.value as Profile['theme'] })}>
        <option value="system">Match system</option><option value="dark">Dark</option><option value="light">Light</option>
      </select>
    </label>
    <label>Default weight unit
      <select value={app.profile.unit} onchange={e => app.updateProfile({ unit: e.currentTarget.value as Profile['unit'] })}>
        <option value="lb">Pounds (lb)</option><option value="kg">Kilograms (kg)</option>
      </select>
    </label>
    <label>Default rest (seconds)
      <input inputmode="numeric" value={app.profile.restSeconds} onchange={e => app.updateProfile({ restSeconds: Number(e.currentTarget.value) })} />
    </label>
    <label class="check">
      <input type="checkbox" checked={app.profile.sound} onchange={e => app.updateProfile({ sound: e.currentTarget.checked })} />
      <span>Soft sound when rest ends</span>
    </label>
    {#if app.profile.sound}<button class="secondary" onclick={() => app.testSound()}>Play test sound</button>{/if}
    <div class="sync-panel">
      <h3>Sync</h3>
      {#if app.preview}<p class="subtle">Preview (not synced)</p>
      {:else}
        <p class="subtle">{app.pendingCount ? `${app.pendingCount} change${app.pendingCount === 1 ? '' : 's'} waiting` : 'All synced'}</p>
        <button class="secondary" onclick={() => app.syncNow()} disabled={app.busy}>{app.status === 'signin' ? 'Sign in again' : app.status === 'conflict' || app.status === 'failed' ? 'Review changes' : 'Sync now'}</button>
      {/if}
    </div>
    <button class="secondary danger" onclick={() => (leaving = true)}>Sign out</button>
  {:else}
    <h2>Sign out of this device?</h2>
    <p class="subtle">Removes workout data from this device.</p>
    {#if app.pendingCount}<p class="warning">{app.pendingCount} change{app.pendingCount === 1 ? ' has' : 's have'} not synced yet.</p>{/if}
    {#if app.error}<p class="error-text" role="alert">{app.error}</p>{/if}
    <button class="primary full" onclick={() => app.signOut(false)} disabled={app.busy}>{app.pendingCount ? 'Sync, then sign out' : 'Sign out'}</button>
    {#if app.pendingCount}<button class="secondary danger full" onclick={() => app.signOut(true)} disabled={app.busy}>Discard unsynced changes and sign out</button>{/if}
    <button class="text-button full" onclick={() => (leaving = false)}>Stay signed in</button>
  {/if}
</Dialog>
