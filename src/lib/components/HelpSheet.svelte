<script lang="ts">
  import Dialog from './Dialog.svelte';
  let { open = $bindable() }: { open: boolean } = $props();
</script>

<!-- Condensed from docs/using.md, docs/sync.md, and docs/metrics.md; keep them in step. -->
<Dialog bind:open label="Help">
  <div class="card-heading"><h2>Help</h2><button class="text-button" onclick={() => (open = false)}>Done</button></div>
  <section class="help">
    <h3>Logging</h3>
    <ul>
      <li>Tap <strong>Start rest</strong> when a set ends, then log what you did while resting.</li>
      <li>The next set is prefilled from your last one. Dashed rows are suggestions, not sets.</li>
      <li>Tap a logged set to correct it, or × to remove it. A new angle starts a separate entry.</li>
      <li>Rowing: enter any two of time, distance, and split.</li>
      <li>× beside an exercise removes it and its sets. <strong>Discard workout</strong> or <strong>Delete workout</strong> (in History) removes a whole workout on every device. This can't be undone.</li>
    </ul>
    <h3>Rest timer and sound</h3>
    <ul>
      <li>The timer runs from a saved end time, so reloading or locking the phone doesn't reset it. Past zero it counts overtime.</li>
      <li>The optional sound plays once, only while the app is open on screen. There are no notifications or delayed sounds, and the silent switch can mute it.</li>
    </ul>
    <h3>Sync status</h3>
    <dl>
      <dt>Synced</dt><dd>Everything is saved online.</dd>
      <dt>Saved on device</dt><dd>Waiting to upload. It retries automatically; keep logging.</dd>
      <dt>Sign in to sync</dt><dd>Your session expired. Changes wait until you sign in.</dd>
      <dt>Review a conflict</dt><dd>Another device changed the same thing. Tap to choose a version.</dd>
      <dt>Sync needs attention</dt><dd>A change was rejected. Tap to choose a version.</dd>
    </dl>
    <h3>History</h3>
    <ul>
      <li>Only finished workouts and logged sets count.</li>
      <li><strong>Best weight</strong>: heaviest set with exactly that many reps. <strong>Volume</strong>: weight × reps over all sets.</li>
      <li>Each angle is its own series. Rowing compares only the same distance. Weights convert to your default unit.</li>
      <li>"Days ago" counts calendar days from the workout's date.</li>
    </ul>
  </section>
</Dialog>
