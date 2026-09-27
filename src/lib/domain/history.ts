import type { WorkoutRecord, Workout, Strength, LiftSet, Rowing } from './model';
import { weightInKg } from './rowing';

export const workouts = (records: WorkoutRecord[]) => records.filter((r): r is Workout => r.kind === 'workout').sort((a, b) => b.startedAt.localeCompare(a.startedAt));
export const finishedWorkouts = (records: WorkoutRecord[]) => workouts(records).filter(w => w.status === 'finished');
export const entries = (records: WorkoutRecord[], id: string) => records.filter((r): r is Strength | Rowing => (r.kind === 'strength' || r.kind === 'rowing') && r.workoutId === id).sort((a, b) => a.position - b.position);
export const sets = (records: WorkoutRecord[], id: string) => records.filter((r): r is LiftSet => r.kind === 'set' && r.entryId === id).sort((a, b) => a.position - b.position);

/** YYYY-MM-DD for the device's current calendar day. */
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
const dayNumber = (date: string) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
/**
 * Calendar days between the workout's own local date and today's local date. Using the recorded
 * local date keeps a late-evening session on the day it happened even after changing time zones.
 */
export function daysAgo(workout: Pick<Workout, 'localDate'>, now = new Date()) {
  return Math.max(0, dayNumber(localDate(now)) - dayNumber(workout.localDate));
}
export function dayLabel(days: number) { return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`; }
export function exactDate(workout: Pick<Workout, 'localDate'>) {
  const [y, m, d] = workout.localDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** The latest earlier finished session with confirmed sets for this exercise. */
export function lastPerformed(records: WorkoutRecord[], exerciseId: string, currentId?: string) {
  const current = records.find((r): r is Workout => r.kind === 'workout' && r.id === currentId);
  for (const workout of finishedWorkouts(records)) {
    if (workout.id === currentId || (current && workout.startedAt >= current.startedAt)) continue;
    const performed = entries(records, workout.id).filter((e): e is Strength => e.kind === 'strength' && e.exerciseId === exerciseId && sets(records, e.id).length > 0);
    if (performed.length) return { workout, entries: performed.map(entry => ({ entry, sets: sets(records, entry.id) })) };
  }
}

/** Finished workouts per week (Monday start) for the last `weeks` weeks, oldest first. */
export function weeklyFrequency(records: WorkoutRecord[], weeks = 8, now = new Date()) {
  const today = dayNumber(localDate(now));
  const monday = today - ((new Date(today * 86400000).getUTCDay() + 6) % 7);
  const counts = Array.from({ length: weeks }, (_, i) => ({ weekStart: monday - (weeks - 1 - i) * 7, count: 0 }));
  for (const w of finishedWorkouts(records)) {
    const bucket = counts.find(c => { const d = dayNumber(w.localDate); return d >= c.weekStart && d < c.weekStart + 7; });
    if (bucket) bucket.count++;
  }
  return counts.map(c => ({ label: new Date(c.weekStart * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }), count: c.count }));
}
export function recentCount(records: WorkoutRecord[], days: number, now = new Date()) {
  return finishedWorkouts(records).filter(w => daysAgo(w, now) < days).length;
}

export const toUnit = (kg: number, unit: 'lb' | 'kg') => unit === 'kg' ? kg : kg / 0.45359237;
export type StrengthPoint = { workoutId: string; date: string; best: number | null; volume: number };
export type StrengthCohort = { key: string; exerciseId: string; name: string; angle?: number; points: StrengthPoint[] };
/**
 * Per exercise and angle: best weight at exactly `reps` reps and total volume (weight × reps),
 * both in `unit`. Only confirmed sets in finished workouts count.
 */
export function strengthTrends(records: WorkoutRecord[], reps: number, unit: 'lb' | 'kg' = 'kg'): StrengthCohort[] {
  const cohorts = new Map<string, StrengthCohort>();
  for (const w of finishedWorkouts(records).reverse()) {
    for (const e of entries(records, w.id)) {
      if (e.kind !== 'strength') continue;
      const recorded = sets(records, e.id);
      if (!recorded.length) continue;
      const key = `${e.exerciseId}:${e.details.angle ?? 'none'}`;
      const cohort = cohorts.get(key) ?? { key, exerciseId: e.exerciseId, name: e.exerciseName, angle: e.details.angle, points: [] };
      const convert = (s: LiftSet) => toUnit(weightInKg(s.weight, s.unit), unit);
      const matching = recorded.filter(s => s.reps === reps).map(convert);
      const volume = recorded.reduce((n, s) => n + convert(s) * s.reps, 0);
      const best = matching.length ? Math.max(...matching) : null;
      const point = cohort.points.find(p => p.workoutId === w.id);
      if (point) { point.volume += volume; point.best = best === null ? point.best : Math.max(point.best ?? 0, best); }
      else cohort.points.push({ workoutId: w.id, date: w.localDate, best, volume });
      cohort.name = e.exerciseName;
      cohorts.set(key, cohort);
    }
  }
  return [...cohorts.values()];
}

/** Rowing pace grouped by distance rounded to the meter; different distances are never pooled. */
export function rowingTrends(records: WorkoutRecord[]) {
  const result = new Map<number, { workoutId: string; date: string; seconds: number; split: number }[]>();
  for (const w of finishedWorkouts(records).reverse()) {
    for (const e of entries(records, w.id)) if (e.kind === 'rowing') {
      const meters = Math.round(e.meters);
      const points = result.get(meters) ?? [];
      points.push({ workoutId: w.id, date: w.localDate, seconds: e.seconds, split: 500 * e.seconds / e.meters });
      result.set(meters, points);
    }
  }
  return [...result].map(([meters, points]) => ({ meters, points })).sort((a, b) => b.points.length - a.points.length || a.meters - b.meters);
}

/** Describes how much history is on this device, so partial views are labeled. */
export function coverage(records: WorkoutRecord[], moreAvailable: boolean) {
  const finished = finishedWorkouts(records);
  const oldest = finished.at(-1);
  return { count: finished.length, since: oldest?.localDate, complete: !moreAvailable };
}
