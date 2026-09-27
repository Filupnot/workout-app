<script lang="ts">
  let { values, label }: { values: number[]; label: string } = $props();
  const points = $derived.by(() => {
    const min = Math.min(...values), max = Math.max(...values);
    return values.map((v, i) => [values.length === 1 ? 120 : 8 + i * 224 / (values.length - 1), 52 - (v - min) / (max - min || 1) * 40] as const);
  });
</script>

<svg viewBox="0 0 240 64" role="img" aria-label={label} class="sparkline">
  <line x1="8" y1="58" x2="232" y2="58" class="axis" />
  <polyline points={points.map(p => p.join(',')).join(' ')} />
  {#each points as [x, y], i (i)}<circle cx={x} cy={y} r="3.5" />{/each}
</svg>
