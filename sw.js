/**
 * Section 6.3: Service Worker for Application Shell & Offline Resilience
 * - Caches static application shell assets (HTML, JS, CSS, Fonts)
 * - Allows Practice Mode exam payloads to work offline
 * - NEVER caches Exam Mode submission endpoints or Teacher/Admin monitoring endpoints
 */

const CACHE_NAME = 'khaothi-app-shell-v2.0.0';
const APP_SHELL_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve(true);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Security Boundary: Never cache live monitoring, session tokens, or exam mode endpoints
  if (
    url.pathname.startsWith('/api/monitor') ||
    url.pathname.startsWith('/api/sessions') ||
    url.pathname.startsWith('/api/studio') ||
    (url.pathname.startsWith('/api/exams') && url.searchParams.get('mode') === 'exam')
  ) {
    return;
  }

  // Allow Practice Mode exam definitions to use network-first with cache fallback
  if (url.pathname.startsWith('/api/exams') && url.searchParams.get('mode') === 'practice') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
