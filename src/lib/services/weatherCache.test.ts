import { describe, expect, it, vi } from 'vitest';
import {
  CACHED_AT_HEADER,
  CACHE_FIRST_MS,
  cleanupLegacyWeatherCaches,
  handleWeatherRequest,
  isWeatherCacheOutdatedMessage,
  MAX_CACHE_AGE_SECONDS,
  MAX_CACHE_ENTRIES,
  OUTDATED_WARNING_MS,
  WEATHER_CACHE_NAME,
  type WeatherCacheDependencies,
  type WeatherCacheExpiration,
} from './weatherCache';

const REQUEST = new Request('https://api.open-meteo.com/v1/forecast?latitude=47&daily=sunrise');
const SKEWT_REQUEST = new Request('https://api.open-meteo.com/v1/forecast?latitude=47&hourly=temperature');
const NOW = Date.parse('2026-07-16T12:00:00Z');

class MemoryCache {
  readonly responses = new Map<string, Response>();
  putError: unknown = null;

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.responses.get(this.getKey(request))?.clone();
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    if (this.putError) throw this.putError;
    this.responses.set(this.getKey(request), response.clone());
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.responses.delete(this.getKey(request));
  }

  private getKey(request: RequestInfo | URL): string {
    if (request instanceof Request) return request.url;
    if (request instanceof URL) return request.href;
    return request;
  }
}

class MemoryCacheStorage {
  readonly caches = new Map<string, MemoryCache>();
  readonly deleted: string[] = [];
  openError: unknown = null;

  async open(cacheName: string): Promise<Cache> {
    if (this.openError) throw this.openError;
    let cache = this.caches.get(cacheName);
    if (!cache) {
      cache = new MemoryCache();
      this.caches.set(cacheName, cache);
    }
    return cache as unknown as Cache;
  }

  async delete(cacheName: string): Promise<boolean> {
    this.deleted.push(cacheName);
    return this.caches.delete(cacheName);
  }

  getWeatherCache(): MemoryCache {
    let cache = this.caches.get(WEATHER_CACHE_NAME);
    if (!cache) {
      cache = new MemoryCache();
      this.caches.set(WEATHER_CACHE_NAME, cache);
    }
    return cache;
  }
}

function createCachedResponse(body: string, cachedAt: number): Response {
  return new Response(body, {
    headers: {
      [CACHED_AT_HEADER]: String(cachedAt),
    },
  });
}

function createExpiration(): WeatherCacheExpiration {
  return {
    updateTimestamp: vi.fn().mockResolvedValue(undefined),
    expireEntries: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function createDependencies(
  cacheStorage: MemoryCacheStorage,
  overrides: Partial<WeatherCacheDependencies> = {}
): WeatherCacheDependencies {
  return {
    cacheStorage,
    expiration: createExpiration(),
    fetchRequest: vi.fn().mockResolvedValue(new Response('network')),
    notifyOutdated: vi.fn().mockResolvedValue(undefined),
    now: () => NOW,
    ...overrides,
  };
}

describe('weather cache policy', () => {
  it('uses the configured retention and entry limits', () => {
    expect(MAX_CACHE_AGE_SECONDS).toBe(14 * 24 * 60 * 60);
    expect(MAX_CACHE_ENTRIES).toBe(100);
  });

  it('returns a fresh cached response without fetching', async () => {
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage.getWeatherCache().responses.set(REQUEST.url, createCachedResponse('cached', NOW - CACHE_FIRST_MS + 1));
    const dependencies = createDependencies(cacheStorage);

    const response = await handleWeatherRequest(REQUEST, dependencies);

    expect(await response.text()).toBe('cached');
    expect(dependencies.fetchRequest).not.toHaveBeenCalled();
  });

  it('refreshes a stale cached response from the network', async () => {
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage.getWeatherCache().responses.set(REQUEST.url, createCachedResponse('cached', NOW - CACHE_FIRST_MS));
    const expiration = createExpiration();
    const dependencies = createDependencies(cacheStorage, {
      expiration,
      fetchRequest: vi.fn().mockResolvedValue(new Response('network')),
    });

    const response = await handleWeatherRequest(REQUEST, dependencies);
    expect(await response.text()).toBe('network');

    const cached = await cacheStorage.getWeatherCache().match(REQUEST);
    expect(cached?.headers.get(CACHED_AT_HEADER)).toBe(String(NOW));
    expect(expiration.updateTimestamp).toHaveBeenCalledWith(REQUEST.url);
    expect(expiration.expireEntries).toHaveBeenCalled();
  });

  it('falls back to stale cached data without warning before 24 hours', async () => {
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage
      .getWeatherCache()
      .responses.set(REQUEST.url, createCachedResponse('cached', NOW - OUTDATED_WARNING_MS + 1));
    const notifyOutdated = vi.fn().mockResolvedValue(undefined);
    const dependencies = createDependencies(cacheStorage, {
      fetchRequest: vi.fn().mockRejectedValue(new TypeError('offline')),
      notifyOutdated,
    });

    const response = await handleWeatherRequest(REQUEST, dependencies);

    expect(await response.text()).toBe('cached');
    expect(notifyOutdated).not.toHaveBeenCalled();
  });

  it('warns with the oldest fetch timestamp when fallback data is over 24 hours old', async () => {
    const cachedAt = NOW - OUTDATED_WARNING_MS;
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage.getWeatherCache().responses.set(REQUEST.url, createCachedResponse('cached', cachedAt));
    const notifyOutdated = vi.fn().mockResolvedValue(undefined);
    const dependencies = createDependencies(cacheStorage, {
      fetchRequest: vi.fn().mockResolvedValue(new Response('unavailable', { status: 500 })),
      notifyOutdated,
    });

    const response = await handleWeatherRequest(REQUEST, dependencies);

    expect(await response.text()).toBe('cached');
    expect(notifyOutdated).toHaveBeenCalledWith('wind', cachedAt);
  });

  it('identifies outdated Skew-T fallback separately from wind data', async () => {
    const cachedAt = NOW - OUTDATED_WARNING_MS;
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage.getWeatherCache().responses.set(SKEWT_REQUEST.url, createCachedResponse('cached', cachedAt));
    const notifyOutdated = vi.fn().mockResolvedValue(undefined);
    const dependencies = createDependencies(cacheStorage, {
      fetchRequest: vi.fn().mockRejectedValue(new TypeError('offline')),
      notifyOutdated,
    });

    const response = await handleWeatherRequest(SKEWT_REQUEST, dependencies);

    expect(await response.text()).toBe('cached');
    expect(notifyOutdated).toHaveBeenCalledWith('skewt', cachedAt);
  });

  it('invokes the network fetch without binding the dependency object as its receiver', async () => {
    const cacheStorage = new MemoryCacheStorage();
    const fetchRequest = vi.fn(function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation');
      return Promise.resolve(new Response('network'));
    });
    const dependencies = createDependencies(cacheStorage, { fetchRequest });

    const response = await handleWeatherRequest(REQUEST, dependencies);

    expect(await response.text()).toBe('network');
  });

  it('rejects cached data at the 14-day boundary', async () => {
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage
      .getWeatherCache()
      .responses.set(REQUEST.url, createCachedResponse('expired', NOW - MAX_CACHE_AGE_SECONDS * 1000));
    const dependencies = createDependencies(cacheStorage, {
      fetchRequest: vi.fn().mockRejectedValue(new TypeError('offline')),
    });

    const response = await handleWeatherRequest(REQUEST, dependencies);

    expect(response.status).toBe(503);
    expect(await cacheStorage.getWeatherCache().match(REQUEST)).toBeUndefined();
  });

  it('rejects cached data without a valid fetch timestamp', async () => {
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage.getWeatherCache().responses.set(REQUEST.url, new Response('invalid'));
    const dependencies = createDependencies(cacheStorage, {
      fetchRequest: vi.fn().mockRejectedValue(new TypeError('offline')),
    });

    const response = await handleWeatherRequest(REQUEST, dependencies);

    expect(response.status).toBe(503);
    expect(await cacheStorage.getWeatherCache().match(REQUEST)).toBeUndefined();
  });

  it('returns 503 when uncached and offline', async () => {
    const cacheStorage = new MemoryCacheStorage();
    const dependencies = createDependencies(cacheStorage, {
      fetchRequest: vi.fn().mockRejectedValue(new TypeError('offline')),
    });

    const response = await handleWeatherRequest(REQUEST, dependencies);

    expect(response.status).toBe(503);
  });

  it('uses the network when Cache Storage cannot be opened', async () => {
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage.openError = new Error('cache unavailable');
    const dependencies = createDependencies(cacheStorage, {
      fetchRequest: vi.fn().mockResolvedValue(new Response('network')),
    });

    const response = await handleWeatherRequest(REQUEST, dependencies);

    expect(await response.text()).toBe('network');
  });

  it('returns a successful network response when the cache write fails', async () => {
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage.getWeatherCache().putError = new Error('cache unavailable');
    const dependencies = createDependencies(cacheStorage, {
      fetchRequest: vi.fn().mockResolvedValue(new Response('network')),
    });

    const response = await handleWeatherRequest(REQUEST, dependencies);
    expect(await response.text()).toBe('network');
  });

  it('purges the weather cache and expiration metadata after a quota error', async () => {
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage.getWeatherCache().putError = new DOMException('Storage full', 'QuotaExceededError');
    const expiration = createExpiration();
    const dependencies = createDependencies(cacheStorage, {
      expiration,
      fetchRequest: vi.fn().mockResolvedValue(new Response('network')),
    });

    const response = await handleWeatherRequest(REQUEST, dependencies);
    expect(await response.text()).toBe('network');

    expect(cacheStorage.deleted).toContain(WEATHER_CACHE_NAME);
    expect(expiration.delete).toHaveBeenCalled();
  });
});

describe('weather cache lifecycle and messages', () => {
  it('deletes only the known legacy cache', async () => {
    const cacheStorage = new MemoryCacheStorage();
    cacheStorage.caches.set('weather-api-cache', new MemoryCache());
    cacheStorage.caches.set(WEATHER_CACHE_NAME, new MemoryCache());
    cacheStorage.caches.set('workbox-precache-v2', new MemoryCache());

    await cleanupLegacyWeatherCaches(cacheStorage);

    expect(cacheStorage.deleted).toEqual(['weather-api-cache']);
    expect(cacheStorage.caches.has(WEATHER_CACHE_NAME)).toBe(true);
    expect(cacheStorage.caches.has('workbox-precache-v2')).toBe(true);
  });

  it('recognizes only valid outdated-cache messages', () => {
    expect(isWeatherCacheOutdatedMessage({ type: 'weather-cache-outdated', dataset: 'wind', cachedAt: NOW })).toBe(
      true
    );
    expect(isWeatherCacheOutdatedMessage({ type: 'weather-cache-outdated', dataset: 'skewt', cachedAt: NOW })).toBe(
      true
    );
    expect(isWeatherCacheOutdatedMessage({ type: 'weather-cache-outdated', dataset: 'wind', cachedAt: NaN })).toBe(
      false
    );
    expect(isWeatherCacheOutdatedMessage({ type: 'weather-cache-outdated', dataset: 'other', cachedAt: NOW })).toBe(
      false
    );
  });
});
