<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  import type { Exercise } from '$lib/domain/model';
  let { app }: { app: WorkoutApp } = $props();
  let editing = $state<string | undefined>(undefined);
  let name = $state(''), category = $state<Exercise['category']>('push'), angle = $state('');
  const active = $derived(app.library.filter(e => !e.archived));
  const archived = $derived(app.library.filter(e => e.archived));
  function edit(e: Exercise) { editing = e.id; name = e.name; category = e.category; angle = e.details.angle?.toString() ?? ''; scrollTo({ top: 0, behavior: 'smooth' }); }
  function reset() { editing = undefined; name = ''; angle = ''; }
  async function submit() { await app.saveExercise({ id: editing, name, category, angle }); if (!app.error) reset(); }
</script>

<h1>Exercises<span class="accent">.</span></h1>

<form class="card" onsubmit={e => { e.preventDefault(); void submit(); }} aria-labelledby="exercise-form-title">
  <h2 id="exercise-form-title">{editing ? 'Edit exercise' : 'Add an exercise'}</h2>
  <label>Name<input required maxlength="100" bind:value={name} placeholder="e.g. Incline bench press" /></label>
  <div class="form-pair">
    <label>Category<select bind:value={category}><option value="push">Push</option><option value="pull">Pull</option><option value="legs">Legs</option></select></label>
    <label>Default angle<input inputmode="decimal" bind:value={angle} placeholder="Optional" /></label>
  </div>
  <button class="primary full" disabled={app.busy}>{editing ? 'Save changes' : 'Add exercise'}</button>
  {#if editing}<button type="button" class="text-button full" onclick={reset}>Cancel</button>{/if}
</form>

{#each ['push', 'pull', 'legs'] as const as c (c)}
  <section class="library-group" aria-label={c}>
    <p class="eyebrow">{c}</p>
    {#each active.filter(e => e.category === c) as e (e.id)}
      <div class="library-item">
        <button class="library-name" onclick={() => edit(e)}>{e.name}{#if e.details.angle !== undefined}<small>{e.details.angle}°</small>{/if}</button>
        <button class="text-button" aria-label={`Archive ${e.name}`} onclick={() => app.setArchived(e, true)}>Archive</button>
      </div>
    {:else}
      <p class="subtle">None</p>
    {/each}
  </section>
{/each}

{#if archived.length}
  <details class="library-group">
    <summary>Archived ({archived.length})</summary>
    {#each archived as e (e.id)}
      <div class="library-item">
        <span class="library-name">{e.name}<small>{e.category}</small></span>
        <button class="text-button" aria-label={`Restore ${e.name}`} onclick={() => app.setArchived(e, false)}>Restore</button>
      </div>
    {/each}
  </details>
{/if}
