export const WEATHER_CACHE_NAME = 'weather-api-cache-v2';
export const LEGACY_WEATHER_CACHE_NAMES = ['weather-api-cache'];
export const CACHED_AT_HEADER = 'x-meteo-fly-cached-at';
export const FRESH_MS = 5 * 60 * 1000;
export const OUTDATED_WARNING_MS = 24 * 60 * 60 * 1000;
export const MAX_CACHE_AGE_SECONDS = 14 * 24 * 60 * 60;
export const MAX_CACHE_ENTRIES = 100;

export interface WeatherCacheExpiration {
  updateTimestamp(url: string): Promise<void>;
  expireEntries(): Promise<void>;
  delete(): Promise<void>;
}

export interface WeatherCacheEvent {
  waitUntil(promise: Promise<unknown>): void;
}

export interface WeatherCacheDependencies {
  cacheStorage: Pick<CacheStorage, 'open' | 'delete'>;
  expiration: WeatherCacheExpiration;
  fetchRequest: (request: Request) => Promise<Response>;
  notifyOutdated: (cachedAt: number) => Promise<void>;
  now?: () => number;
}

export interface WeatherCacheOutdatedMessage {
  type: 'weather-cache-outdated';
  cachedAt: number;
}

function getCachedAt(response: Response): number | null {
  const cachedAt = Number(response.headers.get(CACHED_AT_HEADER));
  return Number.isFinite(cachedAt) && cachedAt > 0 ? cachedAt : null;
}

function isQuotaExceededError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'QuotaExceededError';
}

function settle(promise: Promise<unknown>): Promise<void> {
  return promise.then(
    () => undefined,
    () => undefined
  );
}

function createCachedResponse(response: Response, cachedAt: number): Response {
  const clone = response.clone();
  const headers = new Headers(clone.headers);
  headers.set(CACHED_AT_HEADER, String(cachedAt));

  return new Response(clone.body, {
    status: clone.status,
    statusText: clone.statusText,
    headers,
  });
}

async function purgeWeatherCache(dependencies: WeatherCacheDependencies): Promise<void> {
  await dependencies.cacheStorage.delete(WEATHER_CACHE_NAME);
  await dependencies.expiration.delete();
}

async function cacheResponse(
  request: Request,
  response: Response,
  dependencies: WeatherCacheDependencies
): Promise<void> {
  try {
    const cache = await dependencies.cacheStorage.open(WEATHER_CACHE_NAME);
    await cache.put(request, response);
    await dependencies.expiration.updateTimestamp(request.url);
    await dependencies.expiration.expireEntries();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      await settle(purgeWeatherCache(dependencies));
    }
  }
}

function scheduleCacheWrite(
  request: Request,
  response: Response,
  cachedAt: number,
  event: WeatherCacheEvent,
  dependencies: WeatherCacheDependencies
): void {
  const cachedResponse = createCachedResponse(response, cachedAt);
  event.waitUntil(cacheResponse(request, cachedResponse, dependencies));
}

function returnCachedFallback(
  response: Response,
  cachedAt: number,
  now: number,
  event: WeatherCacheEvent,
  dependencies: WeatherCacheDependencies
): Response {
  if (now - cachedAt >= OUTDATED_WARNING_MS) {
    event.waitUntil(settle(dependencies.notifyOutdated(cachedAt)));
  }
  return response;
}

export async function handleWeatherRequest(
  request: Request,
  event: WeatherCacheEvent,
  dependencies: WeatherCacheDependencies
): Promise<Response> {
  const now = (dependencies.now ?? Date.now)();
  const cache = await dependencies.cacheStorage.open(WEATHER_CACHE_NAME);
  const cached = await cache.match(request);

  event.waitUntil(settle(dependencies.expiration.expireEntries()));

  if (cached) {
    const cachedAt = getCachedAt(cached);
    const age = cachedAt === null ? Infinity : now - cachedAt;

    if (cachedAt === null || age >= MAX_CACHE_AGE_SECONDS * 1000) {
      event.waitUntil(settle(cache.delete(request)));
    } else if (age < FRESH_MS) {
      return cached;
    } else {
      try {
        const response = await dependencies.fetchRequest(request);
        if (response.ok) {
          scheduleCacheWrite(request, response, now, event, dependencies);
          return response;
        }
      } catch {
        return returnCachedFallback(cached, cachedAt, now, event, dependencies);
      }

      return returnCachedFallback(cached, cachedAt, now, event, dependencies);
    }
  }

  try {
    const response = await dependencies.fetchRequest(request);
    if (response.ok) {
      scheduleCacheWrite(request, response, now, event, dependencies);
    }
    return response;
  } catch {
    return new Response(null, { status: 503 });
  }
}

export async function cleanupLegacyWeatherCaches(cacheStorage: Pick<CacheStorage, 'delete'>): Promise<void> {
  await Promise.all(LEGACY_WEATHER_CACHE_NAMES.map((cacheName) => cacheStorage.delete(cacheName)));
}

export function isWeatherCacheOutdatedMessage(value: unknown): value is WeatherCacheOutdatedMessage {
  if (typeof value !== 'object' || value === null) return false;
  if (!('type' in value) || value.type !== 'weather-cache-outdated') return false;
  return 'cachedAt' in value && typeof value.cachedAt === 'number' && Number.isFinite(value.cachedAt);
}
