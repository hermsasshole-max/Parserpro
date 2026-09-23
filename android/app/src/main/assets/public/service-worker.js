// Service Worker for ParserPro PWA & Android TWA
const CACHE_NAME = 'parserpro-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png'
];

// Install: pre-cache critical shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log('[SW] Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first with dynamic caching & rock-solid fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests and API calls
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful responses for offline / fast relaunch
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Try cache match
        const cached = await caches.match(request);
        if (cached) return cached;

        // For page navigations, fallback to cached index.html
        if (request.mode === 'navigate') {
          const indexFallback = (await caches.match('/index.html')) || (await caches.match('/'));
          if (indexFallback) return indexFallback;
        }

        // Return a valid Response so event.respondWith never rejects
        return new Response('Network error or offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});
