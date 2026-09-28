<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  import { formatTime } from '$lib/domain/rowing';
  import type { SyncStatus } from '$lib/storage/sync';
  let { app, onSettings, onHelp }: { app: WorkoutApp; onSettings: () => void; onHelp: () => void } = $props();

  const labels: Record<SyncStatus, string> = {
    local: 'Saved on device', syncing: 'Syncing…', synced: 'Synced', signin: 'Sign in to sync',
    conflict: 'Review a conflict', failed: 'Sync needs attention'
  };
  const label = $derived(app.preview ? 'Local preview' : labels[app.status]);
  const overtime = $derived(app.timer !== null && app.rest < 0);

  // iOS keeps fixed elements on the layout viewport; follow the visual viewport so the
  // timer stays on screen while the numeric keyboard is open.
  let offset = $state(0);
  let height = $state(0);
  // Content starts below the bar, whatever its height after wrapping or text scaling.
  $effect(() => { if (height) document.documentElement.style.setProperty('--top-bar', `${height}px`); });
  $effect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => { offset = Math.max(0, Math.round(viewport.offsetTop)); };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    update();
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); };
  });
</script>

<header class="top-bar" bind:offsetHeight={height} style:transform={offset ? `translateY(${offset}px)` : undefined}>
  <div class="top-line">
    <span class="brand"><span class="brand-mark" aria-hidden="true">w.</span><span class="sr-only">Workout</span></span>
    <button class="sync-chip" data-status={app.preview ? 'local' : app.status} onclick={() => app.syncNow()} disabled={app.preview}
      aria-label={`${label}${app.pendingCount ? `, ${app.pendingCount} change${app.pendingCount === 1 ? '' : 's'} waiting` : ''}`}>
      <i aria-hidden="true"></i>{label}
    </button>
    <button class="icon-button info" aria-label="Help" onclick={onHelp}><span aria-hidden="true">ⓘ</span></button>
    <button class="icon-button" aria-label="Settings" onclick={onSettings}><span aria-hidden="true">☰</span></button>
  </div>
  <section class="rest" class:running={app.timer !== null} class:overtime aria-label="Rest timer">
    <div class="rest-readout">
      <p class="eyebrow">{app.timer ? (overtime ? 'Overtime' : 'Resting') : 'Rest timer'}</p>
      <p class="rest-number" role="timer" aria-live="off">{formatTime(app.rest)}</p>
    </div>
    <div class="rest-actions">
      {#if app.timer}
        <button class="rest-adjust" onclick={() => app.adjustRest(-15)} aria-label="Remove 15 seconds">−15</button>
        <button class="rest-adjust" onclick={() => app.adjustRest(15)} aria-label="Add 15 seconds">+15</button>
        <button class="rest-adjust" onclick={() => app.skipRest()}>Skip</button>
      {/if}
      <button class="rest-start" onclick={() => app.startRest()}>{app.timer ? 'Restart' : 'Start rest'}</button>
    </div>
  </section>
</header>
