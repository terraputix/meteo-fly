export const MAP_CACHE_NAMES = {
  openFreeMapMetadata: 'openfreemap-metadata-v1',
  openFreeMapTiles: 'openfreemap-tiles-v1',
  mapterhornMetadata: 'mapterhorn-metadata-v1',
  mapterhornTiles: 'mapterhorn-tiles-v1',
} as const;

export const MAP_CACHE_POLICIES = {
  openFreeMapMetadata: {
    maxEntries: 50,
    maxAgeSeconds: 7 * 24 * 60 * 60,
  },
  openFreeMapTiles: {
    maxEntries: 400,
    maxAgeSeconds: 30 * 24 * 60 * 60,
  },
  mapterhornMetadata: {
    maxEntries: 5,
    maxAgeSeconds: 7 * 24 * 60 * 60,
  },
  mapterhornTiles: {
    maxEntries: 200,
    maxAgeSeconds: 30 * 24 * 60 * 60,
  },
} as const;

export type MapCacheResource = 'openFreeMapMetadata' | 'openFreeMapTiles' | 'mapterhornMetadata' | 'mapterhornTiles';

export function classifyMapCacheResource(url: URL): MapCacheResource | null {
  if (url.protocol !== 'https:') return null;

  if (url.hostname === 'tiles.openfreemap.org') {
    return url.pathname.startsWith('/styles/') || url.pathname.startsWith('/fonts/')
      ? 'openFreeMapMetadata'
      : 'openFreeMapTiles';
  }

  if (url.hostname === 'tiles.mapterhorn.com') {
    if (url.pathname === '/tilejson.json') return 'mapterhornMetadata';
    if (url.pathname.endsWith('.webp')) return 'mapterhornTiles';
  }

  return null;
}
