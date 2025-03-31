/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const ASSETS = [...build, ...files];

const CACHE = `cache-${version}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      for (const key of keys) {
        if (key !== CACHE) await caches.delete(key);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((response) => {
          const cache = caches.open(CACHE);
          cache.then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => cached);

      return cached || networked;
    })
  );
});
