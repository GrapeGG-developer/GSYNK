/* GSYNK web: офлайн-оболочка. Страницы — сначала сеть, ассеты — сначала кэш. */
'use strict';
var CACHE = 'gsynk-web-v4.0.4';
var CORE = [
  './',
  './index.html',
  './app.html',
  './404.html',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/favicon-64.png',
  './assets/qr-apk.png',
  './assets/grapescript.png',
  './assets/grapescript.lottie',
  './assets/js/lottie.min.js',
  './assets/js/fflate.min.js',
  './assets/js/grapescript-badge.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.allSettled(CORE.map(function (u) { return cache.add(u); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || !/^https?:$/.test(new URL(req.url).protocol)) return;
  if (new URL(req.url).origin !== self.location.origin) return; // GitHub API/APK — всегда из сети
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      });
    })
  );
});
