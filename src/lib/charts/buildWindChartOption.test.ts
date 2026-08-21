import { describe, expect, it } from 'vitest';
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from 'echarts';
import { buildTooltipStore, createActiveState } from './tooltipFormatter';
import {
  buildWindChartOption,
  getWindChartHeight,
  RAIN_SPOT_TOP,
  RAIN_TOP,
  TEMP_HEIGHT_PX,
  TEMP_TOP,
} from './buildWindChartOption';
import { metersToHPaExact } from '$lib/meteo/pressureLevels';
import { fmtTime } from '$lib/helpers';

interface NamedSeries {
  name?: string;
  data?: unknown;
  markLine?: { data?: unknown };
  xAxisIndex?: number;
  yAxisIndex?: number;
  markPoint?: { data?: unknown; symbolSize?: unknown };
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
    expect(RAIN_SPOT_TOP).toBeLessThan(RAIN_TOP);
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
      'UTC',
      times,
      store,
      createActiveState()
    );
    const series = option.series as NamedSeries[];

    const daylightMarkers = series.find((item) => item.name === '__anchor_temp')?.markPoint;
    expect(daylightMarkers?.symbolSize).toEqual([13, 13]);
    expect(daylightMarkers?.data).toMatchObject([
      {
        name: 'Sunrise',
        xAxis: times[0].getTime(),
        y: TEMP_TOP + TEMP_HEIGHT_PX + 24,
        symbolOffset: [-7, -9],
        label: { position: 'right', offset: [0, 2], formatter: fmtTime(times[0], 'UTC') },
      },
      {
        name: 'Sunset',
        xAxis: times[1].getTime(),
        y: TEMP_TOP + TEMP_HEIGHT_PX + 24,
        symbolOffset: [7, -9],
        label: { position: 'left', offset: [0, 2], formatter: fmtTime(times[1], 'UTC') },
      },
    ]);

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
    expect(windAxes[4]).toMatchObject({ inverse: true });
    expect(windAxes[4].min).toBeCloseTo(metersToHPaExact(4000));
    expect(windAxes[4].max).toBeCloseTo(metersToHPaExact(0));
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

    const rainSpotPrecipitation = new Float32Array(25);
    rainSpotPrecipitation[12] = 2;
    const rainSpotData = {
      gridSize: 5,
      radiusKm: 20,
      glyphs: [
        {
          time: times[0],
          x1: new Date(times[0].getTime() - 1_800_000),
          x2: new Date(times[0].getTime() + 1_800_000),
          precipitation: rainSpotPrecipitation,
          maximum: 2,
          wetCellCount: 1,
        },
      ],
    };
    const rainSpotOption = buildWindChartOption(
      temperatureData,
      fullRainCloudData,
      [],
      [],
      lcl,
      500,
      'UTC',
      'UTC',
      times,
      buildTooltipStore(temperatureData, fullRainCloudData, [], lcl, rainSpotData),
      createActiveState(),
      getWindChartHeight(),
      4000,
      'icon_d2',
      undefined,
      rainSpotData
    );
    const rainSpotSeries = (rainSpotOption.series as NamedSeries[]).find(
      (item) => item.name === 'Nearby rain'
    ) as NamedSeries & { renderItem: NonNullable<CustomSeriesOption['renderItem']> };
    const renderedRainSpot = rainSpotSeries.renderItem(
      { dataIndex: 0 } as CustomSeriesRenderItemParams,
      {
        coord: ([time, value]: [number, number]) => [(time - times[0].getTime()) / 60_000, value * 20],
      } as unknown as CustomSeriesRenderItemAPI
    );

    expect((renderedRainSpot as { children: unknown[] }).children).toHaveLength(25);
    expect(rainSpotSeries).toMatchObject({ xAxisIndex: 2, yAxisIndex: 3 });
    expect((rainSpotOption.series as NamedSeries[]).find((item) => item.name === 'Rain')).toMatchObject({
      xAxisIndex: 1,
      yAxisIndex: 2,
    });
    expect(rainSpotOption.grid).toHaveLength(4);
  });
});
