const CACHE_NAME = 'pulsefit-pro-v3';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './index.tsx',
  './App.tsx',
  './constants.ts',
  './types.ts',
  './services/db.ts'
];

// Install event: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network-first falling back to cache
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.includes('esm.sh')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
