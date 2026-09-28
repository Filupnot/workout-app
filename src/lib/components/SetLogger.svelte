<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  import { dayLabel, daysAgo, exactDate } from '$lib/domain/history';
  import { suggestedRows } from '$lib/domain/session';
  let { app }: { app: WorkoutApp } = $props();
  const entry = $derived(app.activeEntry!);
  const editing = $derived(app.activeSets.find(s => s.id === app.draft.editSetId));
  function remove(id: string, n: number) { if (confirm(`Remove set ${n}?`)) void app.removeSet(id); }
</script>

<section class="card logger" aria-labelledby="active-name">
  <div class="card-heading">
    <span class="category">{entry.category}{entry.details.angle !== undefined ? ` · ${entry.details.angle}°` : ''}</span>
    <button class="text-button" onclick={() => (app.picker = true)}>Switch exercise</button>
  </div>
  <h2 id="active-name">{entry.exerciseName}</h2>

  <div class="last-time">
    {#if app.prior}
      {@const days = daysAgo(app.prior.workout)}
      <p><strong>Last time · {dayLabel(days)}</strong> <span class="subtle">{exactDate(app.prior.workout)}</span></p>
      {#each app.prior.entries as p (p.entry.id)}
        <p class="prior-sets">{p.entry.details.angle !== undefined ? `${p.entry.details.angle}° · ` : ''}{p.sets.map(s => `${s.weight} ${s.unit} × ${s.reps}`).join(' · ')}</p>
      {/each}
    {:else}
      <p class="subtle">First time</p>
    {/if}
  </div>

  <form novalidate onsubmit={e => { e.preventDefault(); void app.logSet(); }}>
    <div class="set-table" role="list" aria-label="Sets">
      <div class="set-row head" aria-hidden="true"><span>Set</span><span>Weight</span><span>Reps</span><span></span></div>
      {#each app.activeSets as s, i (s.id)}
        <div class="set-row" class:editing={s.id === app.draft.editSetId} role="listitem">
          <span class="set-index">{i + 1}</span>
          <button type="button" class="set-value" onclick={() => app.editSet(s.id)} aria-label={`Edit set ${i + 1}: ${s.weight} ${s.unit}`}>{s.weight}<small>{s.unit}</small></button>
          <button type="button" class="set-value" onclick={() => app.editSet(s.id)} aria-label={`Edit set ${i + 1}: ${s.reps} reps`}>{s.reps}</button>
          <button type="button" class="remove" aria-label={`Remove set ${i + 1}`} onclick={() => remove(s.id, i + 1)}>×</button>
        </div>
      {/each}
      <div class="set-row entry" role="listitem">
        <span class="set-index">{editing ? '✎' : app.activeSets.length + 1}</span>
        <span class="field">
          <input id="weight" aria-label={`Weight in ${app.draft.unit}`} inputmode="decimal" enterkeyhint="next" autocomplete="off"
            placeholder="0" value={app.draft.weight} oninput={e => app.setDraft({ weight: e.currentTarget.value })} />
          <button type="button" class="unit" aria-label={`Unit: ${app.draft.unit}. Switch unit`} onclick={() => app.setDraft({ unit: app.draft.unit === 'lb' ? 'kg' : 'lb' })}>{app.draft.unit}</button>
        </span>
        <span class="field">
          <input id="reps" class="plain" aria-label="Reps" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off"
            placeholder="0" value={app.draft.reps} oninput={e => app.setDraft({ reps: e.currentTarget.value })} />
        </span>
        <span></span>
      </div>
      {#each Array(suggestedRows(app.activeSets.length)) as _, i}
        <div class="set-row suggested" role="listitem" aria-label="Suggested set, not logged">
          <span class="set-index">{app.activeSets.length + i + 2}</span><span>—</span><span>—</span><span></span>
        </div>
      {/each}
    </div>

    <details class="nuance" open={!!app.draft.entryNote || app.draft.angle !== (entry.details.angle?.toString() ?? '')}>
      <summary>Angle and notes</summary>
      <label>Angle (°)
        <input inputmode="decimal" placeholder="e.g. 30" value={app.draft.angle} oninput={e => app.setDraft({ angle: e.currentTarget.value })} />
      </label>
      <label>Note
        <textarea maxlength="2000" placeholder="Optional" value={app.draft.entryNote}
          oninput={e => app.setDraft({ entryNote: e.currentTarget.value })} onblur={() => app.saveEntryNote()}></textarea>
      </label>
    </details>

    <button type="submit" class="primary full" disabled={app.busy}>{editing ? 'Save correction' : 'Log set'}</button>
    {#if editing}<button type="button" class="text-button full" onclick={() => app.cancelEdit()}>Cancel correction</button>
    {/if}
  </form>
</section>
