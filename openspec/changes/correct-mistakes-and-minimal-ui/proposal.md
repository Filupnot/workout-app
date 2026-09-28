# Proposal

## Why

Mistakes can't be undone today. A mistaken exercise or a mock workout stays in history, can't be removed, and skews "last time" and trend views. The interface also carries a lot of taglines and explanatory text. Mid-workout, it should show only controls, their labels, and short instructions, with details available on request.

## What Changes

- Remove an exercise entry (strength or rowing), with its sets, from a workout.
- Delete a whole workout, whether in progress or finished. Deletion erases its entries, sets, and notes everywhere it has synced, keeping only a content-free marker so other devices apply the deletion and stale devices cannot bring it back.
- Ask for confirmation before any removal.
- Server rules: an entry can be removed only once none of its sets remain, and a deleted workout accepts only further removals. All removals stay revision-checked and conflict-safe.
- Trim on-screen copy to control labels, errors, and brief instructions. Remove taglines, eyebrows, and explanatory captions.
- Add an info (ⓘ) control that opens on-demand help covering logging, the timer, sound limits, sync states, and metric definitions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

These capabilities are introduced by `build-workout-tracker`, which must be archived before this change.

- `workout-logging`: adds entry removal and workout deletion.
- `workout-history`: deleted workouts are excluded from history, last-time context, and metrics.
- `private-sync`: deletions propagate across devices, stay revision-checked, and cannot be resurrected by stale edits.
- `mobile-delivery`: minimal on-screen copy with on-demand help.

## Impact

- Frontend: workout status gains a `deleted` tombstone; new removal actions and confirmations; copy reductions across views; a new help sheet.
- Backend: mutation validation for entry removal and deleted workouts. The API contract is unchanged apart from these rules.
- Data: no migration. Tombstones are ordinary workout records with no content.
- Docs: `docs/using.md`, `docs/sync.md`, and `docs/data.md` updated; help text drawn from them.

## Non-goals

Removing individual entries or sets from finished workouts (only whole-workout deletion applies to them), undo or trash, and permanent deletion of library exercises (archive remains). The owner confirmed this scope.
