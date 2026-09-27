# Spec Delta

## Purpose

Keep workout records private to their authenticated owner and preserve local changes until durable synchronization succeeds.

## ADDED Requirements

### Requirement: Single-account Google admission
The system SHALL accept Google sign-in through the configured identity service but allow workout API access only to the configured owner account. Invalid, expired, wrong-client, and unlisted credentials SHALL be rejected.

#### Scenario: Owner login
- **WHEN** the configured owner signs in successfully
- **THEN** their own stored workouts become available

#### Scenario: Other account
- **WHEN** another Google account signs in
- **THEN** workout data access is denied

#### Scenario: Invalid token
- **WHEN** an API request has an expired or wrong-client token
- **THEN** it is rejected without reading or modifying workout data

### Requirement: User ownership everywhere
The system SHALL derive ownership from verified authentication for every read and write and SHALL scope all persistent records to that identity, allowing later admission of more accounts without migrating existing ownership.

#### Scenario: Spoofed owner
- **WHEN** a request supplies a different owner ID or another owner's record identifier
- **THEN** it cannot access or change the other owner's records

#### Scenario: Future isolation test
- **WHEN** two synthetic admitted identities are used in tests
- **THEN** each can access only its own profile, exercises, sessions, and sets

### Requirement: Durable local-first writes
The app SHALL persist confirmed changes locally before acknowledging them, queue synchronization, retain drafts across reloads, and distinguish local-only, syncing, synced, and failed states.

#### Scenario: Offline set
- **WHEN** a previously signed-in user logs a set without connectivity then reloads
- **THEN** the set and pending sync survive and the timer remains usable

#### Scenario: Storage failure
- **WHEN** local persistence fails
- **THEN** the app reports the failure and does not claim the set was saved

#### Scenario: Expired session
- **WHEN** authentication expires with pending changes
- **THEN** changes remain local and sync resumes after reauthentication

### Requirement: Retry and conflict safety
Repeated delivery of a mutation SHALL NOT duplicate sets or other records. Concurrent stale edits SHALL retain local work and require explicit resolution rather than silently overwriting remote data.

#### Scenario: Lost acknowledgment
- **WHEN** the server saves a set but its response is lost and the client retries
- **THEN** exactly one set remains

#### Scenario: Concurrent edit
- **WHEN** another device changed the same workout before a queued edit syncs
- **THEN** the user can compare and explicitly resolve the conflict without losing the local draft

### Requirement: Private logout and telemetry
The system SHALL exclude tokens, workout contents, and personal identifiers from logs and analytics; logout SHALL clear account data and session material after resolving or explicitly discarding pending writes.

#### Scenario: Pending logout
- **WHEN** a user logs out with unsynced sets
- **THEN** the app offers sync or explicit discard before clearing them

#### Scenario: Next session
- **WHEN** a user finishes logout and reopens the app
- **THEN** previous private records are not visible without authentication
