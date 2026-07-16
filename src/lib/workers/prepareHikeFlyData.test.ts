import { describe, expect, it } from 'vitest';
import { heightAGLToRgba, prepareHikeFlyData } from './prepareHikeFlyData';

describe('prepareHikeFlyData', () => {
  it('builds raster metadata and a lookup for reachable points', () => {
    const result = prepareHikeFlyData(
      {
        takeoff: { latitude: 47, longitude: 8, elevation: 500 },
        glideRatio: 8,
        initialAltitude: 100,
        stepMeters: 200,
      },
      () => 500,
      1
    );

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect([...result.pixels]).toEqual([220, 204, 40, 145]);
    expect(result.pointLookup.get('0,0')).toMatchObject({
      latitude: 47,
      longitude: 8,
      distance: 0,
      terrainElevation: 500,
      heightAGL: 100,
    });
    expect(result.coordinates[0]).toEqual([8, 47]);
    expect(result.coordinates[2][0]).toBeGreaterThan(8);
    expect(result.coordinates[2][1]).toBeLessThan(47);
  });
});

describe('heightAGLToRgba', () => {
  it('maps low, medium, and high clearance to the expected palette', () => {
    expect(heightAGLToRgba(-1)).toEqual([239, 68, 68, 140]);
    expect(heightAGLToRgba(200)).toEqual([132, 204, 22, 150]);
    expect(heightAGLToRgba(800)).toEqual([20, 50, 140, 170]);
  });
});
