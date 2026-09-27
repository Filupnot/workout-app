import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { aggregateKey, recordKey, recordSchema, type WorkoutRecord } from '../domain/model';

export type Change = { key: string; value: WorkoutRecord | null };
export type Mutation = { id: string; aggregate: string; baseRevision: number; changes: Change[]; createdAt: string };
export type StoredRecord = { owner: string; key: string; value: WorkoutRecord; revision: number };
// seq orders mutations saved within the same millisecond; entries from schema v1 fall back to createdAt.
export type Pending = Mutation & { owner: string; seq?: number; error?: 'conflict' | 'invalid' };
interface Store extends DBSchema {
  records: { key: [string, string]; value: StoredRecord; indexes: { owner: string } };
  outbox: { key: [string, string]; value: Pending; indexes: { owner: string } };
  local: { key: [string, string]; value: { owner: string; key: string; value: unknown }; indexes: { owner: string } };
}
export const DB_VERSION = 2;
export async function openWorkoutDB(name = 'workout') {
  return openDB<Store>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('records', { keyPath: ['owner', 'key'] }).createIndex('owner', 'owner');
        db.createObjectStore('outbox', { keyPath: ['owner', 'id'] }).createIndex('owner', 'owner');
      }
      if (oldVersion < 2) db.createObjectStore('local', { keyPath: ['owner', 'key'] }).createIndex('owner', 'owner');
    },
    blocking() { /* New app versions ask existing tabs to close their connection. */ }
  });
}
export class LocalStore {
  constructor(readonly db: IDBPDatabase<Store>, readonly owner: string) {
    if (!owner || owner.length > 200) throw new Error('An owner identity is required.');
  }
  async records() { return this.db.getAllFromIndex('records', 'owner', this.owner); }
  async pending() {
    return (await this.db.getAllFromIndex('outbox', 'owner', this.owner)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.seq ?? 0) - (b.seq ?? 0));
  }
  async local<T>(key: string): Promise<T | undefined> { return (await this.db.get('local', [this.owner, key]))?.value as T | undefined; }
  async setLocal(key: string, value: unknown) { await this.db.put('local', { owner: this.owner, key, value }); }
  async save(values: WorkoutRecord[], removed: string[] = []) {
    if (!values.length || values.length + removed.length > 20) throw new Error('Save one bounded group at a time.');
    const parsed = values.map(v => recordSchema.parse(v));
    const aggregate = aggregateKey(parsed[0]);
    if (parsed.some(v => aggregateKey(v) !== aggregate)) throw new Error('Cannot mix unrelated records.');
    if (removed.some(k => !k.startsWith(aggregate.replace(/META$/, '')) || k === aggregate)) throw new Error('Invalid removal.');
    const changes = [...parsed.map(value => ({ key: recordKey(value), value })), ...removed.map(key => ({ key, value: null }))];
    if (new Set(changes.map(c => c.key)).size !== changes.length) throw new Error('Duplicate change key.');
    const tx = this.db.transaction(['records', 'outbox'], 'readwrite');
    const revision = (await tx.objectStore('records').get([this.owner, aggregate]))?.revision ?? 0;
    const queued = await tx.objectStore('outbox').index('owner').getAll(this.owner);
    const latest = queued.reduce((max, p) => p.createdAt > max ? p.createdAt : max, '');
    const now = new Date().toISOString();
    const mutation: Pending = { owner: this.owner, id: crypto.randomUUID(), aggregate, baseRevision: revision, changes,
      createdAt: now > latest ? now : latest, seq: Math.max(0, ...queued.map(p => p.seq ?? 0)) + 1 };
    for (const change of changes) {
      if (change.value) await tx.objectStore('records').put({ owner: this.owner, key: change.key, value: change.value, revision });
      else await tx.objectStore('records').delete([this.owner, change.key]);
    }
    await tx.objectStore('outbox').add(mutation);
    await tx.done;
    return mutation;
  }
  async acknowledge(id: string, revision: number) {
    const tx = this.db.transaction(['records', 'outbox'], 'readwrite');
    const item = await tx.objectStore('outbox').get([this.owner, id]);
    if (!item) { await tx.done; return; }
    await tx.objectStore('outbox').delete([this.owner, id]);
    const parent = await tx.objectStore('records').get([this.owner, item.aggregate]);
    if (parent) await tx.objectStore('records').put({ ...parent, revision });
    for (const pending of await tx.objectStore('outbox').index('owner').getAll(this.owner)) {
      if (pending.aggregate === item.aggregate) await tx.objectStore('outbox').put({ ...pending, baseRevision: revision });
    }
    await tx.done;
  }
  async markError(id: string, error: Pending['error']) {
    const item = await this.db.get('outbox', [this.owner, id]);
    if (item) await this.db.put('outbox', { ...item, error });
  }
  /** Import standalone remote records (profile, library), skipping any aggregate with queued local edits. */
  async importRemote(records: Omit<StoredRecord, 'owner'>[]) {
    const rows = records.map(r => {
      const value = recordSchema.parse(r.value);
      if (r.key !== recordKey(value)) throw new Error('Invalid remote record.');
      return { key: r.key, value, revision: r.revision };
    });
    const tx = this.db.transaction(['records', 'outbox'], 'readwrite');
    const pending = await tx.objectStore('outbox').index('owner').getAll(this.owner);
    for (const row of rows) {
      if (!pending.some(p => p.aggregate === aggregateKey(row.value))) await tx.objectStore('records').put({ ...row, owner: this.owner });
    }
    await tx.done;
  }
  /** Replace a synced aggregate with the server's complete copy, unless local edits are still queued. */
  async replaceAggregate(aggregate: string, remote: Omit<StoredRecord, 'owner'>[]) {
    const rows = this.checkAggregate(aggregate, remote);
    const tx = this.db.transaction(['records', 'outbox'], 'readwrite');
    const pending = (await tx.objectStore('outbox').index('owner').getAll(this.owner)).some(p => p.aggregate === aggregate);
    if (!pending) {
      for (const row of await tx.objectStore('records').index('owner').getAll(this.owner)) {
        if (aggregateKey(row.value) === aggregate) await tx.objectStore('records').delete([this.owner, row.key]);
      }
      for (const row of rows) await tx.objectStore('records').put({ ...row, owner: this.owner });
    }
    await tx.done;
    return !pending;
  }
  private checkAggregate(aggregate: string, remote: Omit<StoredRecord, 'owner'>[]) {
    return remote.map(r => {
      const value = recordSchema.parse(r.value);
      if (aggregateKey(value) !== aggregate || recordKey(value) !== r.key) throw new Error('Invalid remote record.');
      return { key: r.key, value, revision: r.revision };
    });
  }
  /**
   * Explicit conflict resolution. "server" drops queued edits and adopts the remote copy.
   * "local" adopts the remote copy except for records the queued edits change, then
   * resubmits those edits against the remote revision.
   */
  async resolve(aggregate: string, remote: Omit<StoredRecord, 'owner'>[], choice: 'local' | 'server') {
    const rows = this.checkAggregate(aggregate, remote);
    const revision = rows.find(r => r.key === aggregate)?.revision ?? 0;
    const tx = this.db.transaction(['records', 'outbox'], 'readwrite');
    const pending = (await tx.objectStore('outbox').index('owner').getAll(this.owner)).filter(p => p.aggregate === aggregate);
    const touched = new Set(choice === 'local' ? pending.flatMap(p => p.changes.map(c => c.key)) : []);
    for (const item of pending) {
      if (choice === 'server') await tx.objectStore('outbox').delete([this.owner, item.id]);
      else await tx.objectStore('outbox').put({ ...item, baseRevision: revision, error: undefined });
    }
    for (const row of await tx.objectStore('records').index('owner').getAll(this.owner)) {
      if (aggregateKey(row.value) !== aggregate) continue;
      if (touched.has(row.key)) await tx.objectStore('records').put({ ...row, revision });
      else await tx.objectStore('records').delete([this.owner, row.key]);
    }
    for (const row of rows) if (!touched.has(row.key)) await tx.objectStore('records').put({ ...row, owner: this.owner });
    await tx.done;
  }
  async clear(discardPending = false) {
    const tx = this.db.transaction(['records', 'outbox', 'local'], 'readwrite');
    if (!discardPending && await tx.objectStore('outbox').index('owner').count(this.owner)) {
      await tx.done;
      throw new Error('Sync pending changes or explicitly discard them before signing out.');
    }
    for (const name of ['records', 'outbox', 'local'] as const) {
      const store = tx.objectStore(name);
      for (const key of await store.index('owner').getAllKeys(this.owner)) await store.delete(key);
    }
    await tx.done;
  }
}
