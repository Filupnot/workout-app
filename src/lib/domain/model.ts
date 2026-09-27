import { z } from 'zod';

export const idSchema = z.uuid();
const timestamp = z.iso.datetime();
const notes = z.string().max(2000);
const position = z.number().int().min(0).max(10000);
export const unitSchema = z.enum(['lb', 'kg']);
export const categorySchema = z.enum(['push', 'pull', 'legs']);
export const detailsSchema = z.object({ angle: z.number().min(-90).max(90).optional() }).strict();
const base = { schemaVersion: z.literal(1) };
export const profileSchema = z.object({
  ...base, kind: z.literal('profile'), unit: unitSchema,
  theme: z.enum(['system', 'light', 'dark']), restSeconds: z.number().int().min(5).max(1800),
  sound: z.boolean()
}).strict();
export const exerciseSchema = z.object({
  ...base, kind: z.literal('exercise'), id: idSchema, name: z.string().trim().min(1).max(100),
  category: categorySchema, details: detailsSchema, archived: z.boolean(), lastUsedAt: timestamp.optional()
}).strict();
export const workoutSchema = z.object({
  ...base, kind: z.literal('workout'), id: idSchema, startedAt: timestamp,
  endedAt: timestamp.optional(), localDate: z.iso.date(), timezone: z.string().min(1).max(100),
  status: z.enum(['active', 'finished']), notes, stretched: z.boolean()
}).strict().refine(w => w.status !== 'finished' || !!w.endedAt, 'Finished workouts need an end time')
  .refine(w => !w.endedAt || w.endedAt >= w.startedAt, 'End precedes start');
const entryBase = { ...base, id: idSchema, workoutId: idSchema, position, notes };
export const strengthSchema = z.object({
  ...entryBase, kind: z.literal('strength'), exerciseId: idSchema,
  exerciseName: z.string().min(1).max(100), category: categorySchema, details: detailsSchema
}).strict();
export const rowingSchema = z.object({
  ...entryBase, kind: z.literal('rowing'), seconds: z.number().positive().max(86400),
  meters: z.number().positive().max(1000000)
}).strict();
export const setSchema = z.object({
  ...base, kind: z.literal('set'), id: idSchema, workoutId: idSchema, entryId: idSchema,
  position, weight: z.number().min(0).max(10000), unit: unitSchema,
  reps: z.number().int().positive().max(1000), completedAt: timestamp
}).strict();
export const recordSchema = z.union([profileSchema, exerciseSchema, workoutSchema, strengthSchema, rowingSchema, setSchema]);
export type Profile = z.infer<typeof profileSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type Workout = z.infer<typeof workoutSchema>;
export type Strength = z.infer<typeof strengthSchema>;
export type Rowing = z.infer<typeof rowingSchema>;
export type LiftSet = z.infer<typeof setSchema>;
export type WorkoutRecord = z.infer<typeof recordSchema>;
export const defaultProfile: Profile = { schemaVersion: 1, kind: 'profile', unit: 'lb', theme: 'system', restSeconds: 90, sound: false };

export function recordKey(record: WorkoutRecord): string {
  switch (record.kind) {
    case 'profile': return 'PROFILE';
    case 'exercise': return `EXERCISE#${record.id}`;
    case 'workout': return `WORKOUT#${record.id}#META`;
    case 'strength': case 'rowing': return `WORKOUT#${record.workoutId}#ENTRY#${record.id}`;
    case 'set': return `WORKOUT#${record.workoutId}#SET#${record.id}`;
  }
}
export function aggregateKey(record: WorkoutRecord): string {
  return ['profile', 'exercise', 'workout'].includes(record.kind) ? recordKey(record) : `WORKOUT#${(record as Strength | Rowing | LiftSet).workoutId}#META`;
}
export function snapshot(exercise: Exercise, workoutId: string, order: number): Strength {
  return strengthSchema.parse({ schemaVersion: 1, kind: 'strength', id: crypto.randomUUID(), workoutId,
    exerciseId: exercise.id, exerciseName: exercise.name, category: exercise.category,
    details: { ...exercise.details }, position: order, notes: '' });
}
export function newWorkout(now = new Date()): Workout {
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return workoutSchema.parse({ schemaVersion: 1, kind: 'workout', id: crypto.randomUUID(), startedAt: now.toISOString(),
    localDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, status: 'active', notes: '', stretched: false });
}
export function seedExercises(): Exercise[] {
  return ([['Bench press', 'push'], ['Incline bench press', 'push'], ['Shoulder press', 'push'],
    ['Lat pulldown', 'pull'], ['Seated row', 'pull'], ['Bicep curl', 'pull'],
    ['Squat', 'legs'], ['Leg press', 'legs'], ['Romanian deadlift', 'legs']] as const)
    .map(([name, category]) => exerciseSchema.parse({ schemaVersion: 1, kind: 'exercise', id: crypto.randomUUID(), name,
      category, details: name.startsWith('Incline') ? { angle: 30 } : {}, archived: false }));
}
