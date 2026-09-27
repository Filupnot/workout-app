import { type LocalStore, type Mutation, type Pending, type StoredRecord } from './database';

/**
 * local: saved on this device, waiting to sync (offline or retrying)
 * syncing: sending queued changes
 * synced: every local change has a server acknowledgment
 * signin: queued changes wait for reauthentication
 * conflict: another device changed a record; the user must choose a version
 * failed: the server rejected a change as invalid; the user must choose a version
 */
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'signin' | 'conflict' | 'failed';
export type Page = { records: Omit<StoredRecord, 'owner'>[]; cursor?: string };
export type Api = <T>(path: string, body?: unknown) => Promise<T>;
export class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

export function createApi(base: string, token: () => Promise<string>, request: typeof fetch = (...a) => fetch(...a)): Api {
  return async <T>(path: string, body?: unknown): Promise<T> => {
    let access: string;
    try { access = await token(); } catch { throw new HttpError(401, 'Sign in to sync.'); }
    const response = await request(`${base.replace(/\/$/, '')}/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'omit',
      headers: { authorization: `Bearer ${access}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) throw new HttpError(response.status, response.status === 409 ? 'Changed on another device.' : 'Unable to sync.');
    return response.json() as Promise<T>;
  };
}

/** The status shown when nothing can be sent right now. */
export function idleStatus(pending: Pending[]): SyncStatus {
  if (pending.some(p => p.error === 'conflict')) return 'conflict';
  if (pending.some(p => p.error === 'invalid')) return 'failed';
  return pending.length ? 'local' : 'synced';
}

export class SyncEngine {
  private running?: Promise<void>;
  private retry?: ReturnType<typeof setTimeout>;
  constructor(private local: LocalStore, private send: (m: Mutation) => Promise<{ revision: number }>,
    private update: (status: SyncStatus) => void, private online = () => navigator.onLine,
    private sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
    private schedule = (fn: () => void, ms: number) => setTimeout(fn, ms), readonly retryAfterMs = 30000) {}
  flush() {
    if (!this.running) this.running = this.run().finally(() => { this.running = undefined; });
    return this.running;
  }
  stop() { if (this.retry) clearTimeout(this.retry); this.retry = undefined; }
  private later() {
    this.stop();
    this.retry = this.schedule(() => { this.retry = undefined; void this.flush(); }, this.retryAfterMs);
  }
  private async run() {
    let attempts = 0;
    while (true) {
      const pending = await this.local.pending();
      // Mutations are serialized per record; an unresolved problem blocks only its own record.
      const blocked = new Set(pending.filter(p => p.error).map(p => p.aggregate));
      const item = pending.find(p => !blocked.has(p.aggregate));
      if (!item) { this.update(idleStatus(pending)); return; }
      if (!this.online()) { this.update('local'); return; }
      this.update('syncing');
      try {
        const { owner: _owner, error: _error, seq: _seq, ...mutation } = item;
        const result = await this.send(mutation);
        await this.local.acknowledge(item.id, result.revision);
        attempts = 0;
      } catch (error) {
        if (error instanceof HttpError) {
          if (error.status === 401 || error.status === 403) { this.update('signin'); return; }
          if (error.status === 409) { await this.local.markError(item.id, 'conflict'); continue; }
          if (error.status >= 400 && error.status < 500 && error.status !== 429) { await this.local.markError(item.id, 'invalid'); continue; }
        }
        // Transient: bounded exponential backoff, then a slower background retry.
        if (!this.online() || attempts >= 3) { this.update('local'); this.later(); return; }
        await this.sleep(500 * 2 ** attempts++);
      }
    }
  }
}

export async function allPages(api: Api, path: string) {
  const rows: Page['records'] = [];
  let cursor: string | undefined;
  do {
    const page = await api<Page>(`${path}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
    rows.push(...page.records);
    cursor = page.cursor;
  } while (cursor);
  return rows;
}

export const aggregatePath = (aggregate: string) =>
  aggregate === 'PROFILE' ? '/profile' : aggregate.startsWith('WORKOUT#') ? `/workouts/${aggregate.split('#')[1]}` : '/exercises';

/** The server's current copy of one aggregate, for conflict comparison. */
export async function fetchAggregate(api: Api, aggregate: string) {
  const rows = await allPages(api, aggregatePath(aggregate));
  return rows.filter(r => r.key === aggregate || (aggregate.startsWith('WORKOUT#') && r.key.startsWith(aggregate.replace(/META$/, ''))));
}

/** Pull the profile and exercise library. */
export async function pullLibrary(api: Api, store: LocalStore) {
  await store.importRemote([...(await allPages(api, '/profile')), ...(await allPages(api, '/exercises'))]);
}

/**
 * Pull one page of workouts (newest first). Only workouts whose server revision differs
 * from the local copy are fetched in full. Returns the cursor for older history.
 */
export async function pullWorkouts(api: Api, store: LocalStore, cursor?: string) {
  const page = await api<Page>(`/workouts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
  const known = new Map((await store.records()).map(r => [r.key, r.revision]));
  for (const row of page.records) {
    if (row.value.kind !== 'workout' || known.get(row.key) === row.revision) continue;
    await store.replaceAggregate(row.key, await fetchAggregate(api, row.key));
  }
  return page.cursor;
}
