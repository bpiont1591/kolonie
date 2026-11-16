// Service worker: statyczne zasoby z cache, strony gry zawsze z sieci (serwer jest źródłem prawdy).
const CACHE = 'kolonie-v3';
const ASSETS = ['/style.css?v=3', '/app.js?v=3', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest', '/offline.html'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
