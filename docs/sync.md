# Saving and sync

Every change is written to this device first, in one IndexedDB transaction together with its queued upload. If that write fails, the app says so and the change is not shown as saved. Changes then upload in the order they were made, one record at a time.

## Status chip (top bar)

| Label | Meaning | What to do |
| --- | --- | --- |
| **Synced** | The server has acknowledged every change. | Nothing. |
| **Syncing…** | Uploading queued changes. | Nothing. |
| **Saved on device** | Waiting to upload, either offline or after a temporary server failure. The app retries on reconnect, on return to the app, and every 30 seconds. | Keep logging. Tap the chip to retry now. |
| **Sign in to sync** | The session expired. Changes stay queued. | Tap the chip, sign in, and syncing resumes. |
| **Review a conflict** | Another device changed the same workout, exercise, or settings before this device synced. Nothing was overwritten. | Tap the chip, compare both versions, and choose one. |
| **Sync needs attention** | The server rejected a change as invalid. It is still stored here. | Tap the chip and keep the online version, or retry. |

A conflict or rejection blocks only the record it affects; everything else keeps syncing. Logging and the rest timer never wait on the network.

## Resolving a conflict

- **Keep this device's changes:** the app takes the online version, reapplies your queued edits on top, and sends them against the latest revision. Sets added elsewhere are kept.
- **Use the online version:** your queued edits to that record are discarded and the online copy replaces the local one.
- **Decide later:** both copies stay as they are, and the chip keeps offering the choice.

## Deleting

Removals sync like any other change: saved here first, then uploaded in order, including after going offline. Deleting a workout erases its exercises, sets, and notes from the cloud. The only thing left is a marker with the workout's ID and date, so your other devices remove their copy too. A device that edited the workout before hearing of the deletion shows **Review a conflict**. **Use the online version** accepts the deletion. **Keep this device's changes** is refused, because a deleted workout can't be restored, and shows **Sync needs attention** until you accept the deletion.

## Offline

After you have signed in once on a device, the app opens and logs offline, including after a reload. First sign-in needs a connection. Local storage is not a backup: until the chip says **Synced**, a cleared browser or evicted storage can lose unsynced changes.

## Signing out

Sign-out syncs first. If changes cannot be sent, you choose to try again later or to discard them explicitly. Sign-out then removes this account's records, drafts, and timer from the device, revokes the refresh token, and clears the session. Reopening the app shows nothing private until you sign in again.

## Verified by tests

`tests/roundtrip.test.ts` runs these flows through the real API handler, with a lost network response, offline, an expired session, a conflict (both choices), and a server-rejected change. `tests/sync-timer.test.ts` and `tests/storage.test.ts` cover the local queue.
