import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from '../backend/api';
import { DynamoRepository } from '../backend/dynamo';
import { ApiError } from '../backend/repository';
import { LocalStore, openWorkoutDB } from '../src/lib/storage/database';
import { createApi, fetchAggregate, HttpError, pullLibrary, pullWorkouts, SyncEngine, type SyncStatus } from '../src/lib/storage/sync';
import { defaultProfile, newWorkout, recordKey, seedExercises, snapshot, type LiftSet, type Rowing, type Workout } from '../src/lib/domain/model';
import { entries, sets } from '../src/lib/domain/history';
import { fakeDynamo } from './fake-dynamo';

const origin = 'https://app.example.com';
// Synthetic bearer tokens map to synthetic subjects; only two are admitted.
const subjects: Record<string, string> = { 'token-a': 'synthetic-a', 'token-b': 'synthetic-b', 'token-c': 'synthetic-unlisted' };
function server() {
  const db = fakeDynamo();
  const handler = createHandler(new DynamoRepository(db.client, 'synthetic-table'), async token => {
    const subject = subjects[token];
    if (!subject) throw new ApiError(401, 'Sign in to continue.');
    if (subject === 'synthetic-unlisted') throw new ApiError(403, 'Account not admitted.');
    return subject;
  }, origin, () => {});
  let dropNextResponse = false;
  const request = (token: string): typeof fetch => async (input, init) => {
    const url = new URL(String(input));
    const event = { rawPath: url.pathname, headers: { authorization: `Bearer ${token}`, origin, 'content-type': 'application/json' },
      queryStringParameters: Object.fromEntries(url.searchParams), requestContext: { http: { method: init?.method || 'GET' }, requestId: 'synthetic' },
      body: init?.body as string | undefined, isBase64Encoded: false } as unknown as APIGatewayProxyEventV2;
    const result = await handler(event);
    if (dropNextResponse) { dropNextResponse = false; throw new TypeError('Network connection lost'); }
    return new Response(result.body as string, { status: result.statusCode });
  };
  return { db, request, dropNext() { dropNextResponse = true; } };
}
async function device(owner: string, fetcher: typeof fetch, token: string) {
  const store = new LocalStore(await openWorkoutDB(crypto.randomUUID()), owner);
  const api = createApi('https://api.example.com/', async () => token, fetcher);
  const states: SyncStatus[] = [];
  const engine = new SyncEngine(store, m => api('/mutations', m), s => states.push(s), () => true, async () => {}, () => 0 as never);
  return { store, api, engine, states };
}
const setOf = (w: Workout, entryId: string, position: number, weight: number, reps: number, unit: 'lb' | 'kg' = 'lb'): LiftSet =>
  ({ schemaVersion: 1, kind: 'set', id: crypto.randomUUID(), workoutId: w.id, entryId, position, weight, unit, reps, completedAt: new Date().toISOString() });

test('a mixed session syncs once despite a lost acknowledgment and restores on another browser', async () => {
  const cloud = server();
  const phone = await device('synthetic-a', cloud.request('token-a'), 'token-a');
  const library = seedExercises();
  await phone.store.save([{ ...defaultProfile, unit: 'kg' }]);
  for (const e of library) await phone.store.save([e]);
  const workout = newWorkout();
  await phone.store.save([workout]);
  const bench = snapshot(library[1], workout.id, 0);
  await phone.store.save([bench, setOf(workout, bench.id, 0, 60, 10, 'kg')]);
  await phone.store.save([bench, setOf(workout, bench.id, 1, 65, 8, 'kg')]);
  const row: Rowing = { schemaVersion: 1, kind: 'rowing', id: crypto.randomUUID(), workoutId: workout.id, position: 1, notes: 'steady', seconds: 480, meters: 2000 };
  await phone.store.save([row]);
  const benchAgain = { ...snapshot({ ...library[1], details: { angle: 45 } }, workout.id, 2), notes: 'felt strong' };
  await phone.store.save([benchAgain, setOf(workout, benchAgain.id, 0, 50, 12, 'kg')]);
  await phone.store.save([{ ...workout, status: 'finished', endedAt: new Date().toISOString(), stretched: true, notes: 'good session' }]);

  cloud.dropNext();
  await phone.engine.flush();
  assert.equal((await phone.store.pending()).length, 0);
  assert.equal(phone.states.at(-1), 'synced');
  const setRows = [...cloud.db.items.values()].filter(i => String(i.sk).includes('#SET#'));
  assert.equal(setRows.length, 3, 'lost acknowledgment did not duplicate sets');

  const laptop = await device('synthetic-a', cloud.request('token-a'), 'token-a');
  await pullLibrary(laptop.api, laptop.store);
  assert.equal(await pullWorkouts(laptop.api, laptop.store), undefined);
  const restored = (await laptop.store.records()).map(r => r.value);
  const order = entries(restored, workout.id);
  assert.deepEqual(order.map(e => e.kind === 'strength' ? `${e.exerciseName}@${e.details.angle}` : 'rowing'),
    ['Incline bench press@30', 'rowing', 'Incline bench press@45']);
  assert.deepEqual(sets(restored, bench.id).map(s => [s.weight, s.reps, s.unit]), [[60, 10, 'kg'], [65, 8, 'kg']]);
  assert.equal(order[2].notes, 'felt strong');
  const meta = restored.find((r): r is Workout => r.kind === 'workout');
  assert.equal(meta?.stretched, true); assert.equal(meta?.notes, 'good session'); assert.equal(meta?.status, 'finished');
  assert.equal(restored.filter(r => r.kind === 'exercise').length, library.length);
  assert.equal(restored.find(r => r.kind === 'profile')?.kind === 'profile' && (restored.find(r => r.kind === 'profile') as typeof defaultProfile).unit, 'kg');

  // Other accounts see nothing; unlisted accounts are refused outright.
  const other = await device('synthetic-b', cloud.request('token-b'), 'token-b');
  await pullLibrary(other.api, other.store); await pullWorkouts(other.api, other.store);
  assert.equal((await other.store.records()).length, 0);
  await assert.rejects(other.api(`/workouts/${workout.id}`), (e: HttpError) => e.status === 404);
  const unlisted = await device('synthetic-unlisted', cloud.request('token-c'), 'token-c');
  await assert.rejects(unlisted.api('/workouts'), (e: HttpError) => e.status === 403);
});

test('a stale edit becomes an explicit conflict; keep-local merges and keep-server discards', async () => {
  const cloud = server();
  const phone = await device('synthetic-a', cloud.request('token-a'), 'token-a');
  const laptop = await device('synthetic-a', cloud.request('token-a'), 'token-a');
  const [exercise] = seedExercises();
  const workout = newWorkout();
  const entry = snapshot(exercise, workout.id, 0);
  await phone.store.save([workout]); await phone.store.save([entry, setOf(workout, entry.id, 0, 100, 5)]);
  await phone.engine.flush();
  await pullWorkouts(laptop.api, laptop.store);

  // Both devices edit the same workout while apart.
  const laptopSet = setOf(workout, entry.id, 1, 105, 5);
  await laptop.store.save([entry, laptopSet]); await laptop.engine.flush();
  const phoneSet = setOf(workout, entry.id, 1, 110, 3);
  await phone.store.save([entry, phoneSet]);
  await phone.store.save([{ ...workout, notes: 'phone note' }]);
  // An unrelated record still syncs while the workout waits for a decision.
  await phone.store.save([{ ...defaultProfile, sound: true }]);
  await phone.engine.flush();
  assert.equal(phone.states.at(-1), 'conflict');
  const pending = await phone.store.pending();
  assert.equal(pending.length, 2);
  assert.ok(pending.every(p => p.aggregate === recordKey(workout)));
  assert.equal(pending[0].error, 'conflict');
  assert.ok(cloud.db.items.has('USER#synthetic-a\u0000PROFILE'));
  // The local draft survives and nothing stale reached the server.
  assert.ok((await phone.store.records()).some(r => r.key === recordKey(phoneSet)));
  assert.equal([...cloud.db.items.values()].some(i => i.sk === recordKey(phoneSet)), false);

  const remote = await fetchAggregate(phone.api, recordKey(workout));
  await phone.store.resolve(recordKey(workout), remote, 'local');
  await phone.engine.flush();
  assert.equal(phone.states.at(-1), 'synced');
  const merged = (await phone.store.records()).map(r => r.value);
  assert.deepEqual(sets(merged, entry.id).map(s => s.weight).sort(), [100, 105, 110]);
  assert.equal(merged.find((r): r is Workout => r.kind === 'workout')?.notes, 'phone note');
  await pullWorkouts(laptop.api, laptop.store);
  assert.deepEqual(sets((await laptop.store.records()).map(r => r.value), entry.id).map(s => s.weight).sort(), [100, 105, 110]);

  // Keep-server: a stale removal is dropped and the server copy wins.
  await laptop.store.save([entry], [recordKey(laptopSet)]); await laptop.engine.flush();
  await phone.store.save([{ ...workout, notes: 'stale edit' }]);
  await phone.engine.flush();
  assert.equal(phone.states.at(-1), 'conflict');
  await phone.store.resolve(recordKey(workout), await fetchAggregate(phone.api, recordKey(workout)), 'server');
  await phone.engine.flush();
  const serverCopy = (await phone.store.records()).map(r => r.value);
  assert.deepEqual(sets(serverCopy, entry.id).map(s => s.weight).sort(), [100, 110]);
  assert.equal(serverCopy.find((r): r is Workout => r.kind === 'workout')?.notes, 'phone note');
  assert.equal((await phone.store.pending()).length, 0);
});

test('expired sessions and transient failures keep writes queued until they can sync', async () => {
  const cloud = server();
  let token = 'expired';
  const store = new LocalStore(await openWorkoutDB(crypto.randomUUID()), 'synthetic-a');
  const api = createApi('https://api.example.com', async () => { if (token === 'expired') throw new Error('refresh failed'); return token; },
    (input, init) => cloud.request(token)(input, init));
  let scheduled = 0; const states: SyncStatus[] = [];
  let online = true;
  const engine = new SyncEngine(store, m => api('/mutations', m), s => states.push(s), () => online, async () => {}, () => { scheduled++; return 0 as never; });
  const workout = newWorkout();
  await store.save([workout]);
  await engine.flush();
  assert.equal(states.at(-1), 'signin');
  assert.equal((await store.pending()).length, 1);
  token = 'token-a';
  online = false;
  await engine.flush();
  assert.equal(states.at(-1), 'local');
  online = true;
  for (let i = 0; i < 4; i++) cloud.dropNext();
  const flaky = new SyncEngine(store, async m => { const result = await api<{ revision: number }>('/mutations', m); return result; }, s => states.push(s), () => online, async () => {}, () => { scheduled++; return 0 as never; });
  cloud.dropNext();
  await flaky.flush();
  assert.equal(states.at(-1), 'synced');
  assert.equal((await store.pending()).length, 0);
  const alwaysDown = new SyncEngine(store, async () => { throw new TypeError('offline'); }, s => states.push(s), () => true, async () => {}, () => { scheduled++; return 0 as never; });
  await store.save([{ ...workout, notes: 'queued' }]);
  await alwaysDown.flush();
  assert.equal(states.at(-1), 'local');
  assert.equal(scheduled, 1, 'a background retry is scheduled');
  assert.equal((await store.pending()).length, 1);
});

test('a server-rejected change is isolated as "failed" and recoverable with the online version', async () => {
  const cloud = server();
  const phone = await device('synthetic-a', cloud.request('token-a'), 'token-a');
  const workout = newWorkout();
  await phone.store.save([workout]);
  await phone.engine.flush();
  // An entry that the server cannot accept: a set whose entry is rowing, which the server rejects.
  const rowing: Rowing = { schemaVersion: 1, kind: 'rowing', id: crypto.randomUUID(), workoutId: workout.id, position: 0, notes: '', seconds: 300, meters: 1000 };
  await phone.store.save([rowing, setOf(workout, rowing.id, 0, 10, 10)]);
  await phone.store.save([{ ...defaultProfile, unit: 'kg' }]);
  await phone.engine.flush();
  assert.equal(phone.states.at(-1), 'failed');
  assert.ok(cloud.db.items.has('USER#synthetic-a\u0000PROFILE'), 'other records still sync');
  await phone.store.resolve(recordKey(workout), await fetchAggregate(phone.api, recordKey(workout)), 'server');
  await phone.engine.flush();
  assert.equal(phone.states.at(-1), 'synced');
  assert.equal((await phone.store.records()).some(r => r.key.includes(rowing.id)), false);
});
