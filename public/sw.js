// Service Worker for EduSync PWA
// Caches only the app shell

async function resolveCacheName() {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        return 'edusync-' + data.version;
      }
    }
  } catch (err) {
    // Network or parse failure fallback
  }
  return 'edusync-unknown';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cacheName = await resolveCacheName();
      const cache = await caches.open(cacheName);
      try {
        await cache.addAll(['/', '/index.html', '/favicon.svg']);
      } catch (err) {
        console.warn('Failed to pre-cache some shell assets during install:', err);
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const currentCacheName = await resolveCacheName();
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name.startsWith('edusync-') && name !== currentCacheName) {
            return caches.delete(name);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only handle same-origin GET requests
  if (url.origin !== self.location.origin || request.method !== 'GET') {
    return;
  }

  // 2. NEVER intercept or cache any /api/ request, /version.json, or /sw.js
  if (
    url.pathname.startsWith('/api') ||
    url.pathname === '/version.json' ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  // 3. Cache-first for /assets/*
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const currentCacheName = await resolveCacheName();
            const cache = await caches.open(currentCacheName);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          return cachedResponse || new Response('Asset unavailable offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // 4. Network-first for navigation with index.html as the offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const currentCacheName = await resolveCacheName();
            const cache = await caches.open(currentCacheName);
            cache.put('/index.html', networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;
          return new Response('You are offline. Please reconnect to access the application.', {
            headers: { 'Content-Type': 'text/plain' },
            status: 503,
          });
        }
      })()
    );
    return;
  }
});
