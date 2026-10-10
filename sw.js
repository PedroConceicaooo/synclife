// Service worker: makes SyncLife work offline as a PWA (design doc). Every
// file the game loads is kept in the cache the first time; later it is
// served from the cache at once and refreshed in the background
// (stale-while-revalidate). Bump CACHE when shipping so old caches go away.
// Paths are relative to this file, so the game works in a subfolder too
// (e.g. GitHub Pages at /synclife/).

const CACHE = 'synclife-v4';
const SHELL = ['./', 'index.html', 'src/ui/style.css', 'src/ui/app.js', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const fresh = await network;
      if (fresh) return fresh;
      // Offline and never seen: pages fall back to the app shell.
      if (request.mode === 'navigate') return cache.match(new URL('index.html', self.location).href);
      return new Response('', { status: 504, statusText: 'Offline' });
    }),
  );
});
