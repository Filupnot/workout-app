<script lang="ts">
  let { weeks }: { weeks: { label: string; count: number }[] } = $props();
  const max = $derived(Math.max(1, ...weeks.map(w => w.count)));
</script>

<div class="week-bars" role="img" aria-label={`Workouts per week: ${weeks.map(w => `${w.label}, ${w.count}`).join('; ')}`}>
  {#each weeks as w (w.label)}
    <div class="week">
      <span class="count">{w.count || ''}</span>
      <span class="bar" style:height={`${(w.count / max) * 100}%`}></span>
      <span class="week-label">{w.label}</span>
    </div>
  {/each}
</div>
