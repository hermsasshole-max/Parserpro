// Service Worker for ParserPro Standalone Web PWA
// Automatically self-unregisters on localhost (Capacitor Android/iOS) so Play Store updates never serve stale cached HTML/JS
const CACHE_NAME = 'parserpro-v1.7.0-b240';
const IS_LOCAL_NATIVE_HOST =
  self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', (event) => {
  if (IS_LOCAL_NATIVE_HOST) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    (async () => {
      try {
        const scopeUrl = new URL(self.registration.scope);
        const basePath = scopeUrl.pathname.endsWith('/')
          ? scopeUrl.pathname
          : scopeUrl.pathname + '/';
        const assetsToCache = [
          basePath,
          basePath + 'index.html',
          basePath + 'manifest.json',
          basePath + 'icon.svg',
          basePath + 'icon-192.png',
          basePath + 'icon-512.png',
          basePath + 'icon-maskable-512.png',
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

self.addEventListener('activate', (event) => {
  if (IS_LOCAL_NATIVE_HOST) {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.navigate(client.url).catch(() => {});
        }
      })()
    );
    return;
  }

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (IS_LOCAL_NATIVE_HOST) {
    return;
  }

  const request = event.request;
  if (
    request.method !== 'GET' ||
    request.url.includes('generativelanguage.googleapis.com') ||
    request.url.includes('/api')
  ) {
    return;
  }

  const isNavigation = request.mode === 'navigate' || request.destination === 'document';
  const fetchOptions = isNavigation ? { cache: 'no-store' } : undefined;

  event.respondWith(
    fetch(request, fetchOptions)
      .then((networkResponse) => {
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
        const cached = await caches.match(request);
        if (cached) return cached;

        if (isNavigation) {
          const scopeUrl = new URL(self.registration.scope);
          const basePath = scopeUrl.pathname.endsWith('/')
            ? scopeUrl.pathname
            : scopeUrl.pathname + '/';
          const indexFallback =
            (await caches.match(basePath + 'index.html')) ||
            (await caches.match(basePath)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (indexFallback) return indexFallback;
        }

        return new Response('ParserPro Offline Mode', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});
