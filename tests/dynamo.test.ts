import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DynamoRepository } from '../backend/dynamo';
import { defaultProfile, newWorkout, recordKey, seedExercises, type WorkoutRecord } from '../src/lib/domain/model';
import { fakeDynamo } from './fake-dynamo';

const create = (value: WorkoutRecord, baseRevision = 0, extra: WorkoutRecord[] = []) => ({ id: crypto.randomUUID(), aggregate: recordKey(value),
  baseRevision, createdAt: new Date().toISOString(), changes: [value, ...extra].map(v => ({ key: recordKey(v), value: v })) });

test('transaction checks revisions and retries without duplication; owners stay isolated', async () => {
  const db = fakeDynamo(); const repo = new DynamoRepository(db.client, 'synthetic-table'); const value = newWorkout();
  const mutation = create(value);
  assert.deepEqual(await repo.mutate('a', mutation), { revision: 1 });
  assert.deepEqual(await repo.mutate('a', mutation), { revision: 1 });
  assert.equal(db.items.size, 2);
  assert.equal((await repo.list('b', 'workouts')).records.length, 0);
  assert.equal((await repo.list('a', 'workouts')).records.length, 1);
  // After marker expiry, the stale base revision still prevents a duplicate write.
  db.items.delete(`USER#a\u0000MUTATION#${mutation.id}`);
  await assert.rejects(repo.mutate('a', mutation), /another device/);
  db.failNext();
  await assert.rejects(repo.mutate('a', { ...mutation, id: crypto.randomUUID(), baseRevision: 1 }));
  assert.equal(db.items.size, 1);
});

test('reads use owner-derived keys, paginate, never scan, and reject foreign cursors', async () => {
  const db = fakeDynamo(); const repo = new DynamoRepository(db.client, 'synthetic-table');
  const start = Date.UTC(2026, 0, 1);
  const created: string[] = [];
  for (let i = 0; i < 55; i++) {
    const workout = newWorkout(new Date(start + i * 86400000));
    created.push(workout.id);
    await repo.mutate('a', create(workout));
  }
  const exercises = seedExercises();
  for (const e of exercises) await repo.mutate('a', create(e));
  await repo.mutate('a', create({ ...defaultProfile, unit: 'kg' }));
  await repo.mutate('b', create(newWorkout()));
  await repo.mutate('b', create(defaultProfile));

  const first = await repo.list('a', 'workouts');
  assert.equal(first.records.length, 50);
  assert.ok(first.cursor);
  assert.equal(first.records[0].value.kind === 'workout' && first.records[0].value.id, created.at(-1), 'newest first');
  const second = await repo.list('a', 'workouts', first.cursor);
  assert.equal(second.records.length, 5);
  assert.equal(second.cursor, undefined);
  assert.equal(new Set([...first.records, ...second.records].map(r => r.key)).size, 55);

  assert.equal((await repo.list('a', 'exercises')).records.length, exercises.length);
  assert.equal((await repo.list('b', 'exercises')).records.length, 0);
  const unit = async (owner: string) => { const value = (await repo.detail(owner, 'PROFILE')).records[0].value; return value.kind === 'profile' ? value.unit : undefined; };
  assert.equal(await unit('a'), 'kg');
  assert.equal(await unit('b'), 'lb');

  // Another owner's workout ID resolves only within the caller's partition.
  assert.equal((await repo.detail('b', `WORKOUT#${created[0]}#META`)).records.length, 0);
  assert.equal((await repo.detail('a', `WORKOUT#${created[0]}#META`)).records.length, 1);

  // Cursors cannot switch owners, prefixes, or smuggle extra attributes.
  const cursor = (key: object) => Buffer.from(JSON.stringify(key)).toString('base64url');
  const foreign = cursor({ pk: 'USER#b', sk: `WORKOUT#${created[0]}#META`, GSI1PK: 'USER#b', GSI1SK: 'DATE#x' });
  await assert.rejects(repo.list('a', 'workouts', foreign), /cursor/);
  await assert.rejects(repo.list('b', 'workouts', first.cursor), /cursor/);
  await assert.rejects(repo.list('a', 'exercises', cursor({ pk: 'USER#a', sk: 'PROFILE' })), /cursor/);
  await assert.rejects(repo.list('a', 'exercises', cursor({ pk: 'USER#a', sk: `EXERCISE#${exercises[0].id}`, extra: 1 })), /cursor/);
  await assert.rejects(repo.list('a', 'exercises', 'not-json'), /cursor/);
  assert.equal(db.commands.includes('ScanCommand'), false);
});

test('workout detail pages through children and exposes no mutation markers', async () => {
  const db = fakeDynamo(); const repo = new DynamoRepository(db.client, 'synthetic-table');
  const workout = newWorkout(); let revision = (await repo.mutate('a', create(workout))).revision;
  const [exercise] = seedExercises();
  for (let e = 0; e < 3; e++) {
    const entry = { schemaVersion: 1 as const, kind: 'strength' as const, id: crypto.randomUUID(), workoutId: workout.id, position: e, notes: '',
      exerciseId: exercise.id, exerciseName: exercise.name, category: exercise.category, details: {} };
    const sets = Array.from({ length: 19 }, (_, i) => ({ schemaVersion: 1 as const, kind: 'set' as const, id: crypto.randomUUID(), workoutId: workout.id,
      entryId: entry.id, position: i, weight: 100, unit: 'lb' as const, reps: 5, completedAt: new Date().toISOString() }));
    const m = { ...create(workout, revision, [entry, ...sets.slice(0, 18)]) };
    revision = (await repo.mutate('a', { ...m, changes: m.changes.slice(1) })).revision;
  }
  const rows = [];
  let cursor: string | undefined;
  do { const page = await repo.detail('a', recordKey(workout), cursor); rows.push(...page.records); cursor = page.cursor; } while (cursor);
  assert.equal(rows.length, 1 + 3 + 54);
  assert.ok(rows.every(r => r.key.startsWith(`WORKOUT#${workout.id}#`)));
  assert.equal(rows.find(r => r.key === recordKey(workout))?.revision, revision);
});
