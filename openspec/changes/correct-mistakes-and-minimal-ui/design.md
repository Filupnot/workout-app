# Design

## Context

See proposal.md for motivation and specs/ for requirements. Workouts are stored as one aggregate: a metadata record plus entry and set records sharing a revision. Mutations are atomic, revision-checked, and limited to 20 changes. The server currently allows only set removals. Clients pull a workout again only when its metadata revision changes, then replace their local copy of that aggregate.

## Goals / Non-Goals

**Goals:** removals behave like any other change (local first, queued, ordered, conflict-checked), leave no orphans at any intermediate step, and erase workout content from the cloud.

**Non-Goals:** a trash or undo store, server-side purge jobs, and removing entries from finished workouts.

## Decisions

### 1. Tombstone the workout record, erase its children

Deleting a workout rewrites its metadata as `status: deleted` with notes cleared, the stretch flag false, and no end time. Entries and sets are deleted. The metadata record stays with only its ID, start time, and local date. Its revision bump propagates the deletion to other devices through the existing pull, and it blocks resurrection: a stale device's edit fails the revision check.

*Alternative:* hard-delete everything. Rejected. Other devices would never learn of the deletion, since the list endpoint only reports what exists. A stale device could also recreate the workout with base revision 0.

### 2. Ordered batches, sets before entries

A removal is split into sequential mutations, each containing the workout record and at most 19 removals. Sets come before their entry, and the tombstone goes in the first batch of a workout deletion. Each batch is atomic locally and on the server, and the outbox preserves order. Any partially synced state is therefore valid: sets without an entry never exist, and a tombstoned workout with leftover children is hidden and finishes on the next sync.

*Alternative:* one large transaction. Rejected. It exceeds the mutation bound, which keeps requests small and DynamoDB transactions within limits.

### 3. Server-side invariants

When a mutation removes an entry, the server loads the workout's stored sets (a paginated key-prefix query, never a scan) and rejects the mutation if any set for that entry would remain. When the workout's resulting record is deleted, it rejects any change that adds content. It also rejects any change that would turn a stored tombstone back into a live workout, so a deleted workout is never restored. All three return 400. Deletion of the metadata record itself stays forbidden.

### 4. Client filtering

Views use the same derived lists: in-progress, finished, entries, and sets. Tombstones match neither in-progress nor finished, so History, last time, and metrics exclude them without further changes. The conflict comparison labels a tombstone "deleted."

### 5. Stale device after deletion

A queued edit on a device holding an older copy receives 409 and shows the conflict dialog, where the online version reads "deleted." Choosing the online version drops the local edits. Choosing to keep local changes resubmits content against a deleted workout, which the server rejects. The change is then marked for attention and the same choice is offered again. Nothing is lost silently.

### 6. Minimal copy and help

An audit of each view keeps page titles, control labels, values, status, errors, empty-state prompts, and imperative one-line instructions such as rowing's "Enter any two." It removes eyebrows, taglines, captions, and reassurance lines. A single "Help" (ⓘ) button in the top bar opens a sheet using the existing dialog component. The sheet has short sections: Logging, Rest timer & sound, Sync status, and History metrics. Its content is condensed from `docs/using.md`, `docs/sync.md`, and `docs/metrics.md`, and it has no effect on workout or timer state.

## Risks / Trade-offs

- [An older cached app version cannot parse a tombstone and its pull fails] → Pull failures don't block local use, and the update prompt brings in the new version. Deploy the backend before the frontend.
- [Tombstones keep a workout's date on the server] → Contains no content. Acceptable for sync correctness, and documented.
- [A removal interrupted between batches] → Each batch is valid on its own. The outbox finishes it on the next sync, and hidden tombstones keep the view consistent.
- [Accidental deletion with no undo] → Explicit confirmation naming the workout date or exercise, and removal controls sized and spaced apart from logging controls.

## Migration Plan

No data migration is needed. Deploy the backend (new validation and schema value), then publish the frontend. Rollback: redeploy the previous versions. No workout data is lost, but older clients cannot read existing tombstones, so their cloud pulls fail until the app rolls forward again. Local logging is unaffected. Prefer rolling forward.
