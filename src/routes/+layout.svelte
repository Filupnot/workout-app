<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  let { children } = $props();
  onMount(() => {
    // Apply the last chosen appearance before account data loads.
    try { document.documentElement.dataset.theme = localStorage.getItem('workout-theme') || 'system'; } catch { /* system theme */ }
  });
</script>

{@render children()}
