import { describe, expect, it } from 'vitest';
import { haversineDistance } from '$lib/meteo/hikeAndFly';
import { boundsForRadius, createElevationLookup, tilesForBbox, WEB_MERCATOR_MAX_LATITUDE } from './dem';

describe('boundsForRadius', () => {
  it.each([
    { name: 'the equator', latitude: 0 },
    { name: 'the Alps', latitude: 47 },
    { name: 'high latitude', latitude: 75 },
  ])('covers equal metric distances at $name', ({ latitude }) => {
    const radius = 10_000;
    const longitude = 8;
    const bounds = boundsForRadius(latitude, longitude, radius);
    const northDistance = haversineDistance(latitude, longitude, bounds.maxLatitude, longitude);
    const southDistance = haversineDistance(latitude, longitude, bounds.minLatitude, longitude);
    const eastDistance = haversineDistance(latitude, longitude, latitude, bounds.maxLongitude);
    const westDistance = haversineDistance(latitude, longitude, latitude, bounds.minLongitude);

    expect(northDistance).toBeCloseTo(radius, -2);
    expect(southDistance).toBeCloseTo(radius, -2);
    expect(eastDistance).toBeCloseTo(radius, -2);
    expect(westDistance).toBeCloseTo(radius, -2);
    expect(eastDistance / northDistance).toBeCloseTo(1, 2);
  });

  it('clamps latitude and requests all longitudes near a pole', () => {
    const bounds = boundsForRadius(89.9, 20, 10_000);

    expect(bounds.minLatitude).toBe(WEB_MERCATOR_MAX_LATITUDE);
    expect(bounds.maxLatitude).toBe(WEB_MERCATOR_MAX_LATITUDE);
    expect(bounds.minLongitude).toBe(-160);
    expect(bounds.maxLongitude).toBe(200);
  });
});

describe('tilesForBbox', () => {
  it('wraps tile selection across the antimeridian', () => {
    const bounds = boundsForRadius(47, 179.99, 10_000);
    const tiles = tilesForBbox(bounds.minLatitude, bounds.maxLatitude, bounds.minLongitude, bounds.maxLongitude, 3);
    const xValues = new Set(tiles.map((tile) => tile.x));

    expect(xValues).toEqual(new Set([7, 0]));
    expect(tiles.every((tile) => tile.x >= 0 && tile.x < 8)).toBe(true);
  });

  it('selects every longitudinal tile for a global span', () => {
    const tiles = tilesForBbox(80, 85, -160, 200, 3);
    expect(new Set(tiles.map((tile) => tile.x))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
  });
});

describe('createElevationLookup', () => {
  it('normalizes longitudes when sampling across the antimeridian', () => {
    const elevation = 123;
    const tiles = new Map([
      [
        '2/0/2',
        {
          width: 2,
          height: 2,
          data: new Float32Array(4).fill(elevation),
        },
      ],
    ]);

    expect(createElevationLookup(tiles, 2)(0, 181)).toBe(elevation);
  });
});
