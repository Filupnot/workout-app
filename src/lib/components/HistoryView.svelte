<script lang="ts">
  import type { WorkoutApp } from '$lib/app/app.svelte';
  import { coverage, dayLabel, daysAgo, entries, exactDate, recentCount, rowingTrends, sets, strengthTrends, weeklyFrequency } from '$lib/domain/history';
  import { formatTime } from '$lib/domain/rowing';
  import Sparkline from './Sparkline.svelte';
  import WeekBars from './WeekBars.svelte';
  let { app }: { app: WorkoutApp } = $props();
  let reps = $state(8);
  let chosen = $state('');
  let openId = $state('');
  const unit = $derived(app.profile.unit);
  const covered = $derived(coverage(app.records, !!app.olderCursor));
  const weeks = $derived(weeklyFrequency(app.records, 8, new Date(app.now)));
  const cohorts = $derived(strengthTrends(app.records, reps, unit));
  const cohort = $derived(cohorts.find(c => c.key === chosen) ?? cohorts.at(-1));
  const best = $derived(cohort?.points.filter(p => p.best !== null) ?? []);
  const rows = $derived(rowingTrends(app.records));
  const shortDate = (d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
  const round = (n: number) => Math.round(n * 10) / 10;
</script>

<h1>History<span class="accent">.</span></h1>

{#if !covered.count}
  <p class="subtle">No finished workouts yet.</p>
{:else}
  {#if !covered.complete}<p class="coverage" role="status">Partial history: since {shortDate(covered.since!)}</p>{/if}
  <section class="card">
    <div class="card-heading"><h2>Consistency</h2><span class="category">{covered.count} total · {recentCount(app.records, 30, new Date(app.now))} in 30 days</span></div>
    <WeekBars {weeks} />
  </section>

  {#if cohorts.length && cohort}
    <section class="card trend">
      <div class="card-heading"><h2>Strength</h2><span class="category">{unit}</span></div>
      <div class="form-pair">
        <label>Exercise
          <select value={cohort.key} onchange={e => (chosen = e.currentTarget.value)}>
            {#each cohorts as c (c.key)}<option value={c.key}>{c.name}{c.angle !== undefined ? ` · ${c.angle}°` : ''}</option>{/each}
          </select>
        </label>
        <label>Best weight at
          <select bind:value={reps}>{#each [1, 3, 5, 6, 8, 10, 12, 15] as n (n)}<option value={n}>{n} reps</option>{/each}</select>
        </label>
      </div>
      {#if best.length}
        <p class="metric-label">Best weight at {reps} reps</p>
        <Sparkline values={best.map(p => p.best!)} label={`${cohort.name} best weight at ${reps} reps over ${best.length} sessions`} />
      {:else}
        <p class="subtle">No sets at {reps} reps</p>
      {/if}
      <p class="metric-label">Volume</p>
      <Sparkline values={cohort.points.map(p => p.volume)} label={`${cohort.name} volume over ${cohort.points.length} sessions`} />
      <table class="data">
        <thead><tr><th>Date</th><th>Best @ {reps}</th><th>Volume</th></tr></thead>
        <tbody>{#each cohort.points.toReversed() as p (p.workoutId)}<tr><td>{shortDate(p.date)}</td><td>{p.best === null ? '—' : `${round(p.best)} ${unit}`}</td><td>{Math.round(p.volume).toLocaleString()} {unit}</td></tr>{/each}</tbody>
      </table>
    </section>
  {/if}

  {#each rows as r (r.meters)}
    <section class="card trend">
      <h2>Rowing · {r.meters.toLocaleString()} m</h2>
      <p class="metric-label">Split /500 m</p>
      <Sparkline values={r.points.map(p => -p.split)} label={`Rowing ${r.meters} meter pace over ${r.points.length} sessions`} />
      <table class="data">
        <thead><tr><th>Date</th><th>Time</th><th>Split</th></tr></thead>
        <tbody>{#each r.points.toReversed() as p (p.workoutId)}<tr><td>{shortDate(p.date)}</td><td>{formatTime(p.seconds)}</td><td>{formatTime(p.split)}</td></tr>{/each}</tbody>
      </table>
    </section>
  {/each}

  <h2>Sessions</h2>
  <ul class="sessions">
    {#each app.finished as w (w.id)}
      <li>
        <button class="session-row" aria-expanded={openId === w.id} onclick={() => (openId = openId === w.id ? '' : w.id)}>
          <span>{exactDate(w)}<small>{entries(app.records, w.id).length} {entries(app.records, w.id).length === 1 ? 'exercise' : 'exercises'}{w.stretched ? ' · stretched' : ''}</small></span>
          <span class="subtle">{dayLabel(daysAgo(w, new Date(app.now)))}</span>
        </button>
        {#if openId === w.id}
          <div class="session-detail">
            {#each entries(app.records, w.id) as e (e.id)}
              <div class="detail-entry">
                {#if e.kind === 'strength'}
                  <h3>{e.exerciseName}{e.details.angle !== undefined ? ` · ${e.details.angle}°` : ''}</h3>
                  {#each sets(app.records, e.id) as s, i (s.id)}<p>Set {i + 1}: <strong>{s.weight} {s.unit} × {s.reps}</strong></p>{:else}<p class="subtle">No sets</p>{/each}
                {:else}
                  <h3>Rowing</h3><p><strong>{Math.round(e.meters)} m</strong> in {formatTime(e.seconds)} · {formatTime(500 * e.seconds / e.meters)} /500 m</p>
                {/if}
                {#if e.notes}<p class="note">{e.notes}</p>{/if}
              </div>
            {/each}
            {#if w.stretched}<p>Stretched</p>{/if}
            {#if w.notes}<p class="note">{w.notes}</p>{/if}
            <button class="text-button danger" onclick={() => { if (confirm(`Delete the workout from ${exactDate(w)}? This can't be undone.`)) void app.deleteWorkout(w); }} disabled={app.busy}>Delete workout</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
{#if app.olderCursor}
  <button class="secondary full" onclick={() => app.loadOlder()} disabled={app.busy}>Load older workouts</button>
{/if}
