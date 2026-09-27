import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverage, dayLabel, daysAgo, lastPerformed, localDate, recentCount, rowingTrends, strengthTrends, weeklyFrequency } from '../src/lib/domain/history';
import { seedExercises, snapshot, type Exercise, type LiftSet, type Rowing, type Workout, type WorkoutRecord } from '../src/lib/domain/model';
import { confirmSet, emptyDraft, parseSetInput, prefill, rowingEntry, suggestedRows } from '../src/lib/domain/session';

// Synthetic history builder: dates are local calendar dates.
function workout(date: string, hour = 18, status: Workout['status'] = 'finished'): Workout {
  const started = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
  return { schemaVersion: 1, kind: 'workout', id: crypto.randomUUID(), startedAt: started.toISOString(), localDate: date,
    timezone: 'Synthetic/Zone', status, notes: '', stretched: false, ...(status === 'finished' ? { endedAt: new Date(started.getTime() + 3600000).toISOString() } : {}) };
}
function lift(w: Workout, exercise: Exercise, position: number, values: [number, number, 'lb' | 'kg'][], angle?: number) {
  const entry = { ...snapshot(exercise, w.id, position), details: angle === undefined ? {} : { angle } };
  const sets: LiftSet[] = values.map(([weight, reps, unit], i) => ({ schemaVersion: 1, kind: 'set', id: crypto.randomUUID(), workoutId: w.id,
    entryId: entry.id, position: i, weight, unit, reps, completedAt: w.startedAt }));
  return [entry, ...sets];
}
const row = (w: Workout, meters: number, seconds: number, position = 9): Rowing =>
  ({ schemaVersion: 1, kind: 'rowing', id: crypto.randomUUID(), workoutId: w.id, position, notes: '', seconds, meters });
const [bench, , , pulldown] = seedExercises();
const incline = seedExercises()[1];

test('last performed: nine days, same day, no history, and the latest earlier session wins', () => {
  const now = new Date('2026-03-10T12:00:00');
  const old = workout('2026-02-20'); const nine = workout('2026-03-01'); const today = workout('2026-03-10', 7);
  const current = workout('2026-03-10', 11, 'active');
  const records: WorkoutRecord[] = [old, nine, today, current,
    ...lift(old, bench, 0, [[100, 5, 'lb']]), ...lift(nine, bench, 0, [[135, 8, 'lb'], [145, 6, 'lb'], [150, 4, 'lb']], 30), ...lift(today, pulldown, 0, [[80, 10, 'lb']])];
  const found = lastPerformed(records, bench.id, current.id)!;
  assert.equal(found.workout.id, nine.id);
  assert.equal(daysAgo(found.workout, now), 9);
  assert.equal(dayLabel(daysAgo(found.workout, now)), '9 days ago');
  assert.deepEqual(found.entries[0].sets.map(s => [s.weight, s.reps]), [[135, 8], [145, 6], [150, 4]]);
  assert.equal(found.entries[0].entry.details.angle, 30);
  assert.equal(dayLabel(daysAgo(lastPerformed(records, pulldown.id, current.id)!.workout, now)), 'Today');
  assert.equal(lastPerformed(records, seedExercises()[6].id, current.id), undefined);
  // Unfinished sessions and entries without confirmed sets are not history.
  const draftOnly = workout('2026-03-09', 18, 'active');
  assert.equal(lastPerformed([draftOnly, ...lift(draftOnly, pulldown, 0, [[1, 1, 'lb']])], pulldown.id), undefined);
});

test('days ago uses the recorded local date, not UTC, across time-zone boundaries', () => {
  // 23:30 local on Mar 1 is already Mar 2 in UTC for western zones; the recorded local date governs.
  const late = { localDate: '2026-03-01' };
  assert.equal(daysAgo(late, new Date('2026-03-02T00:10:00')), 1);
  assert.equal(daysAgo(late, new Date('2026-03-01T23:59:00')), 0);
  assert.equal(localDate(new Date('2026-03-01T23:30:00')), '2026-03-01');
  // Month and daylight-saving boundaries count calendar days.
  assert.equal(daysAgo({ localDate: '2026-02-28' }, new Date('2026-03-09T09:00:00')), 9);
  assert.equal(daysAgo({ localDate: '2026-11-01' }, new Date('2026-11-02T09:00:00')), 1);
});

test('strength trends convert units, separate angles, reflect edits, and ignore unconfirmed sets', () => {
  const a = workout('2026-03-01'); const b = workout('2026-03-05'); const active = workout('2026-03-06', 18, 'active');
  const records: WorkoutRecord[] = [a, b, active,
    ...lift(a, incline, 0, [[100, 8, 'lb'], [110, 8, 'lb']], 30),
    ...lift(a, incline, 1, [[80, 8, 'lb']], 45),
    ...lift(b, incline, 0, [[50, 8, 'kg'], [55, 5, 'kg']], 30),
    ...lift(active, incline, 0, [[500, 8, 'lb']], 30)];
  const trends = strengthTrends(records, 8, 'lb');
  assert.equal(trends.length, 2, 'angle variants are separate cohorts');
  const thirty = trends.find(t => t.angle === 30)!;
  assert.equal(thirty.points.length, 2, 'active workouts do not count');
  assert.equal(thirty.points[0].best, 110);
  assert.ok(Math.abs(thirty.points[1].best! - 50 / 0.45359237) < 1e-9, 'kg converted to lb');
  assert.equal(thirty.points[0].volume, 100 * 8 + 110 * 8);
  assert.ok(Math.abs(thirty.points[1].volume - (50 * 8 + 55 * 5) / 0.45359237) < 1e-6);
  assert.equal(strengthTrends(records, 5, 'kg').find(t => t.angle === 30)!.points[1].best, 55);
  assert.equal(strengthTrends(records, 12, 'kg').find(t => t.angle === 30)!.points[0].best, null);

  // Editing a set changes the metric; a removed set disappears from it.
  const edited = records.map(r => r.kind === 'set' && r.workoutId === a.id && r.weight === 110 ? { ...r, weight: 120 } : r);
  assert.equal(strengthTrends(edited, 8, 'lb').find(t => t.angle === 30)!.points[0].best, 120);
  const removed = records.filter(r => !(r.kind === 'set' && r.workoutId === a.id && r.weight === 110));
  assert.equal(strengthTrends(removed, 8, 'lb').find(t => t.angle === 30)!.points[0].best, 100);
});

test('two confirmed sets and one suggested row contribute exactly two sets', () => {
  const w = workout('2026-03-01', 18, 'active');
  const entry = snapshot(bench, w.id, 0);
  let records: WorkoutRecord[] = [w, entry];
  for (const [weight, reps] of [['100', '8'], ['105', '6']]) {
    const result = confirmSet(records, w, entry, { ...emptyDraft(), weight, reps });
    records = [...records.filter(r => !result.records.some(n => n.kind === r.kind && 'id' in n && 'id' in r && n.id === r.id)), ...result.records];
  }
  assert.equal(suggestedRows(2), 0);
  assert.equal(suggestedRows(0), 2);
  const finished = records.map(r => r.kind === 'workout' ? { ...r, status: 'finished' as const, endedAt: new Date().toISOString() } : r);
  assert.equal(strengthTrends(finished, 8, 'lb')[0].points[0].volume, 100 * 8 + 105 * 6);
});

test('rowing trends group matching distances only, and coverage flags partial history', () => {
  const a = workout('2026-03-01'); const b = workout('2026-03-03'); const c = workout('2026-03-05');
  const records: WorkoutRecord[] = [a, b, c, row(a, 2000, 480), row(b, 2000.4, 470), row(c, 5000, 1250)];
  const trends = rowingTrends(records);
  assert.deepEqual(trends.map(t => [t.meters, t.points.length]), [[2000, 2], [5000, 1]]);
  assert.equal(trends[0].points[0].split, 120);
  assert.ok(trends[0].points[1].split < 120);
  assert.deepEqual(coverage(records, true), { count: 3, since: '2026-03-01', complete: false });
  assert.deepEqual(coverage([], false), { count: 0, since: undefined, complete: true });
});

test('weekly frequency counts finished sessions by local calendar week', () => {
  const now = new Date('2026-03-11T12:00:00'); // Wednesday
  const records = [workout('2026-03-09'), workout('2026-03-11'), workout('2026-03-08'), workout('2026-01-01'), workout('2026-03-10', 18, 'active')];
  const weeks = weeklyFrequency(records, 8, now);
  assert.equal(weeks.length, 8);
  assert.equal(weeks.at(-1)!.count, 2);
  assert.equal(weeks.at(-2)!.count, 1);
  assert.equal(weeks.reduce((n, w) => n + w.count, 0), 3);
  assert.equal(recentCount(records, 30, now), 3);
});

test('set inputs, prefill, angle variants, and rowing entries follow the logging rules', () => {
  assert.throws(() => parseSetInput('-1', '5'), /negative/);
  assert.throws(() => parseSetInput('100', '0'), /whole number/);
  assert.throws(() => parseSetInput('100', '2.5'), /whole number/);
  assert.throws(() => parseSetInput('', '5'), /weight/);
  assert.deepEqual(parseSetInput('0', '12'), { weight: 0, reps: 12 });
  const w = workout('2026-03-01', 18, 'active');
  const entry = snapshot(incline, w.id, 0);
  const first = confirmSet([w, entry], w, entry, { ...emptyDraft(), weight: '95', reps: '10', angle: '30' });
  assert.equal(first.entry.id, entry.id);
  const records = [w, ...first.records];
  const variant = confirmSet(records, w, first.entry, { ...emptyDraft(), weight: '85', reps: '10', angle: '45' });
  assert.notEqual(variant.entry.id, entry.id, 'a new angle creates a separate entry');
  assert.equal(variant.entry.position, 1);
  assert.equal(variant.entry.details.angle, 45);
  assert.deepEqual(prefill([], [first.records[1] as LiftSet], 'kg'), { weight: '95', reps: '10', unit: 'lb' });
  assert.deepEqual(prefill([], undefined, 'kg'), { weight: '', reps: '', unit: 'kg' });
  const rowing = rowingEntry(records, w, { rowTime: '10:00', rowDistance: '', rowSplit: '2:00' });
  assert.equal(rowing.meters, 2500);
  assert.equal(rowing.position, 1);
  assert.throws(() => rowingEntry(records, w, { rowTime: '8:00', rowDistance: '2000', rowSplit: '2:20' }), /disagree/);
});
