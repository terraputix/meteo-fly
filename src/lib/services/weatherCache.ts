export const WEATHER_CACHE_NAME = 'weather-api-cache-v2';
export const LEGACY_WEATHER_CACHE_NAMES = ['weather-api-cache'];
export const CACHED_AT_HEADER = 'x-meteo-fly-cached-at';
export const CACHE_FIRST_MS = 5 * 60 * 1000;
export const OUTDATED_WARNING_MS = 24 * 60 * 60 * 1000;
export const MAX_CACHE_AGE_SECONDS = 14 * 24 * 60 * 60;
export const MAX_CACHE_ENTRIES = 100;

export interface WeatherCacheExpiration {
  updateTimestamp(url: string): Promise<void>;
  expireEntries(): Promise<void>;
  delete(): Promise<void>;
}

export type WeatherCacheDataset = 'wind' | 'skewt';

export interface WeatherCacheDependencies {
  cacheStorage: Pick<CacheStorage, 'open' | 'delete'>;
  expiration: WeatherCacheExpiration;
  fetchRequest: (request: Request) => Promise<Response>;
  notifyOutdated: (dataset: WeatherCacheDataset, cachedAt: number) => Promise<void>;
  now?: () => number;
}

export interface WeatherCacheOutdatedMessage {
  type: 'weather-cache-outdated';
  dataset: WeatherCacheDataset;
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

function getWeatherCacheDataset(request: Request): WeatherCacheDataset | null {
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get('latitude')?.includes(',') && searchParams.get('hourly') === 'precipitation') return 'wind';
  if (searchParams.has('daily')) return 'wind';
  if (searchParams.has('hourly')) return 'skewt';
  return null;
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

async function cacheNetworkResponse(
  request: Request,
  response: Response,
  cachedAt: number,
  dependencies: WeatherCacheDependencies
): Promise<void> {
  const cachedResponse = createCachedResponse(response, cachedAt);
  await cacheResponse(request, cachedResponse, dependencies);
}

async function fetchAndCacheNetworkResponse(
  request: Request,
  cachedAt: number,
  dependencies: WeatherCacheDependencies
): Promise<Response> {
  const fetchRequest = dependencies.fetchRequest;

  try {
    const response = await fetchRequest(request);
    if (response.ok) {
      await cacheNetworkResponse(request, response, cachedAt, dependencies);
    }
    return response;
  } catch {
    return new Response(null, { status: 503 });
  }
}

async function returnCachedFallback(
  request: Request,
  response: Response,
  cachedAt: number,
  now: number,
  dependencies: WeatherCacheDependencies
): Promise<Response> {
  if (now - cachedAt >= OUTDATED_WARNING_MS) {
    const dataset = getWeatherCacheDataset(request);
    if (dataset) {
      await settle(dependencies.notifyOutdated(dataset, cachedAt));
    }
  }
  return response;
}

export async function handleWeatherRequest(
  request: Request,
  dependencies: WeatherCacheDependencies
): Promise<Response> {
  const now = (dependencies.now ?? Date.now)();
  const fetchRequest = dependencies.fetchRequest;
  let cache: Cache;
  let cached: Response | undefined;

  try {
    cache = await dependencies.cacheStorage.open(WEATHER_CACHE_NAME);
    cached = await cache.match(request);
  } catch {
    return fetchAndCacheNetworkResponse(request, now, dependencies);
  }

  if (cached) {
    const cachedAt = getCachedAt(cached);
    const age = cachedAt === null ? Infinity : now - cachedAt;

    if (cachedAt === null || age >= MAX_CACHE_AGE_SECONDS * 1000) {
      await settle(cache.delete(request));
    } else if (age < CACHE_FIRST_MS) {
      return cached;
    } else {
      try {
        const response = await fetchRequest(request);
        if (response.ok) {
          await cacheNetworkResponse(request, response, now, dependencies);
          return response;
        }
      } catch {
        return returnCachedFallback(request, cached, cachedAt, now, dependencies);
      }

      return returnCachedFallback(request, cached, cachedAt, now, dependencies);
    }
  }

  return fetchAndCacheNetworkResponse(request, now, dependencies);
}

export async function cleanupLegacyWeatherCaches(cacheStorage: Pick<CacheStorage, 'delete'>): Promise<void> {
  await Promise.all(LEGACY_WEATHER_CACHE_NAMES.map((cacheName) => cacheStorage.delete(cacheName)));
}

export function isWeatherCacheOutdatedMessage(value: unknown): value is WeatherCacheOutdatedMessage {
  if (typeof value !== 'object' || value === null) return false;
  if (!('type' in value) || value.type !== 'weather-cache-outdated') return false;
  if (!('dataset' in value) || (value.dataset !== 'wind' && value.dataset !== 'skewt')) return false;
  return 'cachedAt' in value && typeof value.cachedAt === 'number' && Number.isFinite(value.cachedAt);
}
