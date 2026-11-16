// Service worker: zasoby statyczne z cache, strony gry zawsze z sieci (serwer jest źródłem prawdy).
const CACHE = 'kolonie-v5';
const ASSETS = ['/style.css?v=5', '/app.js?v=5', '/icon-192.png?v=5', '/manifest.webmanifest', '/offline.html',
  '/fonts/rajdhani-bold.woff2', '/fonts/rajdhani-semibold.woff2', '/img/logo.webp?v=5',
  '/img/r_metal.webp?v=5', '/img/r_crystal.webp?v=5', '/img/r_energy.webp?v=5'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  // grafiki i fonty: cache-first z dociąganiem do cache
  if (url.pathname.startsWith('/img/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
