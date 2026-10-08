const CACHE = 'gd-v2';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => null))))
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

async function fromNetwork(req, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(req, {cache: 'no-cache', signal: ctrl.signal});
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!same && !font) return;

  if (same && req.mode === 'navigate') {
    /* the app page: network first so updates show up, cached copy when offline */
    e.respondWith((async () => {
      const res = await fromNetwork(req, 4000);
      if (res && res.ok) {
        const c = await caches.open(CACHE);
        await c.put('./index.html', res.clone());
        return res;
      }
      const cached = (await caches.match('./index.html')) || (await caches.match('./'));
      return cached || res || Response.error();
    })());
    return;
  }

  /* icons, manifest, fonts: cached copy right away, refreshed in the background */
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
    return res || Response.error();
  })());
});
