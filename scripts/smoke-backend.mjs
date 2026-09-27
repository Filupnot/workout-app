// Loads the deployable bundle the way Lambda does, with placeholder configuration,
// and checks that an unauthenticated request is refused. No AWS calls are made.
process.env.AWS_REGION ||= 'us-west-2';
Object.assign(process.env, { TABLE_NAME: 'placeholder', USER_POOL_ID: 'us-west-2_placeholder', CLIENT_ID: 'placeholder',
  OWNER_PARAMETER: '/placeholder', APP_ORIGIN: 'https://app.example.com' });
const { handler } = await import(new URL('../dist/backend/index.mjs', import.meta.url).href);
const result = await handler({ rawPath: '/v1/workouts', headers: {}, requestContext: { http: { method: 'GET' }, requestId: 'smoke' } });
if (result.statusCode !== 401) { console.error(`Expected 401, got ${result.statusCode}`); process.exit(1); }
console.log('Backend bundle loads and refuses unauthenticated requests.');
