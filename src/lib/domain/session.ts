import { deriveRow, parseTime } from './rowing';
import { entries, sets } from './history';
import { recordKey, snapshot, strengthSchema, type Exercise, type LiftSet, type Rowing, type Strength, type Workout, type WorkoutRecord } from './model';

export type Unit = 'lb' | 'kg';
/** Unsaved form state, persisted locally so a reload restores it. */
export type Draft = {
  selected: string; weight: string; reps: string; unit: Unit; angle: string; entryNote: string; editSetId: string;
  sessionNote: string; rowTime: string; rowDistance: string; rowSplit: string;
};
export const emptyDraft = (unit: Unit = 'lb'): Draft => ({ selected: '', weight: '', reps: '', unit, angle: '', entryNote: '',
  editSetId: '', sessionNote: '', rowTime: '', rowDistance: '', rowSplit: '' });

export const SUGGESTED_SETS = 3;
/** Suggested rows shown after the confirmed sets and the row being entered; never stored. */
export const suggestedRows = (confirmed: number) => Math.max(0, SUGGESTED_SETS - confirmed - 1);

const nextPosition = (items: { position: number }[]) => Math.max(-1, ...items.map(i => i.position)) + 1;

export function parseSetInput(weight: string, reps: string) {
  const w = Number(weight.trim()); const r = Number(reps.trim());
  if (!weight.trim() || !Number.isFinite(w)) throw new Error('Enter the weight you lifted (0 for bodyweight).');
  if (w < 0) throw new Error('Weight cannot be negative.');
  if (w > 10000) throw new Error('That weight looks too large.');
  if (!reps.trim() || !Number.isInteger(r) || r < 1) throw new Error('Reps must be a whole number of at least 1.');
  if (r > 1000) throw new Error('That rep count looks too large.');
  return { weight: w, reps: r };
}
export function parseAngle(angle: string) {
  if (!angle.trim()) return {};
  const value = Number(angle);
  if (!Number.isFinite(value) || value < -90 || value > 90) throw new Error('Angle must be between -90 and 90 degrees.');
  return { angle: value };
}

export function addEntry(records: WorkoutRecord[], workout: Workout, exercise: Exercise, details = exercise.details): Strength {
  return snapshot({ ...exercise, details }, workout.id, nextPosition(entries(records, workout.id)));
}

/**
 * Records to save for a confirmed (new or corrected) set. A different angle after sets exist
 * starts a separate entry so each variant keeps its own sets.
 */
export function confirmSet(records: WorkoutRecord[], workout: Workout, entry: Strength, draft: Draft, now = new Date()): { records: WorkoutRecord[]; entry: Strength } {
  const { weight, reps } = parseSetInput(draft.weight, draft.reps);
  const details = parseAngle(draft.angle);
  const existing = sets(records, entry.id);
  const editing = existing.find(s => s.id === draft.editSetId);
  let target: Strength = { ...entry, details, notes: draft.entryNote.slice(0, 2000) };
  if (!editing && existing.length && details.angle !== entry.details.angle) {
    target = strengthSchema.parse({ ...entry, id: crypto.randomUUID(), details, notes: draft.entryNote.slice(0, 2000), position: nextPosition(entries(records, workout.id)) });
  } else if (editing && details.angle !== entry.details.angle) {
    throw new Error('Corrections keep the original angle. Log a new set to record a different angle.');
  }
  const siblings = target.id === entry.id ? existing : [];
  const set: LiftSet = { schemaVersion: 1, kind: 'set', id: editing?.id ?? crypto.randomUUID(), workoutId: workout.id, entryId: target.id,
    position: editing?.position ?? nextPosition(siblings), weight, unit: draft.unit, reps, completedAt: editing?.completedAt ?? now.toISOString() };
  return { records: [target, set], entry: target };
}

/** Values suggested for the next set: the previous actual set, else the first set last time. */
export function prefill(current: LiftSet[], previous: LiftSet[] | undefined, unit: Unit): Pick<Draft, 'weight' | 'reps' | 'unit'> {
  const source = current.at(-1) ?? previous?.[0];
  return source ? { weight: String(source.weight), reps: String(source.reps), unit: source.unit } : { weight: '', reps: '', unit };
}

export function rowingEntry(records: WorkoutRecord[], workout: Workout, draft: Pick<Draft, 'rowTime' | 'rowDistance' | 'rowSplit'>, notes = ''): Rowing {
  const distance = draft.rowDistance.trim();
  if (distance && !/^\d+(\.\d+)?$/.test(distance)) throw new Error('Distance must be a positive number of meters.');
  const result = deriveRow({ seconds: parseTime(draft.rowTime), meters: distance ? Number(distance) : undefined, split: parseTime(draft.rowSplit) });
  return { schemaVersion: 1, kind: 'rowing', id: crypto.randomUUID(), workoutId: workout.id, position: nextPosition(entries(records, workout.id)),
    notes, seconds: Math.round(result.seconds * 10) / 10, meters: Math.round(result.meters) };
}

export function finishWorkout(workout: Workout, notes: string, now = new Date()): Workout {
  return { ...workout, notes: notes.slice(0, 2000), status: 'finished', endedAt: now.toISOString() };
}

/** One locally atomic save: the workout record plus up to 19 removals, within the 20-change mutation limit. */
export type Batch = { values: WorkoutRecord[]; removed: string[] };
const REMOVALS_PER_BATCH = 19;
function batches(parent: Workout, keys: string[]): Batch[] {
  const out: Batch[] = [];
  for (let i = 0; i < keys.length; i += REMOVALS_PER_BATCH) out.push({ values: [parent], removed: keys.slice(i, i + REMOVALS_PER_BATCH) });
  return out.length ? out : [{ values: [parent], removed: [] }];
}
/** Removes an entry and its sets. Sets go first, so no batch leaves a set without its entry. */
export function entryRemoval(records: WorkoutRecord[], workout: Workout, entry: Strength | Rowing): Batch[] {
  return batches(workout, [...sets(records, entry.id).map(recordKey), recordKey(entry)]);
}
/** Replaces a workout with a tombstone and erases all of its entries and sets. */
export function workoutDeletion(records: WorkoutRecord[], workout: Workout): Batch[] {
  const { endedAt: _endedAt, ...rest } = workout;
  const tombstone: Workout = { ...rest, status: 'deleted', notes: '', stretched: false };
  const children = entries(records, workout.id);
  const keys = [...children.flatMap(e => sets(records, e.id).map(recordKey)), ...children.map(recordKey)];
  return batches(tombstone, keys);
}

export const confirmedSetCount = (records: WorkoutRecord[], workoutId: string) =>
  records.filter(r => r.kind === 'set' && r.workoutId === workoutId).length;
