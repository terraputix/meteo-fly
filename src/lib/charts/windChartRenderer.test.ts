import { getDaylightIntervals } from '#lib/meteo/daylight.js';
import { describe, expect, it, vi } from 'vitest';
import { buildWindChartLayout, DAYLIGHT_CONTEXT_TOP, type PreparedWindChart } from '#lib/charts/windChartLayout.js';
import { drawSmoothLine, renderWindChart } from '#lib/charts/windChartRenderer.js';

describe('canvas curve drawing', () => {
  it('starts a new path after missing samples instead of bridging LCL or temperature gaps', () => {
    const ctx = { beginPath: vi.fn(), setLineDash: vi.fn(), moveTo: vi.fn(), bezierCurveTo: vi.fn(), stroke: vi.fn() };
    drawSmoothLine(
      ctx as unknown as CanvasRenderingContext2D,
      [
        [0, 10],
        [1, 20],
        [2, NaN],
        [3, 15],
        [4, 10],
      ],
      '#000'
    );
    expect(ctx.moveTo.mock.calls).toEqual([
      [0, 10],
      [3, 15],
    ]);
    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(2);
    expect(ctx.bezierCurveTo.mock.calls[0].slice(-2)).toEqual([1, 20]);
    expect(ctx.bezierCurveTo.mock.calls[1].slice(-2)).toEqual([4, 10]);
  });

  it('does not issue invalid coordinates for entirely missing data', () => {
    const ctx = { beginPath: vi.fn(), setLineDash: vi.fn(), moveTo: vi.fn(), bezierCurveTo: vi.fn(), stroke: vi.fn() };
    drawSmoothLine(
      ctx as unknown as CanvasRenderingContext2D,
      [
        [0, NaN],
        [1, Infinity],
      ],
      '#000'
    );
    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(ctx.bezierCurveTo).not.toHaveBeenCalled();
  });
});

describe('solar annotations', () => {
  it.each([
    ['polar day', '2026-06-21', false],
    ['polar night', '2026-12-21', false],
    ['normal day', '2026-07-16', true],
    ['sunset before sunrise', '2026-07-16', true],
  ])('renders the appropriate markers and time labels for a %s', (_name, date, hasEvents) => {
    const time = new Date(`${date}T12:00Z`);
    const wrapped = _name === 'sunset before sunrise';
    const sunrise = hasEvents ? new Date(`${date}T${wrapped ? '18' : '06'}:00Z`) : null;
    const sunset = hasEvents ? new Date(`${date}T${wrapped ? '06' : '18'}:00Z`) : null;
    const daylightIntervals = getDaylightIntervals(time, {
      timezone: 'UTC',
      sunrise,
      sunset,
      polarDaylight: _name === 'polar day' ? 'day' : _name === 'polar night' ? 'night' : undefined,
    });
    const data: PreparedWindChart = {
      cloudData: [],
      cloudRaster: null,
      windData: [],
      lcl: [],
      elevation: 0,
      modelGridElevation: undefined,
      timezone: 'UTC',
      xDomain: [new Date(`${date}T00:00Z`), new Date(`${date}T23:00Z`)],
      temperatureChartData: {
        temperatureData: [{ time, value: 10 }],
        dewpointData: [],
        humidityData: [],
        daylightIntervals,
        sunrise,
        sunset,
      },
      rainCloudChartData: { cloudRects: [], rainDots: [] },
    };
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      setLineDash: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      arc: vi.fn(),
      measureText: vi.fn(() => ({ width: 30 })),
    };
    const layout = buildWindChartLayout(data, 800, 600, 4000, 'icon_d2');
    renderWindChart(ctx as unknown as CanvasRenderingContext2D, data, layout);
    const labels = ctx.fillText.mock.calls.filter(([, , y]) => y === DAYLIGHT_CONTEXT_TOP + 19);
    expect(labels.map(([label]) => label)).toEqual(
      hasEvents ? (wrapped ? ['18:00', '06:00'] : ['06:00', '18:00']) : []
    );
    expect(ctx.arc).toHaveBeenCalledTimes(hasEvents ? 2 : 0);
    const shaded = ctx.fillRect.mock.calls.filter(([, y, , height]) => y === 10 && height === 130);
    const expected = wrapped
      ? [
          [0, 6],
          [18, 24],
        ]
      : hasEvents
        ? [[6, 18]]
        : _name === 'polar day'
          ? [[0, 24]]
          : [];
    expect(shaded).toEqual(
      expected.map(([start, end]) => {
        const from = layout.x(Date.parse(`${date}T00:00Z`) + start * 3600000);
        const to = layout.x(Date.parse(`${date}T00:00Z`) + end * 3600000);
        return [from, 10, to - from, 130];
      })
    );
  });
});
