import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { ApiError, validateMutation, type Repository } from './repository';
import { idSchema } from '../src/lib/domain/model';

export const MAX_BODY_BYTES = 65536;
const MAX_CURSOR = 2048;
type Log = (line: string) => void;

export function createHandler(repo: Repository, authenticate: (token: string) => Promise<string>, origin: string, log: Log = console.log) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const started = Date.now();
    let route = 'unknown';
    const reply = (statusCode: number, body: unknown) => {
      // Only request metadata is logged: never tokens, identities, paths with IDs, or bodies.
      log(JSON.stringify({ requestId: event.requestContext?.requestId, route, status: statusCode, ms: Date.now() - started }));
      return { statusCode, body: JSON.stringify(body),
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } };
    };
    try {
      const headers = event.headers || {};
      if (headers.origin && headers.origin !== origin) throw new ApiError(403, 'Origin not allowed.');
      const method = event.requestContext.http.method;
      const path = (event.rawPath || '').replace(/\/$/, '');
      if (path.length > 200) throw new ApiError(404, 'Not found.');
      const query = event.queryStringParameters || {};
      if (Object.keys(query).some(k => k !== 'cursor')) throw new ApiError(400, 'Unsupported query.');
      const cursor = query.cursor;
      if (cursor !== undefined && (cursor.length === 0 || cursor.length > MAX_CURSOR)) throw new ApiError(400, 'Invalid cursor.');
      const workout = path.match(/^\/v1\/workouts\/([^/]+)$/);
      route = workout ? '/v1/workouts/:id' : path;
      const known = ['GET /v1/profile', 'GET /v1/workouts', 'GET /v1/exercises', 'POST /v1/mutations'].includes(`${method} ${path}`) || (method === 'GET' && workout);
      if (!known) { route = 'unknown'; throw new ApiError(404, 'Not found.'); }

      const header = headers.authorization || '';
      if (!header.startsWith('Bearer ') || header.length > 8192) throw new ApiError(401, 'Sign in to continue.');
      const owner = await authenticate(header.slice(7));
      if (!owner) throw new ApiError(403, 'Account not admitted.');

      if (path === '/v1/profile') return reply(200, await repo.detail(owner, 'PROFILE'));
      if (path === '/v1/workouts' || path === '/v1/exercises') return reply(200, await repo.list(owner, path.endsWith('workouts') ? 'workouts' : 'exercises', cursor));
      if (workout) {
        if (!idSchema.safeParse(workout[1]).success) throw new ApiError(400, 'Invalid workout ID.');
        const detail = await repo.detail(owner, `WORKOUT#${workout[1]}#META`, cursor);
        if (!cursor && !detail.records.length) throw new ApiError(404, 'Not found.');
        return reply(200, detail);
      }
      if (!headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'Use JSON.');
      const raw = event.body || '';
      if (raw.length > MAX_BODY_BYTES * 2) throw new ApiError(413, 'Request too large.');
      const body = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString() : raw;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new ApiError(413, 'Request too large.');
      let input: unknown;
      try { input = JSON.parse(body); } catch { throw new ApiError(400, 'Invalid JSON.'); }
      return reply(200, await repo.mutate(owner, validateMutation(input)));
    } catch (error) {
      if (error instanceof ApiError) return reply(error.status, { error: error.message });
      // SDK errors can echo keys or values, so only the status is recorded.
      return reply(500, { error: 'Unable to save right now. Try again.' });
    }
  };
}
