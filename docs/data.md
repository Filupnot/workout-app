# Data and local storage

Every backend key is scoped to the verified subject. No request-supplied owner is accepted. Local IndexedDB keys are pairs of owner and record ID. Synthetic test subjects have no relationship to real accounts.

The domain schemas validate original units, positive integer reps, explicit order, finite bounded numbers, and plain-text notes. Exercise entries copy name/category/details instead of referencing mutable library fields for display. Sets are separate confirmed records; suggested rows are never stored as sets.

Rowing accepts two of duration, meters, and split. The average split is `500 * seconds / meters`. If a third displayed split is supplied, one second of rounding tolerance is allowed; disagreements are rejected. Weights normalize to kilograms using 0.45359237 kg/lb only for comparisons.

Deleting a workout replaces its metadata with a tombstone (`status: deleted`, with notes cleared, the stretch flag false, and no end time) and removes its entries and sets in ordered mutations. Each carries at most 19 removals, and sets always go before their entry. The server refuses to remove an entry while any of its sets remain, to add content to a deleted workout, or to restore one. Views ignore tombstones.

Database version 1 introduced records and pending mutations. Version 2 adds local drafts and timer storage without rewriting or deleting either existing store. The migration test opens a synthetic v1 database with records and queued changes, then upgrades it and verifies preservation. Future upgrades must retain outbox IDs and unsupported data until an explicit migration is available; never delete the database to resolve a version mismatch.

A local save commits record changes and a mutation to a single transaction. Only successful completion permits a Saved on device status. Each mutation has a stable ID and base revision. Acknowledgments remove only their matching outbox item and advance the revision of remaining queued edits. Logout refuses to clear pending writes unless the user explicitly chooses discard. Local storage can fail or be evicted; cloud synchronization is required for durable backup.
