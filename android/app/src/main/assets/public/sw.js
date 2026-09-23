// Service Worker for ParserPro PWA (GitHub Pages & Standalone Mobile PWA)
const CACHE_NAME = 'parserpro-v3';

// Install: pre-cache critical shell assets using registration scope
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const scopeUrl = new URL(self.registration.scope);
        const basePath = scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : scopeUrl.pathname + '/';
        const assetsToCache = [
          basePath,
          basePath + 'index.html',
          basePath + 'manifest.json',
          basePath + 'icon.svg',
          basePath + 'icon-192.png',
          basePath + 'icon-512.png',
          basePath + 'icon-maskable-512.png'
        ];

        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(
          assetsToCache.map((url) =>
            fetch(url, { cache: 'reload' })
              .then((res) => {
                if (res.ok) return cache.put(url, res);
              })
              .catch(() => {})
          )
        );
      } catch (err) {
        console.warn('[SW] Pre-cache warning:', err);
      }
    })()
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

// Fetch: network-first with dynamic caching & rock-solid offline fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests and external API calls (e.g. Google Generative AI API)
  if (
    request.method !== 'GET' ||
    request.url.includes('generativelanguage.googleapis.com') ||
    request.url.includes('/api/')
  ) {
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
          const scopeUrl = new URL(self.registration.scope);
          const basePath = scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : scopeUrl.pathname + '/';
          const indexFallback =
            (await caches.match(basePath + 'index.html')) ||
            (await caches.match(basePath)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (indexFallback) return indexFallback;
        }

        // Return a valid Response so event.respondWith never rejects
        return new Response('ParserPro Offline Mode', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});
