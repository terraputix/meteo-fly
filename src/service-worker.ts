/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
// self.clientsClaim();

const CACHE_NAME = 'weather-api-cache';
const CACHED_AT_HEADER = 'x-meteo-fly-cached-at';
const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;

function getCacheAge(response: Response): number | null {
  const val = response.headers.get(CACHED_AT_HEADER);
  if (!val) return null;
  return Date.now() - parseInt(val, 10);
}

registerRoute(
  /^https:\/\/api\.open-meteo\.com\/v1\/forecast/,
  async ({ request }) => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
      const age = getCacheAge(cached);

      if (age !== null && age < FRESH_MS) {
        return cached;
      }

      if (age !== null && age < STALE_MS) {
        try {
          const res = await fetch(request);
          if (res.ok) {
            const resClone = res.clone();
            const headers = new Headers(res.headers);
            headers.set(CACHED_AT_HEADER, String(Date.now()));
            await cache.put(
              request,
              new Response(resClone.body, {
                status: res.status,
                statusText: res.statusText,
                headers,
              })
            );
            return res;
          }
        } catch {
          /* offline — fall back to stale */
        }
        return cached;
      }
    }

    try {
      const res = await fetch(request);
      if (res.ok) {
        const resClone = res.clone();
        const headers = new Headers(res.headers);
        headers.set(CACHED_AT_HEADER, String(Date.now()));
        await cache.put(
          request,
          new Response(resClone.body, {
            status: res.status,
            statusText: res.statusText,
            headers,
          })
        );
      }
      return res;
    } catch {
      return cached ?? new Response(null, { status: 503 });
    }
  },
  'GET'
);
