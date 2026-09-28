<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  import { deriveRow, formatTime, parseTime } from '$lib/domain/rowing';
  let { app, onDone }: { app: WorkoutApp; onDone: () => void } = $props();
  // Shows the calculated result once two values are entered, or why they don't work.
  const preview = $derived.by(() => {
    const d = app.draft;
    if ([d.rowTime, d.rowDistance, d.rowSplit].filter(v => v.trim()).length < 2) return '';
    try {
      const r = deriveRow({ seconds: parseTime(d.rowTime), meters: d.rowDistance.trim() ? Number(d.rowDistance) : undefined, split: parseTime(d.rowSplit) });
      return `${Math.round(r.meters)} m in ${formatTime(r.seconds)} at ${formatTime(r.split)} /500 m`;
    } catch (e) { return e instanceof Error ? e.message : ''; }
  });
  async function submit() { await app.addRow(); if (!app.error) onDone(); }
</script>

<form class="card" onsubmit={e => { e.preventDefault(); void submit(); }} aria-labelledby="row-title">
  <h2 id="row-title">Rowing</h2>
  <p class="subtle">Enter any two.</p>
  <div class="form-trio">
    <label>Time <small>m:ss</small><input inputmode="numeric" placeholder="8:00" value={app.draft.rowTime} oninput={e => app.setDraft({ rowTime: e.currentTarget.value })} /></label>
    <label>Distance <small>m</small><input inputmode="decimal" placeholder="2000" value={app.draft.rowDistance} oninput={e => app.setDraft({ rowDistance: e.currentTarget.value })} /></label>
    <label>Split <small>/500 m</small><input inputmode="numeric" placeholder="2:00" value={app.draft.rowSplit} oninput={e => app.setDraft({ rowSplit: e.currentTarget.value })} /></label>
  </div>
  <p class="subtle" aria-live="polite">{preview}</p>
  <button class="primary full" disabled={app.busy}>Save row</button>
</form>
