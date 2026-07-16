import { describe, expect, it } from 'vitest';
import { buildTooltipStore, createActiveState } from './tooltipFormatter';
import { buildWindChartOption } from './buildWindChartOption';

interface NamedSeries {
  name?: string;
  data?: unknown;
}

interface RainSeriesItem {
  id: string;
  value: [number, number];
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
      cloudRects: [],
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
      [],
      lcl,
      500,
      'UTC',
      times,
      store,
      createActiveState()
    );
    const series = option.series as NamedSeries[];

    expect(series.find((item) => item.name === 'LCL')).toMatchObject({
      data: [
        [times[0].getTime(), null],
        [times[1].getTime(), 1200],
      ],
    });

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
  });
});
