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

it.each([0, 46.635, 80])('keeps the same ground radius at latitude %s', (latitude) => {
  for (const bearing of [0, 45, 90, 180, 270, 359]) {
    const [lon, lat] = windCompassRimPoint(latitude, 179.999, bearing);
    expect(haversineDistance(latitude, 179.999, lat, lon)).toBeCloseTo(WIND_COMPASS_RADIUS_METERS, 5);
  }
});
