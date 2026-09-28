# Spec Delta

## ADDED Requirements

### Requirement: Durable, conflict-safe deletion
Removals SHALL follow the same local-first, revision-checked synchronization as other changes. Deleting a workout SHALL erase its entries, sets, and notes from cloud storage. Only a content-free marker SHALL remain so that other signed-in devices remove their copy and stale devices cannot restore it. The server SHALL reject removal of an entry while any of its sets remain and SHALL reject new content for a deleted workout.

#### Scenario: Deletion reaches another device
- **WHEN** a workout deleted on one device syncs and another device refreshes
- **THEN** the other device no longer shows that workout or any of its sets

#### Scenario: Stale edit after deletion
- **WHEN** a device with an older copy submits an edit to a workout deleted elsewhere
- **THEN** the edit is not applied and the user resolves the conflict explicitly without losing their local draft

#### Scenario: Offline deletion
- **WHEN** the user deletes a workout offline and later reconnects
- **THEN** the deletion stays applied locally and completes in the cloud on reconnect

#### Scenario: No orphaned sets
- **WHEN** a request would remove an entry but leave any of its sets
- **THEN** the server rejects it without changing stored data

#### Scenario: Deleted content is gone from the cloud
- **WHEN** a workout deletion has fully synced
- **THEN** cloud storage holds no entries, sets, or notes for that workout
