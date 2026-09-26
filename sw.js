// Service worker: caches the app shell for offline use.
// Bump VERSION whenever app files change so users receive the new version.
importScripts('./push-config.js');

const VERSION = 'mimi-v8';
const PUSH_CACHE = 'mimi-push'; // device token for reminders — kept across versions
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
  './js/reminders.js',
  './js/weight.js',
  './js/views/weight.js',
  './push-config.js',
  './icons/badge-96.png',
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
  // cache: 'reload' skips the browser's HTTP cache, so a new version never stores stale files.
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== PUSH_CACHE).map((k) => caches.delete(k))))
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

// ---------- Reminders (Web Push) ----------
// The push itself is empty; fetch this device's due reminders from the reminder server and show them.
async function showPending() {
  const url = (self.MIMI_PUSH && self.MIMI_PUSH.workerUrl || '').replace(/\/$/, '');
  let items = [];
  try {
    const saved = await (await caches.open(PUSH_CACHE)).match('./push-token');
    const { token } = await saved.json();
    const res = await fetch(`${url}/pending`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    items = (await res.json()).notifications || [];
  } catch {
    items = [{ title: 'Mimi', body: 'You have a reminder 💕', url: './#/', tag: 'mimi-reminder' }];
  }
  await Promise.all(items.map((n) => self.registration.showNotification(n.title, {
    body: n.body, tag: n.tag || n.id, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { url: n.url || './#/' },
  })));
}

self.addEventListener('push', (e) => e.waitUntil(showPending()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (wins) => {
    const win = wins[0];
    if (win) { await win.focus(); return win.navigate(target).catch(() => {}); }
    return self.clients.openWindow(target);
  }));
});
