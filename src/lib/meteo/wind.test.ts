import { describe, it, expect } from 'vitest';
import { interpolateWind } from './wind';
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
