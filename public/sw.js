const CACHE = 'mp2-__BUILD_TS__';
const IMG_CACHE = 'mp2-images-v1'; // separate long-lived cache; survives app updates
const PRECACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // Purge old app caches but keep IMG_CACHE so images don't need to be re-downloaded
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isImageUrl(url) {
  return (
    url.pathname.startsWith('/recipe-images/') ||
    url.pathname.includes('/storage/v1/object/public/')
  );
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/functions/v1/')) return; // never cache edge functions

  const url = new URL(e.request.url);

  if (isImageUrl(url)) {
    // Cache-first for images: image URLs are immutable so cached = always valid
    e.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Network-first for app shell, JS/CSS, API responses
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
