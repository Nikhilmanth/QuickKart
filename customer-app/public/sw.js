// Minimal service worker: network-first with offline shell fallback
const SHELL = ['/', '/index.html'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('quickkart-v1').then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => res)
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html')))
  );
});
