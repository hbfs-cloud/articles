const CACHE = 'dailytickers-marketwatch-v6';
const ASSETS = ['./','./index.html','./styles.css?v=5','./app.js?v=6','./quote-routing.js?v=6','./data/watchlists.json','./data/auto-universe.json','./data/yahoo-closes.json','./manifest.webmanifest','/assets/style.css','/assets/sidebar.css','/assets/sidebar.js','/logo.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html'))));
});
