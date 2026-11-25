import { describe, expect, it } from 'vitest';
import { classifyMapCacheResource, MAP_CACHE_NAMES, MAP_CACHE_POLICIES } from './mapCache';

describe('map cache request classification', () => {
  it.each([
    ['https://tiles.openfreemap.org/styles/positron', 'openFreeMapMetadata'],
    ['https://tiles.openfreemap.org/styles/positron/sprite.json', 'openFreeMapMetadata'],
    ['https://tiles.openfreemap.org/fonts/Noto%20Sans/0-255.pbf', 'openFreeMapMetadata'],
    ['https://tiles.openfreemap.org/planet/12/2201/1432.pbf', 'openFreeMapTiles'],
    ['https://tiles.mapterhorn.com/tilejson.json', 'mapterhornMetadata'],
    ['https://tiles.mapterhorn.com/12/2201/1432.webp', 'mapterhornTiles'],
  ] as const)('classifies %s as %s', (url, resource) => {
    expect(classifyMapCacheResource(new URL(url))).toBe(resource);
  });

  it.each([
    'http://tiles.openfreemap.org/styles/positron',
    'https://openfreemap.org/styles/positron',
    'https://tiles.mapterhorn.com/12/2201/1432.png',
    'https://api.open-meteo.com/v1/forecast',
  ])('does not cache unrelated resource %s', (url) => {
    expect(classifyMapCacheResource(new URL(url))).toBeNull();
  });
});

describe('map cache policy', () => {
  it('uses versioned cache names', () => {
    expect(Object.values(MAP_CACHE_NAMES).every((name) => name.endsWith('-v1'))).toBe(true);
  });

  it('keeps bounded metadata, map, and terrain caches', () => {
    expect(MAP_CACHE_POLICIES.openFreeMapMetadata).toEqual({
      maxEntries: 50,
      maxAgeSeconds: 7 * 24 * 60 * 60,
    });
    expect(MAP_CACHE_POLICIES.openFreeMapTiles).toEqual({
      maxEntries: 400,
      maxAgeSeconds: 30 * 24 * 60 * 60,
    });
    expect(MAP_CACHE_POLICIES.mapterhornMetadata).toEqual({
      maxEntries: 5,
      maxAgeSeconds: 7 * 24 * 60 * 60,
    });
    expect(MAP_CACHE_POLICIES.mapterhornTiles).toEqual({
      maxEntries: 200,
      maxAgeSeconds: 30 * 24 * 60 * 60,
    });
  });
});
