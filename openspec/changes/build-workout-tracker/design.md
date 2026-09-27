# Design

## Context

See proposal.md for motivation and scope. The project contains OpenSpec scaffolding only, with no application or Git repository. Read-only investigation found an existing SvelteKit static personal site on GitHub Pages and a separate plain-JavaScript Home Screen app with a Node.js Lambda Function URL, DynamoDB, SSM secrets, and web push. Live AWS metadata confirmed the Lambda and on-demand table. These are reference patterns, not resources to modify. No source code or user data is copied from either application.

## Goals / Non-Goals

**Goals:** instant logging despite connectivity loss; durable, private cloud history; identity-scoped data without a later ownership migration; reproducible deployment; a small operational footprint.

**Non-Goals:** distributed real-time editing, event sourcing, background execution guarantees, sharing data between users, and integration with existing apps' tables or secrets. Deferred product capabilities are listed in proposal.md.

## Decisions

### 1. Static mobile frontend

Use SvelteKit, TypeScript, and a static adapter with a service worker and manifest. GitHub Actions publishes static assets to GitHub Pages. Keep application routes compatible with static hosting and test direct navigation/reload. Use Today, History, and Exercises as primary views. Favor a single primary action, large numeric controls, 44 CSS-pixel touch targets, adequate contrast, safe-area padding, and system/light/dark themes. Pin the rest display above scrolling content and keep it visible with the numeric keyboard open.

A native app offers better background timing but adds distribution overhead. Plain JavaScript matches the smaller reference app but structured components better support this app's forms, history, and sync states. No server rendering is required.

### 2. After-set workflow and local timer

Start a session with no prescribed routine. Tapping Start rest immediately persists a deadline and opens a set draft; choose the exercise after the first set. Later sets prefill the previous actual values. Three rows are suggestions, not completed records. Logging and timing are independent: saving or editing never resets rest. Allow manual restart, skip, and duration adjustment, defaulting to 90 seconds. Finishing the session stops its timer.

Derive the display from the saved absolute deadline, not a decremented counter. Preserve deadline and cue-consumed state through navigation and reload. Display negative overtime; sound once only if enabled and foreground at the deadline. Mark elapsed hidden timers consumed without playing a delayed sound on return. Default sound off; enable audio through a user gesture. No notification permission, push subscription, or background scheduler in this release.

### 3. Authentication and admission

Use Cognito User Pool federation with Google, authorization-code flow with PKCE, a public browser client without a client secret, and only identity scopes. Keep Google client secrets server-side. Use managed token refresh through a maintained auth library; persist only session material needed for returning users, never log it, never include it in service-worker response caches, and clear it on logout. A static client cannot use an HttpOnly refresh-token cookie without another backend session layer; mitigate its script-accessible token storage with a restrictive CSP, minimal dependencies, no third-party analytics, and escaped plain-text notes.

Validate access-token signature, issuer, expiry, token_use, client_id, and required API scope in Lambda. Function URL auth remains NONE at the AWS transport layer; every data route enforces application authentication. Derive owner from the verified Cognito sub, never a submitted owner ID. Enforce a server-side singleton allowlist of that subject on every request, stored in secure configuration. During initial setup, sign in once, retrieve the subject through a controlled administrator step, then configure admission; unlisted users receive no workout API access. Friends require expanding admission later, not changing keys.

Direct Google token verification is simpler at first but leaves session lifecycle management to the app. Cognito is chosen to manage federation and refresh. API Gateway authorizers remain an alternative if API management needs grow; a Function URL preserves the existing pattern.

### 4. Dedicated DynamoDB table and access patterns

Use one new on-demand table with PK/SK, point-in-time recovery, encryption at rest, schemaVersion, and least-privilege Lambda access. Each record belongs to PK=USER#<verified-sub>. No email, display name, or Google profile is needed in workout records. Use opaque UUIDs for workout, entry, set, and exercise IDs. No TTL on workout history.

| Sort key | Contents |
| --- | --- |
| PROFILE | Units, theme, rest duration, cue preference |
| EXERCISE#<id> | Name, category, remembered structured details, archived flag |
| WORKOUT#<id>#META | Start/end, local calendar date/timezone, status, notes, stretch boolean, revision |
| WORKOUT#<id>#ENTRY#<id> | Position, kind, exercise ID/name/category snapshot, angle/details, notes, rowing fields |
| WORKOUT#<id>#SET#<id> | Entry ID, set position, weight/unit, integer reps, completion timestamp |
| MUTATION#<id> | Applied mutation marker and result; expirable after 30 days |

Use a sparse GSI for workout metadata with GSI1PK=USER#<sub> and GSI1SK=DATE#<startedAt>#<workoutId>. Query workout children by primary-key prefix, and query exercise definitions by EXERCISE# prefix. Paginate every list; do not table-scan. Fetch recent metadata then session details for initial analytics, progressively paginating older history and indicating loaded coverage. An exercise-specific index or summaries can be added later without changing ownership. Query a workout directly after a write instead of relying on immediate GSI consistency.

Store explicit entry/set position plus timestamps, so editing does not silently reorder history. Snapshot exercise names and details per entry; later library edits cannot rewrite prior sessions. Incline angle is entry-specific and remembered as the next default; changing angle within a session creates a separate entry. Support lbs/kg, preserving original units and converting only for comparisons. Seed a small generic editable library on first use; prioritize recent exercises. Archive library exercises rather than cascading into historical data.

### 5. API and offline synchronization

Expose versioned authenticated endpoints for profile, exercise library, paginated workout list/detail, and mutations. Validate body size, numeric ranges, IDs, types, order, timestamps, and note lengths; reject unknown ownership fields. Use generic errors, bounded payloads, exact-origin CORS, no wildcard credential policy, and logs containing request IDs/status only, not tokens, notes, or bodies.

IndexedDB stores owner-namespaced records, persisted drafts, timer state, and an outbox. Apply each local mutation and append its outbox entry in one transaction before showing Saved on device. Show Synced only after server acknowledgment. API failure or expired auth leaves data queued and offers retry/sign-in without blocking logging. First login requires connectivity; previously authenticated local use can continue offline. Logging out with pending changes warns that unsynced data must be synced or explicitly discarded, then clears local account data and credentials. API caches never enter service-worker cache storage.

Each mutation has a stable ID, base revision, affected record IDs, and deterministic values. Serialize mutations per workout or library record. A DynamoDB transaction checks the parent revision, applies bounded child changes, increments revision, and records the mutation marker. Retries with a marker return the prior result; after marker expiry the old base revision still prevents a duplicate write. Batch sessions across individual mutations instead of one unbounded transaction. Do not expire active workout records.

On 409, retain local data and show a conflict requiring explicit keep-local or keep-server resolution; fetch the latest state and submit any chosen local replacement against its revision. Do not silently overwrite another device. Routine pending edits on one client rebase their expected revisions after acknowledgment. Use bounded exponential retries for transient errors, separate terminal validation errors, and visible recovery for local storage failures. A server failure must never claim a cloud save.

### 6. History and calculations

Last time refers to the latest earlier session containing completed sets, with local-calendar days ago and exact date available. Show each set's actual values and exercise details. Separate incline-angle variants when comparing progress. Count completed sessions by local date, chart per-exercise best completed weight at a chosen rep count and total volume with consistent units, and compare rowing pace at matching distances. Exclude drafts/incomplete sets; label partial history and empty states; do not infer strength gains from incomparable variants.

For rowing, accept any two of seconds, meters, and seconds/500 m; derive the third using split=500*time/distance. If all three are supplied, validate within display rounding tolerance (one second for displayed time/split and one meter for distance), otherwise ask which pair to retain. Store canonical time and distance and derive pace; require positive finite values. No photo parsing or third-party imports.

### 7. GitHub, privacy, and deployment

Initialize a dedicated Git repository during implementation and publish to the owner's authenticated GitHub account, public with the owner's explicit approval after the private Pages eligibility check failed. Keep personal data and secrets outside Git regardless of visibility. Use a privacy-preserving GitHub noreply commit identity. Include only sanitized examples and synthetic fixtures. Ignore environment files, credentials, local databases, deployment output, dependencies, build artifacts, and personal editor/agent state. Scan staged files and full outgoing history before the first push; CI scans later commits.

Use AWS SAM/CloudFormation for dedicated table, Lambda, role, Cognito resources, and external parameter references. Store deployment parameters and owner admission outside Git; resolve domain configuration and any generated CNAME at deployment time. Public runtime configuration necessarily exposes client IDs and API URLs; treat them as identifiers, never authorization. Keep real domain/account values out of committed examples. GitHub's owner identity itself is necessarily visible to authorized repository viewers; do not add extra personal profile data.

Use GitHub Actions OIDC with scoped AWS trust rather than committed or long-lived AWS access keys. Google secret and admission data belong in restricted secure configuration. Use HTTPS; keep all AWS calls in the backend. Apply CSP appropriate to Cognito redirect login, content-type protections, and dependency checks; validate which headers GitHub Pages can provide and use supported meta policies where needed. No analytics or sensitive telemetry. Infrastructure output/logs must redact secrets and personal account identifiers.

## Risks / Trade-offs

- Browser storage eviction -> cloud sync, clear pending status, request persistent storage where supported; never represent local storage as a guaranteed backup.
- iPhone background suspension -> deadline-based display and explicit lack of background alerts in this release.
- Offline or expired session -> retain drafts/outbox and prompt reauthentication only for sync.
- Multiple-device edits -> optimistic revisions and explicit conflict resolution.
- Sparse rowing/exercise data -> clear empty states, comparable cohorts, and visible history coverage.
- Static hosting limits on headers and private Pages eligibility -> verify during delivery; do not silently weaken repository privacy.
- Browser-held session tokens -> minimal scripts, CSP, escaped input, logout cleanup, short access-token lifetimes.
- Table growth and Lambda cost -> paginated queries, bounded mutations, reserved concurrency and budget monitoring; no user-data scans or notification polling.

## Migration Plan

No existing data migration is required. Implement locally with synthetic data, provision isolated AWS resources, configure Google callbacks and the owner subject privately, verify authorization and sync, then deploy static assets and DNS. Preserve existing sites. Smoke-test on a real iPhone before declaring delivery complete. Roll back frontend/Lambda releases to known versions; retain the data table and backups on stack removal. Version payloads and avoid destructive schema changes. Never destroy workout data as a deployment rollback.

## Open Questions

- Final app display name and subdomain can be supplied at deployment without changing architecture.
- Repository visibility is resolved: public source and GitHub Pages, explicitly selected by the owner.
