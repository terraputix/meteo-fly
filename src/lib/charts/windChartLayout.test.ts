import { describe, expect, it } from 'vitest';
import {
  buildWindChartLayout,
  curveControls,
  rainDropCount,
  temperatureRange,
  windRotation,
  TEMP_TOP,
  RAIN_TOP,
  WIND_TOP,
  WIND_ARROW_POINTS,
  type PreparedWindChart,
} from '#lib/charts/windChartLayout.js';
import { metersToHPaExact } from '#lib/meteo/pressureLevels.js';
import { windMarkerStrokeWidth, WIND_MARKER_OUTLINE_WIDTH, CALM_WIND_RADIUS } from '#lib/charts/scales.js';

const time = new Date('2026-07-16T10:00:00Z');
const data: PreparedWindChart = {
  cloudData: [],
  cloudRaster: null,
  temperatureChartData: {
    temperatureData: [{ time, value: 20 }],
    dewpointData: [{ time, value: 10 }],
    humidityData: [{ time, value: 60 }],
    sunrise: time,
    sunset: time,
  },
  rainCloudChartData: { cloudRects: [], rainDots: [] },
  windData: [],
  lcl: [],
  elevation: 500,
  modelGridElevation: undefined,
  timezone: 'UTC',
  timezoneAbbr: 'UTC',
  xDomain: [new Date(+time - 1800000), new Date(+time + 1800000)],
};

describe('wind chart layout', () => {
  it.each([0, 45, 90, 180, 270])('extends the pressure domain just enough for a top arrow at %i°', (direction) => {
    const pressure = metersToHPaExact(4000);
    const fixture = {
      ...data,
      windData: [{ time, pressure, height: 4000, speed: 80, direction, source: 'model' as const }],
    };
    const layout = buildWindChartLayout(fixture, 960, 700, 4000, 'icon_seamless');
    const rotation = windRotation(direction);
    const tip = Math.min(...WIND_ARROW_POINTS.map(([x, y]) => x * Math.sin(rotation) + y * Math.cos(rotation)));
    expect(layout.pressureY(pressure) + tip - (windMarkerStrokeWidth(80) + WIND_MARKER_OUTLINE_WIDTH) / 2).toBeCloseTo(
      WIND_TOP + 0.5
    );
    expect(layout.pressureAt(layout.pressureY(pressure))).toBeCloseTo(pressure);
    expect(layout.panels[2].top).toBe(WIND_TOP);
    expect(layout.x(+data.xDomain[0])).toBe(layout.left);
  });

  it('keeps the requested ceiling when the arrows already fit', () => {
    const fixture = {
      ...data,
      windData: [{ time, pressure: 850, height: 1500, speed: 80, direction: 0, source: 'model' as const }],
    };
    const layout = buildWindChartLayout(fixture, 960, 700, 4000, 'icon_seamless');
    expect(layout.pressureAt(WIND_TOP)).toBeCloseTo(metersToHPaExact(4000));
  });

  it('uses the smaller calm dot bounds when extending the ceiling', () => {
    const pressure = metersToHPaExact(4000);
    const fixture = {
      ...data,
      windData: [{ time, pressure, height: 4000, speed: 2, direction: 0, source: 'model' as const }],
    };
    const layout = buildWindChartLayout(fixture, 960, 700, 4000, 'icon_seamless');
    expect(layout.pressureY(pressure) - CALM_WIND_RADIUS - WIND_MARKER_OUTLINE_WIDTH / 2).toBeCloseTo(WIND_TOP + 0.5);
  });

  it('maps time and pressure reversibly with low pressure at the top', () => {
    const l = buildWindChartLayout(data, 960, 700, 4000, 'icon_seamless');
    expect(l.timeAt(l.x(+time))).toBe(+time);
    expect(l.pressureAt(l.pressureY(850))).toBeCloseTo(850);
    expect(l.pressureY(metersToHPaExact(4000))).toBe(WIND_TOP);
    expect(l.pressureY(metersToHPaExact(0))).toBe(658);
    expect(l.x(+data.xDomain[0])).toBe(l.left);
    expect(l.x(+data.xDomain[1])).toBe(l.right);
    expect(l.hitTest(l.x(+time), TEMP_TOP + 5)?.gridIndex).toBe(0);
    expect(l.hitTest(l.x(+time), RAIN_TOP + 5)?.gridIndex).toBe(1);
    expect(l.hitTest(l.x(+time), l.pressureY(850))).toMatchObject({
      gridIndex: 2,
      time: +time,
      hoveredWindPressure: 850,
    });
    expect(l.hitTest(l.left - 1, WIND_TOP)).toBeNull();
    expect(l.hitTest(l.right + 1, WIND_TOP)).toBeNull();
    expect(l.hitTest(l.left, RAIN_TOP - 1)).toBeNull();
    expect(l.hitTest(l.left, 699)).toBeNull();
    expect(buildWindChartLayout(data, 0, 700, 4000, 'icon_seamless').hitTest(56, WIND_TOP)).toBeNull();
  });

  it('provides finite temperature ranges for missing, negative and constant data', () => {
    expect(temperatureRange([NaN, Infinity])).toEqual([0, 5]);
    expect(temperatureRange([-7, 12, NaN])).toEqual([-10, 15]);
    expect(temperatureRange([10, 10])).toEqual([5, 15]);
  });

  it('reduces time labels at narrow widths without changing data coordinates', () => {
    const series = Array.from({ length: 24 }, (_, i) => ({ time: new Date(+time + i * 3600000), value: 20 }));
    const fixture = {
      ...data,
      temperatureChartData: { ...data.temperatureChartData, temperatureData: series },
      xDomain: [new Date(+time - 1800000), new Date(+time + 23.5 * 3600000)] as [Date, Date],
    };
    const narrow = buildWindChartLayout(fixture, 340, 700, 4000, 'icon_seamless');
    const wide = buildWindChartLayout(fixture, 960, 700, 4000, 'icon_seamless');
    expect(narrow.timeTicks.length).toBeLessThan(wide.timeTicks.length);
    expect(narrow.timeTicks.every((t) => t >= +fixture.xDomain[0] && t <= +fixture.xDomain[1])).toBe(true);
  });

  it('preserves rain thresholds and rejects missing rain', () => {
    expect([NaN, -1, 0, 0.1, 1, 1.1, 5, 5.1].map(rainDropCount)).toEqual([0, 0, 0, 1, 1, 2, 2, 3]);
  });

  it.each([
    [0, 0, 1],
    [90, -1, 0],
    [180, 0, -1],
    [270, 1, 0],
  ])('points wind from %s degrees toward the correct bearing', (direction, dx, dy) => {
    const rotation = windRotation(direction);
    expect(Math.sin(rotation)).toBeCloseTo(dx);
    expect(-Math.cos(rotation)).toBeCloseTo(dy);
  });

  it('keeps cubic controls within each segment even at sharp extrema', () => {
    const controls = curveControls([0, -100], [1, 10], [2, 12], [3, 100]);
    for (const [x, y] of controls) {
      expect(x).toBeGreaterThan(1);
      expect(x).toBeLessThan(2);
      expect(y).toBeGreaterThanOrEqual(10);
      expect(y).toBeLessThanOrEqual(12);
    }
  });
});
