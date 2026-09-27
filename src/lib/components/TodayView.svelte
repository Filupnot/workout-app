<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  import { sets } from '$lib/domain/history';
  import { formatTime } from '$lib/domain/rowing';
  import { confirmedSetCount } from '$lib/domain/session';
  import SetLogger from './SetLogger.svelte';
  import ExercisePicker from './ExercisePicker.svelte';
  import RowingForm from './RowingForm.svelte';
  let { app }: { app: WorkoutApp } = $props();
  let rowing = $state(false);
  const minutes = $derived(app.current ? Math.max(0, Math.floor((app.now - Date.parse(app.current.startedAt)) / 60000)) : 0);
</script>

<div class="page-heading">
  <div><p class="eyebrow">One set at a time</p><h1>Today<span class="accent">.</span></h1></div>
  {#if app.current}<span class="badge">In progress</span>{/if}
</div>

{#if !app.current}
  <section class="card empty">
    <h2>Show up. Start anywhere.</h2>
    <p>Weights, a row, a proper stretch. Build the session as you go.</p>
    <button class="primary full" onclick={() => app.startWorkout()} disabled={app.busy}>Start a workout</button>
    <p class="subtle center">Already finished a set? Tap <strong>Start rest</strong> above.</p>
  </section>
{:else}
  <div class="stats" role="group" aria-label="Session summary">
    <div><strong>{app.currentEntries.length}</strong><span>Exercises</span></div>
    <div><strong>{confirmedSetCount(app.records, app.current.id)}</strong><span>Sets</span></div>
    <div><strong>{minutes}<small>m</small></strong><span>Elapsed</span></div>
  </div>

  {#if app.activeEntry && !app.picker}<SetLogger {app} />{/if}
  {#if app.picker || !app.currentEntries.length}<ExercisePicker {app} />{/if}

  <div class="add-actions">
    <button class="secondary" onclick={() => (app.picker = !app.picker)} aria-expanded={app.picker}>+ Exercise</button>
    <button class="secondary" onclick={() => (rowing = !rowing)} aria-expanded={rowing}>+ Rowing</button>
  </div>
  {#if rowing}<RowingForm {app} onDone={() => (rowing = false)} />{/if}

  {#if app.currentEntries.length}
    <section class="timeline" aria-label="This session, in order">
      <p class="eyebrow">This session, in order</p>
      {#each app.currentEntries as e, i (e.id)}
        {#if e.kind === 'strength'}
          <button class="timeline-item" class:selected={e.id === app.draft.selected} onclick={() => app.selectEntry(e)}>
            <span class="timeline-number">{String(i + 1).padStart(2, '0')}</span>
            <span>{e.exerciseName}<small>{sets(app.records, e.id).length} sets{e.details.angle !== undefined ? ` · ${e.details.angle}°` : ''}</small></span>
            <span aria-hidden="true">›</span>
          </button>
        {:else}
          <div class="timeline-item static">
            <span class="timeline-number">{String(i + 1).padStart(2, '0')}</span>
            <span>Rowing<small>{Math.round(e.meters)} m · {formatTime(e.seconds)} · {formatTime(500 * e.seconds / e.meters)} /500 m</small></span>
            <span></span>
          </div>
        {/if}
      {/each}
    </section>
  {/if}

  <section class="card recovery">
    <label class="check">
      <input type="checkbox" checked={app.current.stretched} onchange={e => app.setStretched(e.currentTarget.checked)} />
      <span>Stretched<small>A little care for tomorrow.</small></span>
    </label>
    <label>Session note
      <textarea placeholder="Anything worth remembering?" maxlength="2000" value={app.draft.sessionNote}
        oninput={e => app.setDraft({ sessionNote: e.currentTarget.value })} onblur={() => app.saveSessionNote()}></textarea>
    </label>
  </section>
  <button class="finish" onclick={() => app.finish()} disabled={app.busy}>Finish workout</button>
{/if}
