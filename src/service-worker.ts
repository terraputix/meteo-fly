/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { CacheExpiration, ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { classifyMapCacheResource, MAP_CACHE_NAMES, MAP_CACHE_POLICIES } from '$lib/services/mapCache';
import { markUpdatePromptMigration } from '$lib/services/pwaUpdateMigration';
import {
  cleanupLegacyWeatherCaches,
  handleWeatherRequest,
  MAX_CACHE_AGE_SECONDS,
  MAX_CACHE_ENTRIES,
  WEATHER_CACHE_NAME,
  type WeatherCacheDataset,
  type WeatherCacheOutdatedMessage,
} from '$lib/services/weatherCache';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

clientsClaim();

self.addEventListener('install', (event) => {
  event.waitUntil(
    markUpdatePromptMigration(caches)
      .then((shouldActivate) => (shouldActivate ? self.skipWaiting() : undefined))
      .catch((error) => {
        console.error('PWA update prompt migration failed', error);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

registerRoute(new NavigationRoute(createHandlerBoundToURL('/')));

const cacheableMapResponse = () => new CacheableResponsePlugin({ statuses: [0, 200] });
const expireMapCache = (policy: { maxEntries: number; maxAgeSeconds: number }) =>
  new ExpirationPlugin({
    ...policy,
    purgeOnQuotaError: true,
  });

const mapStrategies = {
  openFreeMapMetadata: new StaleWhileRevalidate({
    cacheName: MAP_CACHE_NAMES.openFreeMapMetadata,
    plugins: [cacheableMapResponse(), expireMapCache(MAP_CACHE_POLICIES.openFreeMapMetadata)],
  }),
  openFreeMapTiles: new CacheFirst({
    cacheName: MAP_CACHE_NAMES.openFreeMapTiles,
    plugins: [cacheableMapResponse(), expireMapCache(MAP_CACHE_POLICIES.openFreeMapTiles)],
  }),
  mapterhornMetadata: new StaleWhileRevalidate({
    cacheName: MAP_CACHE_NAMES.mapterhornMetadata,
    plugins: [cacheableMapResponse(), expireMapCache(MAP_CACHE_POLICIES.mapterhornMetadata)],
  }),
  mapterhornTiles: new CacheFirst({
    cacheName: MAP_CACHE_NAMES.mapterhornTiles,
    plugins: [cacheableMapResponse(), expireMapCache(MAP_CACHE_POLICIES.mapterhornTiles)],
  }),
};

for (const resource of Object.keys(mapStrategies) as Array<keyof typeof mapStrategies>) {
  registerRoute(
    ({ request, url }) => request.method === 'GET' && classifyMapCacheResource(url) === resource,
    mapStrategies[resource],
    'GET'
  );
}

const expiration = new CacheExpiration(WEATHER_CACHE_NAME, {
  maxAgeSeconds: MAX_CACHE_AGE_SECONDS,
  maxEntries: MAX_CACHE_ENTRIES,
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.allSettled([cleanupLegacyWeatherCaches(caches), expiration.expireEntries()]).then(() => undefined)
  );
});

registerRoute(
  /^https:\/\/api\.open-meteo\.com\/v1\/forecast/,
  async ({ request, event }) => {
    const notifyOutdated = async (dataset: WeatherCacheDataset, cachedAt: number) => {
      if (!('clientId' in event) || typeof event.clientId !== 'string' || !event.clientId) return;
      const client = await self.clients.get(event.clientId);
      const message: WeatherCacheOutdatedMessage = {
        type: 'weather-cache-outdated',
        dataset,
        cachedAt,
      };
      client?.postMessage(message);
    };

    return handleWeatherRequest(request, {
      cacheStorage: caches,
      expiration,
      fetchRequest: fetch,
      notifyOutdated,
    });
  },
  'GET'
);
