/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { base, build, files, prerendered, version } from '$service-worker';

// Caches only this version's static shell. API calls and sign-in go to other origins and are
// never intercepted, so tokens and workout data never enter Cache Storage.
const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `workout-shell-${version}`;
const SHELL = [...build, ...files.filter(f => !f.endsWith('/.nojekyll') && !f.endsWith('/CNAME')), ...prerendered];

worker.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

worker.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await worker.clients.claim();
  })());
});

// The page asks a waiting worker to take over once the user accepts the update.
worker.addEventListener('message', event => { if (event.data === 'skip-waiting') void worker.skipWaiting(); });

worker.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.search) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      // Network first so a deployed release is picked up; the cached page keeps the app usable offline.
      try {
        // A stalled gym connection falls back to the cached shell instead of a blank screen.
        const response = await Promise.race([fetch(request), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))]);
        if (response.ok && SHELL.includes(url.pathname)) await cache.put(url.pathname, response.clone());
        return response;
      } catch {
        return (await cache.match(url.pathname)) ?? (await cache.match(`${base}/`)) ?? Response.error();
      }
    }
    return (await cache.match(url.pathname)) ?? fetch(request);
  })());
});
