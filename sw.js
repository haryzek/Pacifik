/* Pacifik service worker — offline-first.
   CACHE_V bumpni při každé změně dat/appky (scripts/sw-build.js to dělá automaticky). */
const CACHE_V = 'pacifik-v2';
const STATIC = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];
const DATA = ['./data/places.json', './data/loops.json'];
const CDN = ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
const PHOTOS = []; // __PHOTOS__ (doplní sw-build.js)

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_V);
    await c.addAll([...STATIC, ...DATA]);
    for (const u of CDN) { try { await c.add(u); } catch (_) {} }
    // fotky po dávkách, chyby nevadí
    let done = 0;
    for (let i = 0; i < PHOTOS.length; i += 20) {
      await Promise.all(PHOTOS.slice(i, i + 20).map((u) => c.add(u).catch(() => {})));
      done = Math.min(PHOTOS.length, i + 20);
      const cs = await self.clients.matchAll({ includeUncontrolled: true });
      cs.forEach((cl) => cl.postMessage({ type: 'progress', done, total: PHOTOS.length }));
    }
    const cs = await self.clients.matchAll({ includeUncontrolled: true });
    cs.forEach((cl) => cl.postMessage({ type: 'ready', version: CACHE_V }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE_V) await caches.delete(k);
    await self.clients.claim();
    const cs = await self.clients.matchAll();
    cs.forEach((cl) => cl.postMessage({ type: 'activated', version: CACHE_V }));
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isData = url.pathname.endsWith('.json') && url.pathname.includes('/data/');
  if (isData) {
    // network-first (update z motelu dorazí), fallback cache
    e.respondWith((async () => {
      const c = await caches.open(CACHE_V);
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
      catch (_) { return (await c.match(req)) || new Response('[]', { headers: { 'Content-Type': 'application/json' } }); }
    })());
    return;
  }
  if (url.origin === location.origin || CDN.includes(req.url)) {
    // cache-first, doplň do cache při prvním úspěšném fetch
    e.respondWith((async () => {
      const c = await caches.open(CACHE_V);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok && (url.origin === location.origin)) c.put(req, r.clone()); return r; }
      catch (_) { return url.pathname.endsWith('.jpg') ? new Response('', { status: 404 }) : Response.error(); }
    })());
  }
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
