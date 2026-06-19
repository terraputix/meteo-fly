import { describe, it, expect } from 'vitest';
import { generateReachableArea, computeHeightAGL, haversineDistance } from '$lib/meteo/hikeAndFly';

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(47.0, 8.0, 47.0, 8.0)).toBeCloseTo(0, 0);
  });

  it('computes known distance (Zürich to Bern ~95km)', () => {
    const dist = haversineDistance(47.3769, 8.5417, 46.948, 7.4474);
    expect(dist).toBeCloseTo(95_494, 0);
  });
});

describe('generateReachableArea', () => {
  const flatTerrain = () => 500;

  it('returns at least the takeoff point on flat terrain', () => {
    const points = generateReachableArea(
      {
        takeoff: { latitude: 47.0, longitude: 8.0, elevation: 500 },
        glideRatio: 8,
        initialAltitude: 100,
        stepMeters: 200,
      },
      flatTerrain
    );
    expect(points.length).toBeGreaterThanOrEqual(1);
    expect(points[0].distance).toBeCloseTo(0, 0);
  });

  it('stops at a ridge — points beyond a higher-elevation barrier are not reachable', () => {
    const config = {
      takeoff: { latitude: 47.0, longitude: 8.0, elevation: 500 },
      glideRatio: 8,
      initialAltitude: 200,
      stepMeters: 300,
    };

    // Simulate a ridge running east-west just north of takeoff:
    // terrain at 500m for points south and at the ridge, then 800m beyond
    function ridgeTerrain(lat: number) {
      if (lat > 47.03) return 800;
      return 500;
    }

    const points = generateReachableArea(config, ridgeTerrain);

    // No point should be north of the ridge
    for (const pt of points) {
      if (pt.latitude > 47.03) {
        throw new Error(`Point beyond ridge: ${pt.latitude}, dist=${pt.distance}`);
      }
    }

    // Points south of the ridge should be reachable
    const southPoints = points.filter((p) => p.latitude <= 47.0);
    expect(southPoints.length).toBeGreaterThan(30);
  });

  it('terminates within maxIterations even for very efficient glide', () => {
    const config = {
      takeoff: { latitude: 47.0, longitude: 8.0, elevation: 1000 },
      glideRatio: 100,
      initialAltitude: 500,
      stepMeters: 200,
    };
    const points = generateReachableArea(config, flatTerrain, 5000);
    expect(points.length).toBeGreaterThan(0);
  });
});

describe('computeHeightAGL', () => {
  it('returns positive value for short distance', () => {
    // takeoff 1000m, 100m initial, glide 8:1, 100m distance, terrain 1000m
    // height = 1000 + 100 - 100/8 - 1000 = 100 - 12.5 = 87.5
    expect(computeHeightAGL(1000, 100, 100, 8, 1000)).toBeCloseTo(87.5);
  });

  it('returns negative value when glide runs out', () => {
    // takeoff 1000m, 100m initial, glide 8:1, 2000m distance, terrain 950m
    // height = 1000 + 100 - 2000/8 - 950 = 1100 - 250 - 950 = -100
    expect(computeHeightAGL(1000, 100, 2000, 8, 950)).toBeCloseTo(-100);
  });

  it('returns zero at exact landing point on flat terrain', () => {
    // takeoff 500m, 200m initial, glide 10:1, distance 2000m, terrain 500m
    // height = 500 + 200 - 2000/10 - 500 = 200 - 200 = 0
    expect(computeHeightAGL(500, 200, 2000, 10, 500)).toBe(0);
  });
});
