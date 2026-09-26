// Service worker: caches the app shell for offline use.
// Bump VERSION whenever app files change so users receive the new version.
const VERSION = 'mimi-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/util.js',
  './js/ui.js',
  './js/kutu.js',
  './js/pwa.js',
  './js/views/dashboard.js',
  './js/views/diary.js',
  './js/views/expenses.js',
  './js/views/todo.js',
  './js/todo.js',
  './js/views/kutu.js',
  './js/views/settings.js',
  './js/views/loveLetter.js',
  './js/loveLetter.js',
  './js/data/loveLetters.js',
  './js/data/specialLetters.js',
  './js/data/letterOverrides.js',
  './fonts/quicksand-latin.woff2',
  './fonts/dancing-script-latin.woff2',
  './icons/favicon-48.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// A new version takes over as soon as it is downloaded (no waiting for every window to close),
// so reopening the app is enough to get it. Pages already open keep their code until reloaded.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // App files: cache-first, network fallback; navigations fall back to index.html.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    }),
  );
});
