const CACHE_NAME = 'pos-offline-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/db.js',
  '/manifest.json'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  // Strategy: cache-first for app shell, fallback to network
  evt.respondWith(
    caches.match(evt.request).then(cached => cached || fetch(evt.request))
      .catch(() => {
        // Fallback for navigation to index.html (offline)
        if (evt.request.mode === 'navigate') return caches.match('/index.html');
      })
  );
});
