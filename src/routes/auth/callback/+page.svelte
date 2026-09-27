<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { authConfig } from '$lib/config';
  import { createSession } from '$lib/auth/session';
  let failed = $state(false);
  let message = $state('Finishing sign-in…');
  onMount(async () => {
    const config = authConfig();
    if (!config) { failed = true; message = 'Sign-in is not configured for this copy of the app.'; return; }
    try {
      await createSession(config).callback();
      location.replace(`${base}/`);
    } catch {
      failed = true;
      message = 'Sign-in was cancelled or could not be completed.';
    }
  });
  async function retry() {
    const config = authConfig();
    if (config) await createSession(config).signIn();
  }
</script>

<svelte:head><title>Signing in · Workout</title><meta name="referrer" content="no-referrer" /></svelte:head>
<main class="auth-screen">
  <h1>{message}</h1>
  {#if failed}
    <button class="primary" onclick={retry}>Try again</button>
    <a class="text-button" href={`${base}/`}>Return to Workout</a>
  {/if}
</main>
