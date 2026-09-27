# Tasks

## 1. Project and repository foundation

- [x] 1.1 Initialize Git with a privacy-preserving commit identity, ignores for local state/secrets/build output, and sanitized configuration examples; verify staged files contain only intended project material.
- [x] 1.2 Scaffold SvelteKit/TypeScript static delivery with pinned dependencies and check/build scripts; verify type checking and production build succeed.
- [x] 1.3 Add CI for checks, builds, and secret scanning; verify a synthetic scanner test detects a dummy forbidden fixture without using a real secret.
- [x] 1.4 Check private GitHub Pages eligibility, then create the dedicated private GitHub repository and push reviewed, scanned history; verify the remote and visibility, and obtain a concrete hosting/visibility decision if private Pages is unavailable.
- [x] 1.5 Document local setup, configuration boundaries, and repository privacy rules with placeholders only; verify a clean checkout can follow the setup instructions.

## 2. Domain model and local persistence

- [x] 2.1 Define versioned profile, exercise, session, entry, set, and rowing schemas with stable IDs, positions, snapshots, and units; verify validation and snapshot tests including angle variants and invalid inputs.
- [x] 2.2 Implement IndexedDB owner namespaces, drafts, and atomic record/outbox persistence; verify reload survival, account separation, and visible storage-failure handling.
- [x] 2.3 Implement rowing derivation, rounding validation, and unit conversion; verify all input pairs, inconsistent triples, zero/negative values, and mixed-unit comparisons.
- [x] 2.4 Document record ownership and local schema upgrades; verify a synthetic previous-version fixture upgrades without losing records or queued changes.

## 3. Authentication and isolated backend

- [x] 3.1 Define SAM/CloudFormation resources for the dedicated DynamoDB table/index, backup and retain policies, Lambda URL, scoped IAM, Cognito federation, and external parameters; verify template validation and that no existing app resource is targeted.
- [x] 3.2 Implement Cognito code/PKCE login, callback, refresh, and logout with minimal scopes; verify callback error recovery, expired sessions, and local cleanup using synthetic identities.
- [x] 3.3 Implement server token validation and subject allowlist enforcement for every data route; verify missing, expired, forged, wrong-client, wrong-token-type, and unlisted tokens are denied.
- [x] 3.4 Implement validated profile/exercise/session reads and paginated lists with user-derived keys; verify two-user isolation, spoofed-owner rejection, pagination, and no table scans.
- [x] 3.5 Implement transactional revision-checked mutations and deduplication markers; verify lost-response retries, stale writes, marker expiry, and partial-failure atomicity.
- [x] 3.6 Add bounded requests, exact-origin CORS, redacted errors/logging, and resource limits; verify malformed/oversized requests and ensure test logs contain no tokens or record contents.
- [x] 3.7 Document private Google/Cognito setup, subject enrollment, API contract, and rollback; verify all examples use placeholders and admission fails closed before owner configuration.

## 4. Synchronization and recovery

- [x] 4.1 Implement per-record/workout outbox serialization, transient retry, and acknowledgment handling; verify reconnect sync and exactly-once visible results after lost acknowledgments.
- [x] 4.2 Implement save-status feedback and reauthentication recovery without interrupting local logging; verify offline reload, API failure, and expired-session scenarios.
- [x] 4.3 Implement stale-revision comparison and explicit keep-local/keep-server conflict resolution; verify local drafts survive and stale data is never silently applied.
- [x] 4.4 Implement pending-write logout handling and safe cache cleanup; verify sync/discard choices and no previous-account data after logout.
- [x] 4.5 Document sync states and recovery steps; verify documented actions against simulated offline, validation-error, and conflict conditions.

## 5. Workout experience and rest timer

- [x] 5.1 Build the mobile Today/History/Exercises shell with system/light/dark themes and large accessible controls; verify 375-pixel layouts, labels, contrast, and theme persistence.
- [x] 5.2 Build editable push/pull/legs exercise choices, recent prioritization, generic seed exercises, and archive behavior; verify library changes preserve historical snapshots.
- [x] 5.3 Build empty-session start/resume/finish and after-set logging with three suggested rows, previous-value prefill, editable sets, angle, and notes; verify a varied multi-exercise session preserves order and counts only confirmed sets.
- [x] 5.4 Build manual rowing inputs, stretch completion, and session notes; verify a mixed session round-trips through local storage and the API.
- [x] 5.5 Implement persisted deadline-based 90-second rest, restart/skip/adjust controls, and negative overtime; verify controlled-clock tests for navigation, reload, and finish cancellation.
- [x] 5.6 Implement optional once-only foreground sound with no push/notification permissions; verify disabled sound, hidden expiry, reload, and no catch-up cue on return.
- [ ] 5.7 Keep the timer fixed and logging controls usable around safe areas and the numeric keyboard; verify scrolling and keyboard behavior in mobile browser tests and record a real-iPhone manual check.
- [x] 5.8 Document logging, timer controls, and foreground-only audio limitations; verify instructions match the delivered UI.

## 6. History and insights

- [x] 6.1 Build paginated session detail and last-performed context with days ago and exact date; verify nine-day, same-day, timezone-boundary, and no-history cases.
- [x] 6.2 Build workout-frequency and per-exercise weight/rep and volume views; verify mixed units, angle cohorts, edited sets, and incomplete-set exclusion with synthetic histories.
- [x] 6.3 Build matching-distance rowing pace trends and explicit empty/partial-history states; verify incompatible distances are not pooled and older data can be loaded.
- [x] 6.4 Document metric definitions and loaded-history coverage; verify chart labels and examples agree with tested calculations.

## 7. Home Screen and deployment

- [x] 7.1 Add manifest, icons, and versioned static-shell caching without API/auth response caching; verify installation metadata, offline reopening, and updates that preserve drafts/outbox.
- [ ] 7.2 Configure GitHub Actions Pages publishing and scoped AWS OIDC deployment with private parameters and a generated domain binding; verify workflow permissions and scan final artifacts for secrets and personal fixtures.
- [ ] 7.3 Provision the isolated backend, configure Google callbacks and owner admission privately, and verify owner login succeeds while another synthetic/unlisted identity is denied.
- [ ] 7.4 Deploy frontend and configured subdomain with HTTPS; verify direct-route reloads, authentication redirects, API CORS, and that existing applications remain reachable.
- [ ] 7.5 Document releases, restore/rollback, retention, and configuration rotation; verify a rollback rehearsal retains the table and workout records.

## 8. End-to-end acceptance

- [ ] 8.1 Run the complete test/check/build suite and privacy scans; verify all capability scenarios have passing automated checks or explicit manual evidence.
- [ ] 8.2 Exercise a complete weights/rowing/stretch session on a real iPhone in Safari and Home Screen mode, including dark appearance, keyboard use, audio, lock/return overtime, and offline reload; record results and resolve failures before delivery.
- [ ] 8.3 Verify cloud recovery on another browser after sync, conflict handling, and logout privacy; confirm no duplicate sets and no cross-account access.
- [ ] 8.4 Review tracked files and outgoing Git history, publish the final reviewed commit, and confirm the deployed version matches it with no deferred enhancements accidentally enabled.

## Implementation checkpoint

Owner explicitly selected public source and GitHub Pages. Local implementation of sections 3–6 and 7.1 is complete and verified: 36 unit/API tests (including end-to-end sync through the real handler with a DynamoDB fake), 15 Playwright tests at 375 px in WebKit and Chromium (logging, timer and cue, layout and targets, theme persistence, offline reopen), a contrast check, type checking, build, and artifact and privacy scans. 5.7 awaits a real-iPhone keyboard check. 7.2 workflows and the deploy-access template are written and validated locally but have not run on GitHub. 7.3 onward needs owner-supplied deployment values (Google client, region, subdomain) and approval to create AWS resources.
