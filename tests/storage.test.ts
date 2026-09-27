import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore, openWorkoutDB } from '../src/lib/storage/database';
import { newWorkout, recordKey } from '../src/lib/domain/model';

test('atomic local write and outbox survive reopen, isolated by owner', async () => {
  const name = crypto.randomUUID();
  let db = await openWorkoutDB(name);
  const a = new LocalStore(db, 'synthetic-a');
  const workout = newWorkout();
  await a.save([workout]); await a.setLocal('draft', { reps: '8' });
  assert.equal((await new LocalStore(db, 'synthetic-b').records()).length, 0);
  db.close(); db = await openWorkoutDB(name);
  const resumed = new LocalStore(db, 'synthetic-a');
  assert.equal((await resumed.records())[0].value.kind, 'workout');
  assert.equal((await resumed.pending()).length, 1);
  assert.deepEqual(await resumed.local('draft'), { reps: '8' });
  await assert.rejects(resumed.clear());
  await resumed.clear(true); assert.equal((await resumed.records()).length, 0);
  db.close();
});
test('storage failure rejects instead of claiming a save', async () => {
  const db = await openWorkoutDB(crypto.randomUUID()); db.close();
  await assert.rejects(new LocalStore(db, 'synthetic-a').save([newWorkout()]));
});
test('acknowledgment advances later edits without deleting their local values', async () => {
  const db = await openWorkoutDB(crypto.randomUUID()); const store = new LocalStore(db, 'synthetic-a');
  const workout = newWorkout(); const first = await store.save([workout]);
  await store.save([{ ...workout, notes: 'Second edit' }]);
  await store.acknowledge(first.id, 1);
  assert.equal((await store.pending())[0].baseRevision, 1);
  assert.equal((await store.records())[0].value.kind === 'workout' && ((await store.records())[0].value as typeof workout).notes, 'Second edit');
  db.close();
});
test('schema upgrade preserves v1 records and pending writes', async () => {
  const name = crypto.randomUUID(); const old = await openDB(name, 1, { upgrade(db) {
    db.createObjectStore('records', { keyPath: ['owner', 'key'] }).createIndex('owner', 'owner');
    db.createObjectStore('outbox', { keyPath: ['owner', 'id'] }).createIndex('owner', 'owner');
  } });
  const value = newWorkout(); const owner = 'synthetic-a'; const key = recordKey(value);
  await old.put('records', { owner, key, value, revision: 0 });
  await old.put('outbox', { owner, id: crypto.randomUUID(), aggregate: key, changes: [{ key, value }], baseRevision: 0, createdAt: new Date().toISOString() });
  old.close();
  const db = await openWorkoutDB(name); const store = new LocalStore(db, owner);
  assert.equal((await store.records()).length, 1); assert.equal((await store.pending()).length, 1);
  await store.setLocal('draft', { value: 'survives' }); db.close();
});
