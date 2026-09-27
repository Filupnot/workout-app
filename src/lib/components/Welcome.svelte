<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  let { app }: { app: WorkoutApp } = $props();
</script>

<main class="welcome">
  <header class="brand"><span class="brand-mark" aria-hidden="true">w.</span><span>WORKOUT</span></header>
  <section class="welcome-copy">
    {#if app.phase === 'loading'}
      <p class="eyebrow">Opening</p>
      <h1>One moment<span class="accent">.</span></h1>
    {:else if app.phase === 'denied'}
      <p class="eyebrow">Private app</p>
      <h1>This account<br /><em>isn't on the list.</em></h1>
      <p class="intro">Workout is private. The Google account you used doesn't have access, and no workout data was shared with it.</p>
      <button class="primary" onclick={() => app.denySignOut()} disabled={app.busy}>Sign out and try another account</button>
    {:else}
      <p class="eyebrow">Your training, at your pace</p>
      <h1>Make every<br /><em>set count.</em></h1>
      <p class="intro">Tap once when a set ends. Rest starts right away, and the details can wait until you've caught your breath.</p>
      {#if app.configured}
        <button class="primary" onclick={() => app.signIn()} disabled={app.busy}>Continue with Google <span aria-hidden="true">↗</span></button>
        <p class="subtle">Your workouts stay with your account.</p>
      {:else}
        <p class="subtle">Sign-in isn't configured for this copy of the app yet.</p>
      {/if}
      {#if app.previewAllowed}
        <button class="secondary" onclick={() => app.openPreview()} disabled={app.busy}>Open local preview</button>
        <p class="subtle">Preview data stays on this device and never syncs.</p>
      {/if}
    {/if}
    {#if app.error}<p class="error-text" role="alert">{app.error}</p>{/if}
  </section>
  <footer class="welcome-footer"><span>STRENGTH</span><span>ENDURANCE</span><span>RECOVERY</span></footer>
</main>
