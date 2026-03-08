const CACHE_NAME = 'mw-static-v1';
const STATIC_ASSETS = [
  '/assets/report.css',
  '/logo.svg',
  '/favicon.ico',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never cache: HTML pages, JSON data, JS data files
  if (e.request.mode === 'navigate' ||
      e.request.url.includes('/data/') ||
      e.request.url.endsWith('.json')) {
    return;  // Let the browser handle it normally
  }

  // Cache-first only for static assets (CSS, images, SVG, fonts, icons)
  if (e.request.destination === 'style' ||
      e.request.destination === 'image' ||
      e.request.destination === 'font') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        });
      })
    );
  }
  // Everything else: normal browser behavior (no SW interference)
});
