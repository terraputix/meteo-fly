import { getDaylightIntervals } from '#lib/meteo/daylight.js';
import { describe, expect, it, vi } from 'vitest';
import { CHART_COLORS } from '#lib/charts/chartColors.js';
import {
  buildWindChartLayout,
  DAYLIGHT_CONTEXT_TOP,
  RAIN_TOP,
  RAIN_HEIGHT_PX,
  type PreparedWindChart,
} from '#lib/charts/windChartLayout.js';
import { drawSmoothLine, renderWindChart } from '#lib/charts/windChartRenderer.js';

function createCanvasContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    setLineDash: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    fillRect: vi.fn(),
    fillText: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    arc: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn(() => ({ width: 30, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 2 })),
  };
}

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
      rainCloudChartData: { cloudRects: [], precipitation: [] },
    };
    const ctx = createCanvasContext();
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

describe('cloud panel precipitation', () => {
  it.each([800, 340])('pairs rain and snow and uses the cloud shading at a chart width of %i px', (width) => {
    const start = new Date('2026-07-16T00:00Z');
    const [rain, snow, mixed] = [9, 10, 11].map((hour) => new Date(+start + hour * 3600000));
    const data: PreparedWindChart = {
      cloudData: [],
      cloudRaster: null,
      windData: [],
      lcl: [],
      elevation: 0,
      modelGridElevation: undefined,
      timezone: 'UTC',
      xDomain: [start, new Date(+start + 24 * 3600000)],
      temperatureChartData: {
        temperatureData: [],
        dewpointData: [],
        humidityData: [],
        daylightIntervals: [],
        sunrise: null,
        sunset: null,
      },
      rainCloudChartData: {
        cloudRects: [
          { time: snow, y1: 0, y2: 1 / 3, cloudCover: 100 },
          { time: mixed, y1: 0, y2: 1 / 3, cloudCover: 60 },
          { time: mixed, y1: 1 / 3, y2: 2 / 3, cloudCover: 90 },
        ].map(({ time, ...band }) => ({
          x1: new Date(+time - 1800000),
          x2: new Date(+time + 1800000),
          ...band,
        })),
        precipitation: [
          { time: rain, rain: 1, snow: 0 },
          { time: snow, rain: 0, snow: 1 },
          { time: mixed, rain: 0.1, snow: 1.2 },
        ],
      },
    };
    const ctx = createCanvasContext();
    const snowflakeColors: string[] = [];
    ctx.fillText.mockImplementation((label) => {
      if (label === '❄︎') snowflakeColors.push(ctx.fillStyle);
    });
    const layout = buildWindChartLayout(data, width, 600, 4000, 'icon_d2');
    renderWindChart(ctx as unknown as CanvasRenderingContext2D, data, layout);

    const snowflakePositions = ctx.fillText.mock.calls.filter(([label]) => label === '❄︎');
    const pairScale = Math.min(1, layout.plotWidth / 24 / 30);
    const lowBandCenter = RAIN_TOP + (RAIN_HEIGHT_PX * 5) / 6;
    const midBandCenter = RAIN_TOP + RAIN_HEIGHT_PX / 2;
    expect(snowflakePositions).toEqual([
      ['❄︎', layout.x(+snow), lowBandCenter + 5],
      ['❄︎', expect.closeTo(layout.x(+mixed) + 7 * pairScale), expect.closeTo(lowBandCenter + 5 * pairScale)],
      ['❄︎', layout.x(+mixed), midBandCenter + 5],
    ]);
    expect(snowflakeColors).toEqual(['#fff', CHART_COLORS.snow, '#fff']);
    expect(ctx.translate.mock.calls).toEqual([
      [layout.x(+rain), lowBandCenter],
      [expect.closeTo(layout.x(+mixed) - 7 * pairScale), lowBandCenter],
    ]);
  });
});
