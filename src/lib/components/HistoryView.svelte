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

<div class="page-heading"><div><p class="eyebrow">The work adds up</p><h1>History<span class="accent">.</span></h1></div></div>

<p class="coverage" role="status">
  {#if !covered.count}No finished workouts on this device yet.
  {:else}{covered.count} finished workout{covered.count === 1 ? '' : 's'} since {shortDate(covered.since!)}.
    {covered.complete ? 'That is all of your history.' : 'Older workouts are not loaded yet, so trends are partial.'}{/if}
</p>

{#if !covered.count}
  <section class="card empty"><h2>Progress starts with showing up.</h2><p>Your first finished workout will appear here.</p></section>
{:else}
  <section class="card">
    <div class="card-heading"><h2>Consistency</h2><span class="category">{recentCount(app.records, 30, new Date(app.now))} in 30 days</span></div>
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
        <p class="metric-label">Heaviest completed set of exactly {reps} reps</p>
        <Sparkline values={best.map(p => p.best!)} label={`${cohort.name} best weight at ${reps} reps over ${best.length} sessions`} />
      {:else}
        <p class="subtle">No completed sets of exactly {reps} reps for this exercise yet.</p>
      {/if}
      <p class="metric-label">Volume per session (weight × reps, all sets)</p>
      <Sparkline values={cohort.points.map(p => p.volume)} label={`${cohort.name} volume over ${cohort.points.length} sessions`} />
      <table class="data">
        <thead><tr><th>Date</th><th>Best @ {reps}</th><th>Volume</th></tr></thead>
        <tbody>{#each cohort.points.toReversed() as p (p.workoutId)}<tr><td>{shortDate(p.date)}</td><td>{p.best === null ? '—' : `${round(p.best)} ${unit}`}</td><td>{Math.round(p.volume).toLocaleString()} {unit}</td></tr>{/each}</tbody>
      </table>
    </section>
  {/if}

  {#each rows as r (r.meters)}
    <section class="card trend">
      <div class="card-heading"><h2>Rowing · {r.meters.toLocaleString()} m</h2><span class="category">pace</span></div>
      <p class="metric-label">Average time per 500 m (lower is faster)</p>
      <Sparkline values={r.points.map(p => -p.split)} label={`Rowing ${r.meters} meter pace over ${r.points.length} sessions`} />
      <table class="data">
        <thead><tr><th>Date</th><th>Time</th><th>Split</th></tr></thead>
        <tbody>{#each r.points.toReversed() as p (p.workoutId)}<tr><td>{shortDate(p.date)}</td><td>{formatTime(p.seconds)}</td><td>{formatTime(p.split)}</td></tr>{/each}</tbody>
      </table>
    </section>
  {/each}

  <p class="eyebrow">Sessions</p>
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
                  {#each sets(app.records, e.id) as s, i (s.id)}<p>Set {i + 1}: <strong>{s.weight} {s.unit} × {s.reps}</strong></p>{:else}<p class="subtle">No sets logged.</p>{/each}
                {:else}
                  <h3>Rowing</h3><p><strong>{Math.round(e.meters)} m</strong> in {formatTime(e.seconds)} · {formatTime(500 * e.seconds / e.meters)} /500 m</p>
                {/if}
                {#if e.notes}<p class="note">{e.notes}</p>{/if}
              </div>
            {/each}
            <p>{w.stretched ? 'Stretched afterwards.' : 'No stretch logged.'}</p>
            {#if w.notes}<p class="note">{w.notes}</p>{/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
{#if app.olderCursor}
  <button class="secondary full" onclick={() => app.loadOlder()} disabled={app.busy}>Load older workouts</button>
{/if}
