import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMITTED_KEY, createSession, SignInRequired } from '../src/lib/auth/session';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, v); }
}
const config = { authority: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_synthetic', clientId: 'synthetic-client',
  appUrl: 'https://app.example.com/', domain: 'https://synthetic.auth.us-west-2.amazoncognito.com' };
function harness(user: Record<string, unknown> | null, overrides: Record<string, () => Promise<unknown>> = {}) {
  const calls: string[] = []; const urls: string[] = []; const storage = new MemoryStorage();
  let current = user;
  const manager = {
    async signinRedirect() { calls.push('redirect'); },
    async signinRedirectCallback() { calls.push('callback'); if (overrides.callback) return overrides.callback(); return current; },
    async getUser() { return current; },
    async signinSilent() { calls.push('refresh'); if (overrides.refresh) return overrides.refresh(); current = { ...current, expired: false, access_token: 'renewed-a' }; return current; },
    async revokeTokens() { calls.push('revoke'); if (overrides.revoke) await overrides.revoke(); },
    async removeUser() { calls.push('remove'); current = null; },
    async clearStaleState() { calls.push('clear-stale'); }
  };
  const session = createSession(config, { replaceUrl: u => urls.push(`replace:${u}`), assign: u => urls.push(`assign:${u}`), storage }, manager as never);
  return { session, calls, urls, storage };
}

test('callback errors clear stale PKCE state and scrub the authorization code from the URL', async () => {
  const { session, calls, urls } = harness(null, { callback: async () => { throw new Error('access_denied'); } });
  await assert.rejects(session.callback(), /access_denied/);
  assert.deepEqual(calls, ['callback', 'clear-stale']);
  assert.deepEqual(urls, ['replace:/auth/callback/']);
  const ok = harness({ access_token: 'access-a', expired: false });
  await ok.session.callback();
  assert.deepEqual(ok.urls, ['replace:/auth/callback/']);
});

test('expired sessions refresh once, and an expired refresh requires sign-in', async () => {
  const fresh = harness({ access_token: 'access-a', expired: false, refresh_token: 'refresh-a' });
  assert.equal(await fresh.session.token(), 'access-a');
  const expired = harness({ access_token: 'old-a', expired: true, refresh_token: 'refresh-a' });
  const [a, b] = await Promise.all([expired.session.token(), expired.session.token()]);
  assert.equal(a, 'renewed-a'); assert.equal(b, 'renewed-a');
  assert.equal(expired.calls.filter(c => c === 'refresh').length, 1);
  const revoked = harness({ access_token: 'old-a', expired: true, refresh_token: 'refresh-a' }, { refresh: async () => { throw new Error('invalid_grant'); } });
  await assert.rejects(revoked.session.token(), SignInRequired);
  await assert.rejects(harness({ access_token: 'x', expired: true }).session.token(), SignInRequired);
  await assert.rejects(harness(null).session.token(), SignInRequired);
});

test('sign-out removes session material even when revocation fails offline', async () => {
  const { session, calls, urls, storage } = harness({ access_token: 'access-a', expired: false }, { revoke: async () => { throw new Error('offline'); } });
  storage.setItem(ADMITTED_KEY, 'synthetic-subject');
  await session.signOut();
  assert.deepEqual(calls, ['revoke', 'remove']);
  assert.equal(storage.getItem(ADMITTED_KEY), null);
  assert.equal(await session.current(), null);
  const logout = new URL(urls[0].slice('assign:'.length));
  assert.equal(logout.pathname, '/logout');
  assert.equal(logout.searchParams.get('client_id'), 'synthetic-client');
  assert.equal(logout.searchParams.get('logout_uri'), 'https://app.example.com/');
});
