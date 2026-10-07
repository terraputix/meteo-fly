import { describe, expect, it } from 'vitest';
import type { WindChartData } from '#lib/api/types.js';
import { getNativeLevelsForModel } from '#lib/meteo/pressureLevels.js';
import { createCloudCoverSampler, getCloudCoverData } from '#lib/charts/clouds.js';

describe('cloud chart data', () => {
  it('skips non-finite pressure-level values', () => {
    const level = getNativeLevelsForModel('icon_d2', 4000)[0];
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

describe('cloud cover interpolation', () => {
  const times = [new Date('2026-07-16T10:00:00Z'), new Date('2026-07-16T11:00:00Z')];
  const clouds = [
    { time: times[0], pressure: 850, value: 0 },
    { time: times[1], pressure: 850, value: 40 },
    { time: times[0], pressure: 1000, value: 60 },
    { time: times[1], pressure: 1000, value: 100 },
  ];

  it('interpolates in both time and pressure and clamps outside the forecast domain', () => {
    const sample = createCloudCoverSampler(clouds, times);
    expect(sample(+times[0] + 900000, 910)).toBeCloseTo(34);
    expect(sample(+times[0] - 3600000, 800)).toBe(0);
    expect(sample(+times[1] + 3600000, 1050)).toBe(100);
  });

  it('preserves missing forecast hours and native pressure levels', () => {
    const missingHour = createCloudCoverSampler(
      clouds.filter((cloud) => cloud.time === times[0]),
      times
    );
    expect(missingHour(+times[1], 850)).toBeUndefined();
    expect(missingHour(+times[0] + 900000, 850)).toBe(0);
    const missingLevel = createCloudCoverSampler(clouds, times, [850, 925, 1000]);
    expect(missingLevel(+times[0], 925)).toBeUndefined();
    expect(missingLevel(+times[0], 860)).toBe(0);
  });

  it('returns no value for empty data or invalid coordinates', () => {
    expect(createCloudCoverSampler([], times)(+times[0], 850)).toBeUndefined();
    const sample = createCloudCoverSampler(clouds, times);
    expect(sample(NaN, 850)).toBeUndefined();
    expect(sample(+times[0], Infinity)).toBeUndefined();
  });
});
