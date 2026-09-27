<script lang="ts">
  import { onMount } from 'svelte';
  import { WorkoutApp } from '$lib/app/app.svelte';
  import Welcome from '$lib/components/Welcome.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import TodayView from '$lib/components/TodayView.svelte';
  import HistoryView from '$lib/components/HistoryView.svelte';
  import ExercisesView from '$lib/components/ExercisesView.svelte';
  import SettingsSheet from '$lib/components/SettingsSheet.svelte';
  import ConflictDialog from '$lib/components/ConflictDialog.svelte';

  const app = new WorkoutApp();
  let settings = $state(false);
  let waiting = $state<ServiceWorker | null>(null);
  const views = [['today', 'Today'], ['history', 'History'], ['exercises', 'Exercises']] as const;

  onMount(() => {
    void app.start();
    // A new release installs in the background; switching is the user's choice so an open set is never interrupted.
    navigator.serviceWorker?.getRegistration().then(registration => {
      if (!registration) return;
      const check = () => { if (registration.waiting && navigator.serviceWorker.controller) waiting = registration.waiting; };
      check();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', check));
    });
    navigator.serviceWorker?.addEventListener('controllerchange', () => { if (waiting) location.reload(); });
    const interval = setInterval(() => app.tick(), 250);
    const onVisibility = () => app.visibilityChanged();
    const onOnline = () => void app.refresh();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      app.close();
    };
  });
</script>

<svelte:head>
  <title>Workout</title>
  <meta name="description" content="A quiet place to log your training." />
</svelte:head>

{#if app.phase !== 'ready'}
  <Welcome {app} />
{:else}
  <div class="app-shell">
    <TopBar {app} onSettings={() => (settings = true)} />
    <main class="content" id="content">
      {#if app.error}<div class="banner error" role="alert"><span>{app.error}</span><button class="text-button" onclick={() => (app.error = '')}>Dismiss</button></div>{/if}
      {#if waiting}<div class="banner notice" role="status"><span>A new version is ready. Your entries are saved.</span><button class="text-button" onclick={() => waiting?.postMessage('skip-waiting')}>Update</button></div>{/if}
      {#if app.notice}<div class="banner notice" role="status"><span>{app.notice}</span><button class="text-button" onclick={() => (app.notice = '')}>Dismiss</button></div>{/if}
      {#if app.view === 'today'}<TodayView {app} />
      {:else if app.view === 'history'}<HistoryView {app} />
      {:else}<ExercisesView {app} />{/if}
    </main>
    <nav class="bottom-nav" aria-label="Main">
      {#each views as [key, label] (key)}
        <button class:active={app.view === key} aria-current={app.view === key ? 'page' : undefined} onclick={() => { app.view = key; scrollTo({ top: 0 }); }}>
          <span class="nav-icon" aria-hidden="true">{key === 'today' ? '◷' : key === 'history' ? '↗' : '≡'}</span>{label}
        </button>
      {/each}
    </nav>
  </div>
  <SettingsSheet {app} bind:open={settings} />
  <ConflictDialog {app} />
{/if}
