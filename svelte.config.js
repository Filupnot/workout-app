import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { loadEnv } from 'vite';

const env = { ...loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', process.cwd(), 'PUBLIC_'), ...process.env };
const origin = value => { try { return value ? new URL(value).origin : undefined; } catch { return undefined; } };
// The browser may only talk to this site, the workout API, and the Cognito endpoints.
const connect = ['self', origin(env.PUBLIC_API_URL), origin(env.PUBLIC_COGNITO_AUTHORITY), origin(env.PUBLIC_COGNITO_DOMAIN)].filter(Boolean);

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ pages: process.env.BUILD_DIR || 'build', assets: process.env.BUILD_DIR || 'build', fallback: '404.html' }),
    paths: { base: /** @type {'' | `/${string}`} */ (process.env.BASE_PATH || '') },
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:'],
        'font-src': ['self'],
        'connect-src': /** @type {any} */ (connect),
        'manifest-src': ['self'],
        'worker-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self']
      }
    }
  }
};
