// Service worker: zasoby statyczne z cache, strony gry zawsze z sieci (serwer jest źródłem prawdy).
const CACHE = 'kolonie-v25';
const ASSETS = ['/style.css?v=25', '/app.js?v=25', '/icon-192.png?v=25', '/manifest.webmanifest', '/offline.html',
  '/fonts/rajdhani-bold.woff2', '/fonts/rajdhani-semibold.woff2', '/img/logo.webp?v=25',
  '/img/r_metal.webp?v=25', '/img/r_crystal.webp?v=25', '/img/r_energy.webp?v=25'];
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
// Web Push: powiadomienia z gry (atak, pełny magazyn, budowa, ekspedycja, boss).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || 'Kolonie';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '', icon: '/icon-192.png?v=25', badge: '/icon-192.png?v=25', tag: d.tag || 'kolonie',
    renotify: !!d.tag, data: { url: d.url || '/kolonia' }, lang: 'pl',
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/kolonia', location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    for (const w of ws) if (w.url.startsWith(location.origin) && 'focus' in w) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
