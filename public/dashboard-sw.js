// Staff tablet service worker. It makes /dashboard/ an installable app and
// lets the board still open if the diner's wifi blips while it reloads.
//
// Network first, always: the tablet should run the newest code, so the
// cache is only a fallback. Only this site's own files are cached. Orders
// never come from the cache: Supabase lives on another domain and its
// requests (and the live connection) are left alone.
var CACHE = 'jills-dash-v1';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(
    fetch(req)
      .then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { return c.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) { return hit || Response.error(); });
      })
  );
});
