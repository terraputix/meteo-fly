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

  it('prepares one nearby-precipitation 5×5 glyph per hour', () => {
    const windChartData = createData();
    windChartData.rainSpot = {
      time: windChartData.hourly.time,
      gridSize: 5,
      radiusKm: 20,
      cells: [
        {
          row: 0,
          column: 0,
          latitude: 47.1,
          longitude: 7.9,
          precipitation: new Float32Array([0.1, 0.2]),
        },
        {
          row: 2,
          column: 2,
          latitude: 47,
          longitude: 8,
          precipitation: new Float32Array([1, 2]),
        },
      ],
    };

    const result = prepareChartData({
      windChartData,
      maxAltitude: 4000,
      model: 'icon_d2',
    });

    expect(result.rainSpotChartData).toMatchObject({ gridSize: 5, radiusKm: 20 });
    expect(result.rainSpotChartData.glyphs).toHaveLength(2);
    expect(result.rainSpotChartData.glyphs[0]).toMatchObject({ maximum: 1, wetCellCount: 2 });
    expect(result.rainSpotChartData.glyphs[0].precipitation[0]).toBeCloseTo(0.1);
    expect(result.rainSpotChartData.glyphs[0].precipitation[12]).toBe(1);
    expect(result.rainSpotChartData.glyphs[0].precipitation[1]).toBeNaN();
    expect(result.rainSpotChartData.glyphs[1]).toMatchObject({ maximum: 2, wetCellCount: 2 });
  });
});
