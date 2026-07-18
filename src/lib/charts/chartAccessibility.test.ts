import { describe, expect, it } from 'vitest';
import { buildTooltipStore } from '$lib/charts/tooltipFormatter';
import {
  clampIndex,
  createSkewTLevelSelection,
  createWindChartSelection,
  findNearestIndex,
} from '$lib/charts/chartAccessibility';

describe('chart accessibility helpers', () => {
  it('clamps and finds chart selection indices', () => {
    expect(clampIndex(-2, 3)).toBe(0);
    expect(clampIndex(5, 3)).toBe(2);
    expect(findNearestIndex([500, 1000, 1500], 1200)).toBe(1);
  });

  it('builds a wind chart selection', () => {
    const time = new Date(2026, 6, 18, 10);
    const store = buildTooltipStore(
      {
        temperatureData: [{ time, value: 18.2 }],
        dewpointData: [{ time, value: 9.4 }],
        humidityData: [{ time, value: 56 }],
        sunrise: time,
        sunset: time,
      },
      {
        cloudRects: [],
        rainDots: [{ time, rain: 0.3 }],
      },
      [{ time, height: 1000, speed: 14.5, direction: 270, source: 'model' }],
      [{ time, value: 1600 }]
    );

    const selection = createWindChartSelection(store, 0, 0);

    expect(selection).toMatchObject({
      timeIndex: 0,
      heightIndex: 0,
      timestamp: time.getTime(),
      height: 1000,
    });
  });

  it('builds a Skew-T level selection', () => {
    const selection = createSkewTLevelSelection({
      pressure: 850,
      heightMeters: 1450,
      temperature: 8.4,
      dewpoint: 3.2,
      windSpeed: 20.5,
      windDirection: 225,
      cloudCover: 40,
      isInterpolated: false,
    });

    expect(selection).toMatchObject({
      pressure: 850,
      heightMeters: 1450,
      traceTemperature: 8.4,
      windSpeed: 20.5,
      windDirection: 225,
    });
  });
});
