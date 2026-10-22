import { describe, expect, it } from 'vitest';
import type { WindChartData } from '#lib/api/types.js';
import { prepareChartData } from './prepareChartData';

function createData(): WindChartData {
  return {
    elevation: 500,
    timezone: 'UTC',
    timezoneAbbr: 'UTC',
    sunrise: new Date('2026-07-16T04:00:00Z'),
    sunset: new Date('2026-07-16T20:00:00Z'),
    selectedGridCell: null,
    hourly: {
      time: [new Date('2026-07-16T10:00:00Z'), new Date('2026-07-16T11:00:00Z')],
      temperature_2m: new Float32Array([20, 21]),
      dewpoint_2m: new Float32Array([NaN, 15]),
      precipitation: new Float32Array([NaN, 1]),
      relativeHumidity_2m: new Float32Array([60, 65]),
      cloudCoverLow: new Float32Array([NaN, 40]),
      cloudCoverMid: new Float32Array([20, 30]),
      cloudCoverHigh: new Float32Array([10, 20]),
      cloudCoverProfile: {},
      windSpeedProfile: {},
      windDirectionProfile: {},
    },
  };
}

describe('chart worker preparation', () => {
  it('keeps unrelated chart data when LCL and wind values are missing', () => {
    const result = prepareChartData({
      windChartData: createData(),
      maxAltitude: 4000,
      model: 'icon_d2',
    });

    expect(result.lcl[0].value).toBeNull();
    expect(result.temperatureChartData.temperatureData).toHaveLength(2);
    expect(result.rainCloudChartData.rainDots).toEqual([
      { time: new Date('2026-07-16T10:00:00Z'), rain: NaN },
      { time: new Date('2026-07-16T11:00:00Z'), rain: 1 },
    ]);
    expect(result.rainCloudChartData.cloudRects).toHaveLength(6);
    expect(result.rainCloudChartData.cloudRects[0].cloudCover).toBeNaN();
    expect(result.rainCloudChartData.cloudRects[0]).toMatchObject({
      x1: new Date('2026-07-16T09:30:00Z'),
      x2: new Date('2026-07-16T10:30:00Z'),
    });
    expect(result.windData).toEqual([]);
    expect(result.xDomain.every((date) => Number.isFinite(date.getTime()))).toBe(true);
  });

  it.each(['sunrise', 'sunset', 'both'] as const)(
    'keeps the full forecast when %s is absent in daylight-only mode',
    (event) => {
      const windChartData = createData();
      if (event !== 'sunset') windChartData.sunrise = null;
      if (event !== 'sunrise') windChartData.sunset = null;
      const result = prepareChartData({ windChartData, maxAltitude: 4000, model: 'icon_d2', daylightOnly: true });
      expect(result.temperatureChartData.temperatureData.map(({ time }) => time)).toEqual(windChartData.hourly.time);
      expect(result.temperatureChartData.sunrise).toEqual(windChartData.sunrise);
      expect(result.temperatureChartData.sunset).toEqual(windChartData.sunset);
      expect(result.xDomain.every((date) => Number.isFinite(+date))).toBe(true);
    }
  );

  it.each([
    ['normal', 6, 18, undefined, Array.from({ length: 15 }, (_, i) => i + 5)],
    ['midnight daylight', 18, 6, undefined, [0, 1, 2, 3, 4, 5, 6, 7, 17, 18, 19, 20, 21, 22, 23]],
    ['polar day', null, null, 'day', Array.from({ length: 24 }, (_, i) => i)],
    ['polar night', null, null, 'night', Array.from({ length: 24 }, (_, i) => i)],
  ] as const)(
    'filters %s using daylight intervals with one-hour padding',
    (_name, rise, set, polarDaylight, expected) => {
      const windChartData = createData();
      const hour = (value: number) => new Date(Date.parse('2026-07-16T00:00Z') + value * 3600000);
      windChartData.hourly.time = Array.from({ length: 24 }, (_, i) => hour(i));
      windChartData.hourly.temperature_2m = Float32Array.from({ length: 24 }, (_, i) => i);
      windChartData.sunrise = rise === null ? null : hour(rise);
      windChartData.sunset = set === null ? null : hour(set);
      windChartData.polarDaylight = polarDaylight;
      const full = prepareChartData({ windChartData, maxAltitude: 4000, model: 'icon_d2' });
      const filtered = prepareChartData({ windChartData, maxAltitude: 4000, model: 'icon_d2', daylightOnly: true });
      expect(filtered.temperatureChartData.temperatureData.map(({ value }) => value)).toEqual(expected);
      expect(filtered.temperatureChartData.daylightIntervals).toEqual(full.temperatureChartData.daylightIntervals);
      expect(filtered.temperatureChartData.sunrise).toEqual(windChartData.sunrise);
      expect(filtered.temperatureChartData.sunset).toEqual(windChartData.sunset);
    }
  );

  it('aligns the daylight domain with the first and last retained hourly cells', () => {
    const windChartData = createData();
    windChartData.sunrise = new Date('2026-07-16T10:23:00Z');
    windChartData.sunset = new Date('2026-07-16T10:37:00Z');

    const result = prepareChartData({
      windChartData,
      maxAltitude: 4000,
      model: 'icon_d2',
      daylightOnly: true,
    });

    expect(result.temperatureChartData.temperatureData.map((point) => point.time)).toEqual([
      new Date('2026-07-16T10:00:00Z'),
      new Date('2026-07-16T11:00:00Z'),
    ]);
    expect(result.xDomain).toEqual([new Date('2026-07-16T09:30:00Z'), new Date('2026-07-16T11:30:00Z')]);
    expect(result.rainCloudChartData.cloudRects.at(0)?.x1).toEqual(result.xDomain[0]);
    expect(result.rainCloudChartData.cloudRects.at(-1)?.x2).toEqual(result.xDomain[1]);
  });
});
