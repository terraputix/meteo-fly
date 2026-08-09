import { describe, expect, it } from 'vitest';
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from 'echarts';
import { buildTooltipStore, createActiveState } from './tooltipFormatter';
import { buildWindChartOption, getWindChartHeight } from './buildWindChartOption';
import { metersToHPaExact } from '$lib/meteo/pressureLevels';

interface NamedSeries {
  name?: string;
  data?: unknown;
  markLine?: { data?: unknown };
}

interface RainSeriesItem {
  id: string;
  value: [number, number];
}

interface ValueAxis {
  min?: number;
  max?: number;
  inverse?: boolean;
}

describe('wind chart option', () => {
  it('renders LCL gaps and keeps rain identities stable', () => {
    const times: [Date, Date] = [new Date('2026-07-16T10:00:00Z'), new Date('2026-07-16T11:00:00Z')];
    const temperatureData = {
      temperatureData: times.map((time) => ({ time, value: NaN })),
      dewpointData: times.map((time, i) => ({ time, value: -7 + i })),
      humidityData: times.map((time) => ({ time, value: 60 })),
      sunrise: times[0],
      sunset: times[1],
    };
    const rainCloudData = {
      cloudRects: [
        {
          x1: new Date(times[0].getTime() - 1_800_000),
          x2: new Date(times[0].getTime() + 1_800_000),
          y1: 0,
          y2: 1 / 3,
          cloudCover: NaN,
        },
      ],
      rainDots: [{ time: times[1], rain: 1 }],
    };
    const lcl = [
      { time: times[0], value: null },
      { time: times[1], value: 1200 },
    ];
    const store = buildTooltipStore(temperatureData, rainCloudData, [], lcl);

    const option = buildWindChartOption(
      temperatureData,
      rainCloudData,
      [],
      [{ time: times[0], pressure: 1000, value: NaN }],
      lcl,
      500,
      'UTC',
      times,
      store,
      createActiveState()
    );
    const series = option.series as NamedSeries[];

    expect(series.find((item) => item.name === '__anchor_rain')?.markLine?.data).toEqual([
      [{ coord: [times[0].getTime(), 1] }, { coord: [times[1].getTime(), 1] }],
      [{ coord: [times[0].getTime(), 2] }, { coord: [times[1].getTime(), 2] }],
      [{ coord: [times[0].getTime(), 3] }, { coord: [times[1].getTime(), 3] }],
    ]);
    const lclData = series.find((item) => item.name === 'LCL')?.data as [number, number | null][];
    expect(lclData[0]).toEqual([times[0].getTime(), null]);
    expect(lclData[1][0]).toBe(times[1].getTime());
    expect(lclData[1][1]).toBeCloseTo(metersToHPaExact(1200));

    const windAxes = option.yAxis as ValueAxis[];
    expect(windAxes[3]).toMatchObject({ inverse: true });
    expect(windAxes[3].min).toBeCloseTo(metersToHPaExact(4000));
    expect(windAxes[3].max).toBeCloseTo(metersToHPaExact(0));
    expect(getWindChartHeight(10000)).toBe(749);

    const altitudeGridData = series.find((item) => item.name === '_altitudeGrid')?.markLine?.data as Array<{
      yAxis: number;
      label: { show: boolean; formatter: string };
    }>;
    expect(altitudeGridData.at(-1)).toMatchObject({
      yAxis: metersToHPaExact(4000),
      label: { show: false, formatter: '4000m' },
    });

    for (const seriesName of ['_cloudRects', '_windCloud']) {
      const cloudSeries = series.find((item) => item.name === seriesName) as NamedSeries & {
        renderItem: NonNullable<CustomSeriesOption['renderItem']>;
      };
      const renderedMissingCloud = cloudSeries.renderItem(
        { dataIndex: 0 } as CustomSeriesRenderItemParams,
        {} as CustomSeriesRenderItemAPI
      );

      expect(renderedMissingCloud).toEqual({ type: 'group', children: [] });
    }

    const fullRainCloudData = {
      cloudRects: [],
      rainDots: [
        { time: times[0], rain: 2 },
        { time: times[1], rain: 1 },
      ],
    };
    const fullOption = buildWindChartOption(
      temperatureData,
      fullRainCloudData,
      [],
      [],
      lcl,
      500,
      'UTC',
      times,
      buildTooltipStore(temperatureData, fullRainCloudData, [], lcl),
      createActiveState()
    );
    const filteredRain = series.find((item) => item.name === 'Rain')?.data as RainSeriesItem[];
    const fullRain = (fullOption.series as NamedSeries[]).find((item) => item.name === 'Rain')
      ?.data as RainSeriesItem[];

    expect(filteredRain).toEqual([{ id: times[1].getTime().toString(), value: [times[1].getTime(), 1] }]);
    expect(fullRain[1].id).toBe(filteredRain[0].id);

    const rainSeries = series.find((item) => item.name === 'Rain') as NamedSeries & {
      renderItem: NonNullable<CustomSeriesOption['renderItem']>;
    };
    const renderedMissingRain = rainSeries.renderItem(
      {} as CustomSeriesRenderItemParams,
      {
        value: (dimension: number | string) => (dimension === 0 ? times[0].getTime() : NaN),
      } as unknown as CustomSeriesRenderItemAPI
    );

    expect(renderedMissingRain).toMatchObject({
      type: 'group',
      $mergeChildren: false,
      children: [],
    });
  });
});
