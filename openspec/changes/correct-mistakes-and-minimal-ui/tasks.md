# Tasks

## 1. Deletion model and server rules

- [x] 1.1 Add the `deleted` workout status and batch planners for entry removal and workout deletion (sets before entries, at most 19 removals per batch, tombstone in the first batch); verify with unit tests for batch order and size, a 40-set entry, and tombstone contents.
- [x] 1.2 Enforce server rules: reject entry removal while its sets remain, reject new content for a deleted workout, keep metadata deletion forbidden; verify with repository tests using the DynamoDB fake, including a query-only (no scan) check.
- [x] 1.3 Verify deletion sync end to end through the API handler: deletion reaches a second device, cloud storage keeps only the content-free tombstone, a stale device's edit becomes a conflict and resolves without silent loss, and an offline deletion completes on reconnect.

## 2. Removal controls

- [x] 2.1 Add confirmed removal of any entry in the workout in progress, clearing the selection if it was active; verify with a browser test that removes one entry, cancels another removal, and checks order and set counts.
- [x] 2.2 Add confirmed deletion of the workout in progress (stopping the timer) and of finished workouts from History; verify with browser tests that history, last time, and metrics exclude them, and that the library exercise remains.
- [x] 2.3 Update `docs/using.md`, `docs/sync.md`, and `docs/data.md` for removal, tombstones, and conflicts after deletion; verify each statement against the tests above.

## 3. Minimal copy and help

- [x] 3.1 Remove eyebrows, taglines, captions, and reassurance text from all views, keeping titles, labels, values, status, errors, empty-state prompts, and one-line instructions; verify with a browser test that retained labels and instructions exist, removed phrases are absent, and every control keeps an accessible name.
- [x] 3.2 Add a single labeled Help (ⓘ) control in the top bar opening a sheet with Logging, Rest timer & sound, Sync status, and History metrics sections; verify with a browser test that it opens and closes without changing workout or timer state, and that its contents match the docs.
- [x] 3.3 Re-run the 375-pixel layout, target-size, and contrast checks and capture before/after screenshots of each view for review.

## 4. Release

- [ ] 4.1 Run unit, bundle, type, browser, and privacy checks; deploy the backend, then publish the frontend; verify removal of a test entry and deletion of a test workout in production, and delete the owner's mock workout on request.
