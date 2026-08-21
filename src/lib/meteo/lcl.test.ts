import { describe, expect, it } from 'vitest';
import type { WindChartData } from '$lib/api/types';
import { calculateLcl, calculateLclWeather } from './lcl';

function createData(): WindChartData {
  return {
    elevation: 500,
    timezone: 'UTC',
    timezoneAbbr: 'UTC',
    sunrise: new Date('2026-07-16T04:00:00Z'),
    sunset: new Date('2026-07-16T20:00:00Z'),
    selectedGridCell: null,
    hourly: {
      time: [new Date('2026-07-16T10:00:00Z'), new Date('2026-07-16T11:00:00Z'), new Date('2026-07-16T12:00:00Z')],
      temperature_2m: new Float32Array([20, NaN, 22]),
      dewpoint_2m: new Float32Array([15, 16, 17]),
      precipitation: new Float32Array(3),
      relativeHumidity_2m: new Float32Array(3),
      cloudCoverLow: new Float32Array(3),
      cloudCoverMid: new Float32Array(3),
      cloudCoverHigh: new Float32Array(3),
      cloudCoverProfile: {},
      windSpeedProfile: {},
      windDirectionProfile: {},
    },
  };
}

describe('LCL calculations', () => {
  it.each([
    [NaN, 10],
    [10, NaN],
    [Infinity, 10],
    [10, -Infinity],
  ])('returns NaN for non-finite inputs', (temperature, dewpoint) => {
    expect(calculateLcl(temperature, dewpoint)).toBeNaN();
  });

  it('creates a gap for a missing surface value', () => {
    expect(calculateLclWeather(createData())).toEqual([
      { time: new Date('2026-07-16T10:00:00Z'), value: 1125 },
      { time: new Date('2026-07-16T11:00:00Z'), value: null },
      { time: new Date('2026-07-16T12:00:00Z'), value: 1125 },
    ]);
  });
});
