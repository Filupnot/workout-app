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
  function remove(e: (typeof app.currentEntries)[number]) {
    const name = e.kind === 'strength' ? e.exerciseName : 'Rowing';
    const count = e.kind === 'strength' ? sets(app.records, e.id).length : 0;
    if (confirm(`Remove ${name}${count ? ` and its ${count} set${count === 1 ? '' : 's'}` : ''} from this workout?`)) void app.removeEntry(e);
  }
  function discard() {
    if (app.current && confirm('Discard this workout? Its exercises, sets, and notes will be deleted.')) void app.deleteWorkout(app.current);
  }
  const minutes = $derived(app.current ? Math.max(0, Math.floor((app.now - Date.parse(app.current.startedAt)) / 60000)) : 0);
</script>

<h1>Today<span class="accent">.</span></h1>

{#if !app.current}
  <section class="empty">
    <button class="primary full" onclick={() => app.startWorkout()} disabled={app.busy}>Start a workout</button>
    <p class="subtle center">Or tap Start rest after your first set.</p>
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
      {#each app.currentEntries as e, i (e.id)}
        <div class="timeline-row">
          {#if e.kind === 'strength'}
            <button class="timeline-item" class:selected={e.id === app.draft.selected} onclick={() => app.selectEntry(e)}>
              <span class="timeline-number">{String(i + 1).padStart(2, '0')}</span>
              <span>{e.exerciseName}<small>{sets(app.records, e.id).length} {sets(app.records, e.id).length === 1 ? 'set' : 'sets'}{e.details.angle !== undefined ? ` · ${e.details.angle}°` : ''}</small></span>
            </button>
          {:else}
            <div class="timeline-item static">
              <span class="timeline-number">{String(i + 1).padStart(2, '0')}</span>
              <span>Rowing<small>{Math.round(e.meters)} m · {formatTime(e.seconds)} · {formatTime(500 * e.seconds / e.meters)} /500 m</small></span>
            </div>
          {/if}
          <button class="remove" aria-label={`Remove ${e.kind === 'strength' ? e.exerciseName : 'rowing'} (${i + 1})`} onclick={() => remove(e)} disabled={app.busy}>×</button>
        </div>
      {/each}
    </section>
  {/if}

  <section class="card recovery">
    <label class="check">
      <input type="checkbox" checked={app.current.stretched} onchange={e => app.setStretched(e.currentTarget.checked)} />
      <span>Stretched</span>
    </label>
    <label>Session note
      <textarea placeholder="Optional" maxlength="2000" value={app.draft.sessionNote}
        oninput={e => app.setDraft({ sessionNote: e.currentTarget.value })} onblur={() => app.saveSessionNote()}></textarea>
    </label>
  </section>
  <button class="finish" onclick={() => app.finish()} disabled={app.busy}>Finish workout</button>
  <button class="text-button danger" onclick={discard} disabled={app.busy}>Discard workout</button>
{/if}
