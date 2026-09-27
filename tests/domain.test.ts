import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedExercises, snapshot, newWorkout, setSchema, recordSchema } from '../src/lib/domain/model';
import { deriveRow, weightInKg, parseTime } from '../src/lib/domain/rowing';

test('historical snapshot keeps the original exercise and angle', () => {
  const exercise = seedExercises()[1];
  const entry = snapshot(exercise, newWorkout().id, 0);
  exercise.name = 'Renamed'; exercise.details.angle = 45;
  assert.equal(entry.exerciseName, 'Incline bench press');
  assert.equal(entry.details.angle, 30);
});
test('sets reject invalid values and owner injection', () => {
  const set = { schemaVersion: 1, kind: 'set', id: crypto.randomUUID(), workoutId: crypto.randomUUID(),
    entryId: crypto.randomUUID(), position: 0, weight: 80, unit: 'kg', reps: 8, completedAt: new Date().toISOString() };
  assert.equal(setSchema.parse(set).reps, 8);
  for (const patch of [{ reps: 1.5 }, { reps: 0 }, { weight: -1 }, { owner: 'other' }]) assert.equal(recordSchema.safeParse({ ...set, ...patch }).success, false);
});
test('rowing derives each possible missing value and rejects bad triples', () => {
  assert.deepEqual(deriveRow({ meters: 2000, seconds: 480 }), { meters: 2000, seconds: 480, split: 120 });
  assert.equal(deriveRow({ seconds: 600, split: 120 }).meters, 2500);
  assert.equal(deriveRow({ meters: 2000, split: 120 }).seconds, 480);
  assert.throws(() => deriveRow({ seconds: 480, meters: 2000, split: 140 }));
  for (const seconds of [0, -1, NaN, Infinity]) assert.throws(() => deriveRow({ seconds, meters: 2000 }));
  assert.equal(parseTime('2:00'), 120); assert.throws(() => parseTime('2:99'));
});
test('mixed-unit comparisons normalize to kilograms', () => {
  assert.ok(Math.abs(weightInKg(100, 'lb') - 45.359237) < 1e-8);
  assert.equal(weightInKg(45, 'kg'), 45);
});
