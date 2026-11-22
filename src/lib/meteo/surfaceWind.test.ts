import { expect, it } from 'vitest';
import { describeSurfaceWind, WIND_COMPASS_RADIUS_METERS, windCompassRimPoint } from '#lib/meteo/surfaceWind.js';
import { haversineDistance } from '#lib/meteo/hikeAndFly.js';
import { METRIC_UNITS } from '#lib/utils/units.js';

it('normalizes the source bearing and preserves missing gusts', () => {
  expect(describeSurfaceWind(18, -45, NaN, METRIC_UNITS)).toEqual({
    bearing: 315,
    wind: 'From NW 315° · 18 km/h',
    gust: '—',
  });
});

it('shows calm independently of the preceding gust', () => {
  expect(describeSurfaceWind(0, 120, 36, { ...METRIC_UNITS, wind: 'm/s' })).toEqual({
    bearing: null,
    wind: 'Calm',
    gust: '10 m/s',
  });
});

it('keeps the east rim point at the ground radius across the antimeridian at high latitude', () => {
  const [lon, lat] = windCompassRimPoint(80, 179.999, 90);
  expect(lon).toBeGreaterThan(180);
  expect(haversineDistance(80, 179.999, lat, lon)).toBeCloseTo(WIND_COMPASS_RADIUS_METERS, 5);
});
