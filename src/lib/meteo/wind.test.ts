import { describe, it, expect } from 'vitest';
import { getUComponent, getVComponent, interpolateWind } from './wind';
import type { PressureLevel, WindData } from './types';

describe('Wind calculations', () => {
  it('getUComponent', () => {
    expect(getUComponent(10, 90)).toBeCloseTo(10);
    expect(getUComponent(10, 0)).toBeCloseTo(0);
    expect(getUComponent(10, 180)).toBeCloseTo(0);
    expect(getUComponent(10, 270)).toBeCloseTo(-10);
  });

  it('getVComponent', () => {
    expect(getVComponent(10, 90)).toBeCloseTo(0);
    expect(getVComponent(10, 0)).toBeCloseTo(10);
    expect(getVComponent(10, 180)).toBeCloseTo(-10);
  });

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
