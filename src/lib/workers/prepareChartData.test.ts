import { describe, expect, it } from 'vitest';
import type { WindChartData } from '$lib/api/types';
import { prepareChartData } from './prepareChartData';

function createData(): WindChartData {
  return {
    elevation: 500,
    timezoneAbbr: 'UTC',
    sunrise: new Date('2026-07-16T04:00:00Z'),
    sunset: new Date('2026-07-16T20:00:00Z'),
    selectedGridCell: null,
    hourly: {
      time: [new Date('2026-07-16T10:00:00Z'), new Date('2026-07-16T11:00:00Z')],
      temperature_2m: new Float32Array([20, 21]),
      dewpoint_2m: new Float32Array([NaN, 15]),
      precipitation: new Float32Array([0, 1]),
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
    expect(result.rainCloudChartData.rainDots).toEqual([{ time: new Date('2026-07-16T11:00:00Z'), rain: 1 }]);
    expect(result.rainCloudChartData.cloudRects).toHaveLength(6);
    expect(result.rainCloudChartData.cloudRects[0].cloudCover).toBeNaN();
    expect(result.windData).toEqual([]);
    expect(result.xDomain.every((date) => Number.isFinite(date.getTime()))).toBe(true);
  });
});
