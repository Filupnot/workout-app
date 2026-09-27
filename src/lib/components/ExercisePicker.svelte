<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  import type { Exercise } from '$lib/domain/model';
  let { app }: { app: WorkoutApp } = $props();
  let category = $state<'all' | Exercise['category']>('all');
  let query = $state('');
  let newCategory = $state<Exercise['category']>('push');
  const visible = $derived(app.library.filter(e => !e.archived && (category === 'all' || e.category === category)
    && e.name.toLowerCase().includes(query.trim().toLowerCase())));
  const exact = $derived(app.library.some(e => !e.archived && e.name.toLowerCase() === query.trim().toLowerCase()));
  async function quickAdd() {
    const name = query.trim();
    await app.saveExercise({ name, category: newCategory, angle: '' });
    const created = app.library.find(e => e.name === name && !e.archived);
    if (created) { query = ''; await app.chooseExercise(created); }
  }
</script>

<section class="card picker" aria-labelledby="picker-title">
  <div class="card-heading">
    <h2 id="picker-title">{app.currentEntries.length ? 'What did you just do?' : 'Pick your first exercise'}</h2>
    {#if app.activeEntry}<button class="text-button" onclick={() => (app.picker = false)}>Close</button>{/if}
  </div>
  <input class="search" type="search" placeholder="Search or add an exercise" aria-label="Search exercises" bind:value={query} autocomplete="off" />
  <div class="pills" role="group" aria-label="Category">
    {#each ['all', 'push', 'pull', 'legs'] as const as c (c)}
      <button class:chosen={category === c} aria-pressed={category === c} onclick={() => (category = c)}>{c}</button>
    {/each}
  </div>
  <ul class="options">
    {#each visible as e (e.id)}
      <li><button class="option" onclick={() => app.chooseExercise(e)} disabled={app.busy}>
        <span>{e.name}<small>{e.category}{e.details.angle !== undefined ? ` · ${e.details.angle}°` : ''}{e.lastUsedAt ? ' · recent' : ''}</small></span><span aria-hidden="true">+</span>
      </button></li>
    {:else}
      <li class="subtle">No saved exercises match.</li>
    {/each}
  </ul>
  {#if query.trim() && !exact}
    <form class="quick-add" onsubmit={e => { e.preventDefault(); void quickAdd(); }}>
      <label>Category for “{query.trim()}”
        <select bind:value={newCategory}><option value="push">Push</option><option value="pull">Pull</option><option value="legs">Legs</option></select>
      </label>
      <button class="secondary" disabled={app.busy}>Add and use</button>
    </form>
  {/if}
</section>
