import { describe, it, expect } from 'vitest';
import { interpolateWind, windDirectionLabel } from '#lib/meteo/wind.js';
import type { PressureLevel, WindData } from './types';

describe('Wind calculations', () => {
  it('interpolateWind', () => {
    const lower: PressureLevel = { hPa: 1000, heightMeters: 0 };
    const upper: PressureLevel = { hPa: 900, heightMeters: 1000 };
    const lowerWind: WindData = { speed: 10, direction: 0 };
    const upperWind: WindData = { speed: 20, direction: 90 };

    const interpolated = interpolateWind(500, lower, upper, lowerWind, upperWind);
    expect(interpolated.speed).toBeCloseTo(15);
    expect(interpolated.direction).toBeCloseTo(45);
  });
});

describe('wind compass directions', () => {
  it.each([
    [0, 'N'],
    [11.24, 'N'],
    [11.25, 'NNE'],
    [90, 'E'],
    [180, 'S'],
    [247.5, 'WSW'],
    [270, 'W'],
    [348.75, 'N'],
    [360, 'N'],
    [-90, 'W'],
    [607.5, 'WSW'],
    [NaN, '—'],
    [Infinity, '—'],
  ])('formats %s° as %s', (direction, label) => {
    expect(windDirectionLabel(direction)).toBe(label);
  });
});
