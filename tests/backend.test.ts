import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createAuthenticator } from '../backend/auth';
import { createHandler } from '../backend/api';
import { ApiError, validateMutation, type Repository } from '../backend/repository';
import { newWorkout, recordKey } from '../src/lib/domain/model';

const pool = 'us-west-2_synthetic'; const clientId = 'synthetic-client';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };
const verifier = CognitoJwtVerifier.create({ userPoolId: pool, tokenUse: 'access', clientId, scope: 'workout/data' });
verifier.cacheJwks({ keys: [jwk as { kty: string; n: string; e: string; kid: string }] });
function jwt(patch = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'synthetic-a', iss: `https://cognito-idp.us-west-2.amazonaws.com/${pool}`,
    client_id: clientId, token_use: 'access', scope: 'openid workout/data', exp: Math.floor(Date.now()/1000)+300, ...patch })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
}
test('actual signature validation enforces identity, expiry, client, use, scope, and admission', async () => {
  const auth = createAuthenticator(pool, clientId, async () => 'synthetic-a', verifier);
  assert.equal(await auth(jwt()), 'synthetic-a');
  for (const patch of [{ exp: 1 }, { client_id: 'other' }, { token_use: 'id' }, { scope: 'openid' }, { sub: 'other' }, { iss: 'https://example.com' }]) await assert.rejects(auth(jwt(patch)));
  await assert.rejects(auth(jwt().slice(0, -8) + 'forgedxx'));
  await assert.rejects(createAuthenticator(pool, clientId, async () => '', verifier)(jwt()));
});
function event(path: string, method = 'GET', body?: string, query?: Record<string, string>): APIGatewayProxyEventV2 {
  return { rawPath: path, headers: { authorization: 'Bearer sample', 'content-type': 'application/json', origin: 'https://example.com' },
    requestContext: { http: { method }, requestId: 'synthetic-request' }, body, isBase64Encoded: false, queryStringParameters: query } as unknown as APIGatewayProxyEventV2;
}
test('API passes only authenticated ownership and rejects malformed and oversized writes', async () => {
  const owners: string[] = [];
  const repo: Repository = { async list(owner) { owners.push(owner); return { records: [] }; }, async detail(owner) { owners.push(owner); return { records: [] }; }, async mutate(owner) { owners.push(owner); return { revision: 1 }; } };
  const handler = createHandler(repo, async token => { if (token !== 'sample') throw new ApiError(401, 'Unauthorized'); return 'synthetic-a'; }, 'https://example.com', () => {});
  assert.equal((await handler(event('/v1/workouts'))).statusCode, 200);
  assert.deepEqual(owners, ['synthetic-a']);
  const missing = event('/v1/workouts'); delete missing.headers.authorization;
  assert.equal((await handler(missing)).statusCode, 401);
  assert.equal((await handler(event('/v1/mutations', 'POST', '{'))).statusCode, 400);
  assert.equal((await handler(event('/v1/mutations', 'POST', 'x'.repeat(65537)))).statusCode, 413);
  const value = newWorkout();
  const mutation = { id: crypto.randomUUID(), aggregate: recordKey(value), baseRevision: 0, createdAt: new Date().toISOString(), changes: [{ key: recordKey(value), value }] };
  assert.equal((await handler(event('/v1/mutations', 'POST', JSON.stringify({ ...mutation, owner: 'other' })))).statusCode, 400);
  assert.equal((await handler(event('/v1/mutations', 'POST', JSON.stringify(mutation)))).statusCode, 200);
  assert.throws(() => validateMutation({ ...mutation, aggregate: `WORKOUT#${crypto.randomUUID()}#META` }));
});

test('requests are bounded, origin-checked, and logs omit tokens, identities, and record contents', async () => {
  const lines: string[] = [];
  const workout = newWorkout(); const note = 'synthetic private note';
  const repo: Repository = {
    async list() { throw new Error(`database echoed ${note}`); },
    async detail(_owner, key) { return { records: key === 'PROFILE' ? [] : [] }; },
    async mutate() { return { revision: 1 }; }
  };
  const handler = createHandler(repo, async token => {
    if (token === 'sample') return 'synthetic-subject';
    throw new ApiError(401, 'Sign in to continue.');
  }, 'https://example.com', line => lines.push(line));
  const status = async (e: APIGatewayProxyEventV2) => (await handler(e)).statusCode;
  const foreign = event('/v1/profile'); foreign.headers.origin = 'https://attacker.example.net';
  assert.equal(await status(foreign), 403);
  assert.equal(await status(event('/v1/workouts', 'DELETE')), 404);
  assert.equal(await status(event('/v1/unknown')), 404);
  assert.equal(await status(event('/v1/workouts', 'GET', undefined, { cursor: 'x'.repeat(2049) })), 400);
  assert.equal(await status(event('/v1/workouts', 'GET', undefined, { owner: 'synthetic-b' })), 400);
  assert.equal(await status(event('/v1/workouts/not-a-uuid')), 400);
  assert.equal(await status(event(`/v1/workouts/${workout.id}`)), 404);
  const wrongType = event('/v1/mutations', 'POST', '{}'); wrongType.headers['content-type'] = 'text/plain';
  assert.equal(await status(wrongType), 415);
  const big = event('/v1/mutations', 'POST', Buffer.from('x'.repeat(70000)).toString('base64')); big.isBase64Encoded = true;
  assert.equal(await status(big), 413);
  const secretToken = 'eyJsynthetic.token.value';
  const badToken = event('/v1/profile'); badToken.headers.authorization = `Bearer ${secretToken}`;
  assert.equal(await status(badToken), 401);
  const invalid = { id: crypto.randomUUID(), aggregate: recordKey(workout), baseRevision: 0, createdAt: new Date().toISOString(),
    changes: [{ key: recordKey(workout), value: { ...workout, notes: note, reps: -1 } }] };
  assert.equal(await status(event('/v1/mutations', 'POST', JSON.stringify(invalid))), 400);
  const failed = await handler(event('/v1/workouts'));
  assert.equal(failed.statusCode, 500);
  assert.equal(String(failed.body).includes(note), false);
  assert.ok(lines.length >= 10);
  for (const line of lines) {
    for (const leaked of [secretToken, 'synthetic-subject', note, workout.id, 'Bearer']) assert.equal(line.includes(leaked), false, `log leaked ${leaked}`);
    assert.deepEqual(Object.keys(JSON.parse(line)).sort(), ['ms', 'requestId', 'route', 'status']);
  }
});
