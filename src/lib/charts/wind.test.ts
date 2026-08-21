import { describe, expect, it } from 'vitest';
import type { WindChartData } from '$lib/api/types';
import { getNativeLevelsForModel } from '$lib/meteo/pressureLevels';
import { getWindFieldAllLevels } from './wind';

describe('wind chart data', () => {
  it('skips non-finite pressure-level values', () => {
    const times = [new Date('2026-07-16T10:00:00Z'), new Date('2026-07-16T11:00:00Z')];
    const data: WindChartData = {
      elevation: 500,
      timezone: 'UTC',
      timezoneAbbr: 'UTC',
      sunrise: times[0],
      sunset: times[1],
      selectedGridCell: null,
      hourly: {
        time: times,
        temperature_2m: new Float32Array(2),
        dewpoint_2m: new Float32Array(2),
        precipitation: new Float32Array(2),
        relativeHumidity_2m: new Float32Array(2),
        cloudCoverLow: new Float32Array(2),
        cloudCoverMid: new Float32Array(2),
        cloudCoverHigh: new Float32Array(2),
        cloudCoverProfile: {},
        windSpeedProfile: { _1000hPa: new Float32Array([Infinity, 10.126]) },
        windDirectionProfile: { _1000hPa: new Float32Array([NaN, 180.6]) },
      },
    };

    const result = getWindFieldAllLevels(data, 'icon_d2', 4000);
    const level = getNativeLevelsForModel('icon_d2', 4000).find((item) => item.hPa === 1000);

    expect(result).toContainEqual({
      time: times[1],
      height: level?.heightMeters,
      pressure: 1000,
      speed: 10.13,
      direction: 181,
      source: 'model',
    });
    expect(result.some((item) => item.time === times[0])).toBe(false);
  });
});
