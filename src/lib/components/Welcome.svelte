<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  let { app }: { app: WorkoutApp } = $props();
</script>

<main class="welcome">
  <span class="brand-mark" aria-hidden="true">w.</span>
  <section class="welcome-copy">
    {#if app.phase === 'loading'}
      <h1>Workout<span class="accent">.</span></h1>
    {:else if app.phase === 'denied'}
      <h1>No access<span class="accent">.</span></h1>
      <p class="subtle">This Google account isn't allowed.</p>
      <button class="primary" onclick={() => app.denySignOut()} disabled={app.busy}>Use another account</button>
    {:else}
      <h1>Workout<span class="accent">.</span></h1>
      {#if app.configured}
        <button class="primary" onclick={() => app.signIn()} disabled={app.busy}>Continue with Google</button>
      {:else}
        <p class="subtle">Sign-in isn't configured.</p>
      {/if}
      {#if app.previewAllowed}<button class="secondary" onclick={() => app.openPreview()} disabled={app.busy}>Open local preview</button>{/if}
    {/if}
    {#if app.error}<p class="error-text" role="alert">{app.error}</p>{/if}
  </section>
</main>
