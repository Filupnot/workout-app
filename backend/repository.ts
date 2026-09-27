import { z } from 'zod';
import { aggregateKey, idSchema, recordKey, recordSchema, type WorkoutRecord } from '../src/lib/domain/model';
export const keySchema = z.string().regex(/^(PROFILE|EXERCISE#[0-9a-f-]{36}|WORKOUT#[0-9a-f-]{36}#(META|ENTRY#[0-9a-f-]{36}|SET#[0-9a-f-]{36}))$/);
export const mutationSchema = z.object({
  id: idSchema, aggregate: keySchema, baseRevision: z.number().int().min(0),
  createdAt: z.iso.datetime(), changes: z.array(z.object({ key: keySchema, value: recordSchema.nullable() }).strict()).min(1).max(20)
}).strict();
export type Mutation = z.infer<typeof mutationSchema>;
export type RecordRow = { key: string; value: WorkoutRecord; revision: number };
export interface Repository {
  list(owner: string, type: 'workouts' | 'exercises', cursor?: string): Promise<{ records: RecordRow[]; cursor?: string }>;
  detail(owner: string, aggregate: string, cursor?: string): Promise<{ records: RecordRow[]; cursor?: string }>;
  mutate(owner: string, mutation: Mutation): Promise<{ revision: number }>;
}
export class ApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export function validateMutation(input: unknown): Mutation {
  const parsed = mutationSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, 'Invalid workout data.');
  const m = parsed.data;
  if (!/^(PROFILE|EXERCISE#[0-9a-f-]{36}|WORKOUT#[0-9a-f-]{36}#META)$/.test(m.aggregate)) throw new ApiError(400, 'Invalid parent.');
  if (new Set(m.changes.map(c => c.key)).size !== m.changes.length) throw new ApiError(400, 'Duplicate change.');
  for (const c of m.changes) {
    if (c.value) {
      if (recordKey(c.value) !== c.key || aggregateKey(c.value) !== m.aggregate) throw new ApiError(400, 'Invalid record relation.');
    } else if (!m.aggregate.startsWith('WORKOUT#') || c.key === m.aggregate || !c.key.startsWith(m.aggregate.replace(/META$/, ''))) throw new ApiError(400, 'Invalid deletion.');
  }
  return m;
}
