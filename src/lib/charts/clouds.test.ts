import { describe, expect, it } from 'vitest';
import type { WindChartData } from '$lib/api/types';
import { getNativeLevelsForModel } from '$lib/meteo/pressureLevels';
import { getCloudCoverData } from './clouds';

describe('cloud chart data', () => {
  it('skips non-finite pressure-level values', () => {
    const level = getNativeLevelsForModel('icon_d2', 4000)[0];
    const times = [new Date('2026-07-16T10:00:00Z'), new Date('2026-07-16T11:00:00Z')];
    const data: WindChartData = {
      elevation: 500,
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
        cloudCoverProfile: {
          [`_${level.hPa}hPa`]: new Float32Array([NaN, 42.25]),
        },
        windSpeedProfile: {},
        windDirectionProfile: {},
      },
    };

    expect(getCloudCoverData(data, 'icon_d2', 4000)).toEqual([{ time: times[1], pressure: level.hPa, value: 42.25 }]);
  });
});
