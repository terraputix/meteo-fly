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

function handleResponse(request, response) {
  if (response.ok) {
    const responseClone = response.clone();
    caches.open(CACHE).then((cache) => {
      cache.put(request, responseClone);
    });
  }
  return response;
}

function isWeatherData(url: string) {
  return url.includes('api.open-meteo.com/v1/forecast');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-first for weather data
  if (isWeatherData(url.href)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => handleResponse(event.request, response))
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(event.request)
          .then((response) => handleResponse(event.request, response))
          .catch((error) => {
            console.error('Network fetch failed:', error);
            throw error;
          });
      })
    );
  }
});
