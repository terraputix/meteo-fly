/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { CacheExpiration } from 'workbox-expiration';
import {
  cleanupLegacyWeatherCaches,
  handleWeatherRequest,
  MAX_CACHE_AGE_SECONDS,
  MAX_CACHE_ENTRIES,
  WEATHER_CACHE_NAME,
  type WeatherCacheOutdatedMessage,
} from '$lib/services/weatherCache';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

const expiration = new CacheExpiration(WEATHER_CACHE_NAME, {
  maxAgeSeconds: MAX_CACHE_AGE_SECONDS,
  maxEntries: MAX_CACHE_ENTRIES,
});

self.addEventListener('activate', (event) => {
  event.waitUntil(cleanupLegacyWeatherCaches(caches));
});

registerRoute(
  /^https:\/\/api\.open-meteo\.com\/v1\/forecast/,
  async ({ request, event }) => {
    const notifyOutdated = async (cachedAt: number) => {
      if (!('clientId' in event) || typeof event.clientId !== 'string' || !event.clientId) return;
      const client = await self.clients.get(event.clientId);
      const message: WeatherCacheOutdatedMessage = {
        type: 'weather-cache-outdated',
        cachedAt,
      };
      client?.postMessage(message);
    };

    return handleWeatherRequest(request, event, {
      cacheStorage: caches,
      expiration,
      fetchRequest: fetch,
      notifyOutdated,
    });
  },
  'GET'
);
