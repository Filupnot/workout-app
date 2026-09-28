import { GetCommand, QueryCommand, TransactWriteCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ApiError, type Mutation, type RecordRow, type Repository } from './repository';
import { type WorkoutRecord } from '../src/lib/domain/model';

export class DynamoRepository implements Repository {
  constructor(private client: Pick<DynamoDBDocumentClient, 'send'>, private table: string) {}
  private pk(owner: string) { return `USER#${owner}`; }
  private decode(cursor: string | undefined, owner: string, prefix: string) {
    if (!cursor) return undefined;
    try {
      const key = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (key.pk !== this.pk(owner) || typeof key.sk !== 'string' || !key.sk.startsWith(prefix)) throw new Error();
      if (key.GSI1PK !== undefined && key.GSI1PK !== this.pk(owner)) throw new Error();
      if (Object.keys(key).some(k => !['pk', 'sk', 'GSI1PK', 'GSI1SK'].includes(k))) throw new Error();
      return key;
    } catch { throw new ApiError(400, 'Invalid pagination cursor.'); }
  }
  private async query(owner: string, prefix: string, cursor?: string, index = false): Promise<{ records: RecordRow[]; cursor?: string }> {
    const out = await this.client.send(new QueryCommand({ TableName: this.table,
      ...(index ? { IndexName: 'byDate', ScanIndexForward: false } : { ConsistentRead: true }),
      KeyConditionExpression: index ? 'GSI1PK = :p' : 'pk = :p AND begins_with(sk, :s)',
      ExpressionAttributeValues: { ':p': this.pk(owner), ...(!index ? { ':s': prefix } : {}) },
      Limit: 50, ExclusiveStartKey: this.decode(cursor, owner, prefix)
    }));
    return { records: (out.Items || []).map(i => ({ key: i.sk as string, value: i.value as WorkoutRecord, revision: i.revision as number })),
      cursor: out.LastEvaluatedKey ? Buffer.from(JSON.stringify(out.LastEvaluatedKey)).toString('base64url') : undefined };
  }
  list(owner: string, type: 'workouts' | 'exercises', cursor?: string) {
    return this.query(owner, type === 'workouts' ? 'WORKOUT#' : 'EXERCISE#', cursor, type === 'workouts');
  }
  async detail(owner: string, aggregate: string, cursor?: string): Promise<{ records: RecordRow[]; cursor?: string }> {
    if (aggregate.startsWith('WORKOUT#')) return this.query(owner, aggregate.replace(/META$/, ''), cursor);
    const row = await this.get(owner, aggregate);
    return { records: row ? [{ key: row.sk as string, value: row.value as WorkoutRecord, revision: row.revision as number }] : [] };
  }
  private async children(owner: string, prefix: string) {
    const rows: RecordRow[] = [];
    let cursor: string | undefined;
    do { const page = await this.query(owner, prefix, cursor); rows.push(...page.records); cursor = page.cursor; } while (cursor);
    return rows;
  }
  private async get(owner: string, key: string) {
    return (await this.client.send(new GetCommand({ TableName: this.table, Key: { pk: this.pk(owner), sk: key }, ConsistentRead: true }))).Item;
  }
  async mutate(owner: string, m: Mutation) {
    const marker = await this.get(owner, `MUTATION#${m.id}`);
    if (marker) return { revision: marker.revision as number };
    const current = await this.get(owner, m.aggregate);
    if ((current?.revision ?? 0) !== m.baseRevision) throw new ApiError(409, 'This record changed on another device.');
    const parentChange = m.changes.find(c => c.key === m.aggregate);
    const parent = parentChange?.value || current?.value as WorkoutRecord | undefined;
    if (!parent) throw new ApiError(400, 'Create the parent record first.');
    // A deleted workout accepts only its tombstone and further removals, and is never restored.
    const deleted = (current?.value as WorkoutRecord | undefined)?.kind === 'workout' && (current!.value as { status: string }).status === 'deleted';
    if ((deleted && (parent.kind !== 'workout' || parent.status !== 'deleted'))
      || (parent.kind === 'workout' && parent.status === 'deleted' && m.changes.some(c => c.value && c.key !== m.aggregate)))
      throw new ApiError(400, 'This workout was deleted.');
    for (const c of m.changes) {
      if (c.value?.kind === 'set') {
        const entryKey = `WORKOUT#${c.value.workoutId}#ENTRY#${c.value.entryId}`;
        const local = m.changes.find(v => v.key === entryKey);
        const entry = local ? local.value : (await this.get(owner, entryKey))?.value;
        if (entry?.kind !== 'strength') throw new ApiError(400, 'A set needs a strength entry.');
      }
    }
    // An entry can be removed only once none of its sets remain, so no set is ever orphaned.
    const removedEntries = m.changes.filter(c => c.value === null && c.key.includes('#ENTRY#')).map(c => c.key.split('#ENTRY#')[1]);
    if (removedEntries.length) {
      const removed = new Set(m.changes.filter(c => c.value === null).map(c => c.key));
      const stored = await this.children(owner, m.aggregate.replace(/META$/, 'SET#'));
      const remaining = [...stored.filter(s => !removed.has(s.key) && !m.changes.some(c => c.key === s.key)).map(s => s.value),
        ...m.changes.flatMap(c => c.value?.kind === 'set' ? [c.value] : [])];
      if (remaining.some(s => s.kind === 'set' && removedEntries.includes(s.entryId))) throw new ApiError(400, 'Remove the sets before their exercise.');
    }
    const revision = m.baseRevision + 1;
    const item = (key: string, value: WorkoutRecord) => ({ pk: this.pk(owner), sk: key, value, revision,
      ...(value.kind === 'workout' ? { GSI1PK: this.pk(owner), GSI1SK: `DATE#${value.startedAt}#${value.id}` } : {}) });
    const writes: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']> = [{ Put: {
      TableName: this.table, Item: item(m.aggregate, parent),
      ConditionExpression: current ? 'revision = :r' : 'attribute_not_exists(pk)',
      ...(current ? { ExpressionAttributeValues: { ':r': m.baseRevision } } : {})
    } }];
    for (const c of m.changes.filter(c => c.key !== m.aggregate)) writes.push(c.value ?
      { Put: { TableName: this.table, Item: item(c.key, c.value) } } :
      { Delete: { TableName: this.table, Key: { pk: this.pk(owner), sk: c.key } } });
    writes.push({ Put: { TableName: this.table, Item: { pk: this.pk(owner), sk: `MUTATION#${m.id}`, revision,
      ttl: Math.floor(Date.now() / 1000) + 30 * 86400 }, ConditionExpression: 'attribute_not_exists(pk)' } });
    try { await this.client.send(new TransactWriteCommand({ TransactItems: writes })); }
    catch (error) {
      if ((error as Error).name !== 'TransactionCanceledException') throw error;
      const applied = await this.get(owner, `MUTATION#${m.id}`);
      if (applied) return { revision: applied.revision as number };
      throw new ApiError(409, 'This record changed on another device.');
    }
    return { revision };
  }
}
