import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordKey, seedExercises, snapshot, workoutSchema, type LiftSet, type Rowing, type Workout, type WorkoutRecord } from '../src/lib/domain/model';
import { entryRemoval, workoutDeletion } from '../src/lib/domain/session';
import { finishedWorkouts, lastPerformed, strengthTrends, workouts } from '../src/lib/domain/history';

function session(setCounts: number[], finished = true) {
  const started = new Date('2026-03-01T18:00:00');
  const workout: Workout = { schemaVersion: 1, kind: 'workout', id: crypto.randomUUID(), startedAt: started.toISOString(), localDate: '2026-03-01',
    timezone: 'Synthetic/Zone', status: finished ? 'finished' : 'active', notes: 'private note', stretched: true,
    ...(finished ? { endedAt: new Date(started.getTime() + 3600000).toISOString() } : {}) };
  const records: WorkoutRecord[] = [workout];
  const [exercise] = seedExercises();
  setCounts.forEach((count, position) => {
    const entry = snapshot(exercise, workout.id, position);
    records.push(entry, ...Array.from({ length: count }, (_, i): LiftSet => ({ schemaVersion: 1, kind: 'set', id: crypto.randomUUID(),
      workoutId: workout.id, entryId: entry.id, position: i, weight: 100, unit: 'lb', reps: 5, completedAt: workout.startedAt })));
  });
  return { workout, records, exercise };
}

test('entry removal batches sets before their entry within the mutation limit', () => {
  const { workout, records } = session([40, 2]);
  const big = records.find(r => r.kind === 'strength')!;
  if (big.kind !== 'strength') throw new Error();
  const batches = entryRemoval(records, workout, big);
  assert.deepEqual(batches.map(b => b.removed.length), [19, 19, 3]);
  assert.ok(batches.every(b => b.values.length === 1 && b.values[0] === workout && b.removed.length + b.values.length <= 20));
  const order = batches.flatMap(b => b.removed);
  assert.equal(order.at(-1), recordKey(big), 'entry removed last');
  assert.equal(new Set(order).size, 41);
  assert.ok(order.slice(0, 40).every(k => k.includes('#SET#')));
  const row: Rowing = { schemaVersion: 1, kind: 'rowing', id: crypto.randomUUID(), workoutId: workout.id, position: 5, notes: '', seconds: 480, meters: 2000 };
  assert.deepEqual(entryRemoval([...records, row], workout, row), [{ values: [workout], removed: [recordKey(row)] }]);
});

test('workout deletion writes a content-free tombstone first and erases every child', () => {
  const { workout, records, exercise } = session([20, 3]);
  const batches = workoutDeletion(records, workout);
  const tombstone = batches[0].values[0] as Workout;
  assert.equal(tombstone.status, 'deleted');
  assert.equal(tombstone.notes, ''); assert.equal(tombstone.stretched, false); assert.equal('endedAt' in tombstone, false);
  assert.equal(tombstone.id, workout.id);
  assert.ok(workoutSchema.safeParse(tombstone).success);
  assert.ok(batches.every(b => b.values[0] === tombstone && b.removed.length <= 19));
  const removed = batches.flatMap(b => b.removed);
  const children = records.filter(r => r.kind !== 'workout').map(recordKey);
  assert.deepEqual(new Set(removed), new Set(children));
  const lastSet = Math.max(...removed.map((k, i) => k.includes('#SET#') ? i : -1));
  const firstEntry = removed.findIndex(k => k.includes('#ENTRY#'));
  assert.ok(lastSet < firstEntry, 'all sets precede entries');
  assert.deepEqual(workoutDeletion([workout], workout).map(b => b.removed), [[]]);

  // After applying the batches, history and metrics no longer see the workout.
  const after = [...records.filter(r => r.kind === 'workout' ? false : !removed.includes(recordKey(r))), tombstone];
  assert.equal(finishedWorkouts(after).length, 0);
  assert.equal(workouts(after).find(w => w.status === 'active'), undefined);
  assert.equal(lastPerformed(after, exercise.id), undefined);
  assert.deepEqual(strengthTrends(after, 5), []);
});
