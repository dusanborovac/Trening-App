const CACHE = 'gd-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!same && !font) return;
  const network = fetch(req).then(async res => {
    if (res && (res.ok || res.type === 'opaque')) {
      const c = await caches.open(CACHE);
      await c.put(req, res.clone());
    }
    return res;
  }).catch(() => null);
  e.waitUntil(network.then(() => undefined));
  e.respondWith((async () => {
    const cached = await caches.match(req, {ignoreSearch: same});
    if (cached) return cached;
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') {
      const shell = (await caches.match('./index.html')) || (await caches.match('./'));
      if (shell) return shell;
    }
    return Response.error();
  })());
});
