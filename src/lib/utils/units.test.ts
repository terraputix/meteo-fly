import { describe, expect, it } from 'vitest';
import {
  altitude,
  formatAltitude,
  IMPERIAL_UNITS,
  METRIC_UNITS,
  parseUnits,
  rain,
  temperature,
  windSpeed,
} from '#lib/utils/units.js';

describe('display units', () => {
  it('converts standard reference values', () => {
    expect(temperature(0, IMPERIAL_UNITS)).toBe(32);
    expect(temperature(-40, IMPERIAL_UNITS)).toBe(-40);
    expect(temperature(100, IMPERIAL_UNITS)).toBe(212);
    expect(altitude(304.8, IMPERIAL_UNITS)).toBeCloseTo(1000);
    expect(formatAltitude(304.8, IMPERIAL_UNITS)).toBe('1000 ft');
    expect(rain(25.4, IMPERIAL_UNITS)).toBe(1);
    expect(windSpeed(1.609344, IMPERIAL_UNITS)).toBe(1);
    expect(windSpeed(1.852, { ...METRIC_UNITS, wind: 'kt' })).toBe(1);
    expect(windSpeed(3.6, { ...METRIC_UNITS, wind: 'm/s' })).toBe(1);
  });

  it('preserves metric values, calm wind and missing measurements', () => {
    for (const convert of [altitude, temperature, rain, windSpeed]) {
      expect(convert(12.5, METRIC_UNITS)).toBe(12.5);
      expect(convert(NaN, IMPERIAL_UNITS)).toBeNaN();
    }
    expect(windSpeed(0, IMPERIAL_UNITS)).toBe(0);
    expect(rain(0, IMPERIAL_UNITS)).toBe(0);
  });

  it('validates stored preferences per field and defaults malformed values', () => {
    expect(parseUnits(null)).toEqual(METRIC_UNITS);
    expect(parseUnits('imperial')).toEqual(METRIC_UNITS);
    expect(parseUnits({ wind: 'kt', altitude: 'ft', temperature: 'kelvin', rain: '<script>' })).toEqual({
      ...METRIC_UNITS,
      wind: 'kt',
      altitude: 'ft',
    });
    expect(parseUnits(IMPERIAL_UNITS)).toEqual(IMPERIAL_UNITS);
  });
});
