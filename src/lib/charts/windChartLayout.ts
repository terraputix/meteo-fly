import type { MaxAltitude } from '#lib/meteo/types.js';
import type { WeatherModel } from '#lib/api/types.js';
import type { ChartWorkerSuccessOutput } from '#lib/workers/chartWorker.types.js';
import { getNativeLevelsForFetch, getNativeLevelsForModel, metersToHPaExact } from '#lib/meteo/pressureLevels.js';

export const MARGIN_LEFT = 56;
export const MARGIN_RIGHT = 25;
export const TEMP_HEIGHT_PX = 130;
export const RAIN_HEIGHT_PX = 66;

export const TEMP_TOP = 10;
const TEMP_BOTTOM_PX = TEMP_TOP + TEMP_HEIGHT_PX;
const RAIN_GAP = 32;
export const DAYLIGHT_CONTEXT_TOP = TEMP_BOTTOM_PX;
export const RAIN_TOP = TEMP_BOTTOM_PX + RAIN_GAP;
const RAIN_BOTTOM_PX = RAIN_TOP + RAIN_HEIGHT_PX;
const WIND_GAP = 20;
export const WIND_TOP = RAIN_BOTTOM_PX + WIND_GAP;

const SEA_LEVEL_PRESSURE_HPA = metersToHPaExact(0);
export const WIND_REFERENCE_ALTITUDE = 4000;
const WIND_REFERENCE_HEIGHT = Math.ceil(SEA_LEVEL_PRESSURE_HPA - metersToHPaExact(WIND_REFERENCE_ALTITUDE));

export function getWindChartHeight(maxAltitude: MaxAltitude = 4000): number {
  return Math.ceil((WIND_REFERENCE_HEIGHT * maxAltitude) / WIND_REFERENCE_ALTITUDE);
}

export function getChartHeight(windHeight: number = getWindChartHeight()) {
  return WIND_TOP + windHeight + 42;
}

export type PreparedWindChart = ChartWorkerSuccessOutput['data'];
export type ChartPanel = 0 | 1 | 2;
export interface PanelBounds {
  top: number;
  height: number;
}

export function temperatureRange(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 5];
  const min = Math.floor(Math.min(...finite) / 5) * 5;
  const max = Math.ceil(Math.max(...finite) / 5) * 5;
  return min === max ? [min - 5, max + 5] : [min, max];
}

export function rainDropCount(rain: number): number {
  return !Number.isFinite(rain) || rain <= 0 ? 0 : rain > 5 ? 3 : rain > 1 ? 2 : 1;
}

// Canvas rotates clockwise; meteorological directions describe where wind comes from.
export function windRotation(direction: number): number {
  return ((direction - 180) * Math.PI) / 180;
}

export function buildWindChartLayout(
  data: PreparedWindChart,
  width: number,
  height: number,
  maxAltitude: MaxAltitude,
  model: WeatherModel
) {
  const left = MARGIN_LEFT;
  const right = Math.max(left, width - MARGIN_RIGHT);
  const plotWidth = right - left;
  const panels: PanelBounds[] = [
    { top: TEMP_TOP, height: TEMP_HEIGHT_PX },
    { top: RAIN_TOP, height: RAIN_HEIGHT_PX },
    { top: WIND_TOP, height: Math.max(1, height - getChartHeight(0)) },
  ];
  const [tMin, tMax] = data.xDomain.map(Number);
  const duration = Math.max(1, tMax - tMin);
  const pressureTop = metersToHPaExact(maxAltitude);
  const pressureBottom = SEA_LEVEL_PRESSURE_HPA;
  const [tempMin, tempMax] = temperatureRange(
    [...data.temperatureChartData.temperatureData, ...data.temperatureChartData.dewpointData].map((d) => d.value)
  );
  const x = (time: number) => left + ((time - tMin) / duration) * plotWidth;
  const timeAt = (px: number) => tMin + ((px - left) / Math.max(1, plotWidth)) * duration;
  const pressureY = (pressure: number) =>
    WIND_TOP + ((pressure - pressureTop) / (pressureBottom - pressureTop)) * panels[2].height;
  const pressureAt = (py: number) =>
    pressureTop + ((py - WIND_TOP) / panels[2].height) * (pressureBottom - pressureTop);
  const temperatureY = (value: number) => TEMP_TOP + ((tempMax - value) / (tempMax - tempMin)) * TEMP_HEIGHT_PX;
  const humidityY = (value: number) => TEMP_TOP + (1 - value / 100) * TEMP_HEIGHT_PX;
  const lclPoints: ChartPoint[] = data.lcl.map((point) => [
    x(+point.time),
    point.value == null ? NaN : pressureY(metersToHPaExact(point.value)),
  ]);
  const nativeLevels = getNativeLevelsForModel(model, maxAltitude);
  const fetched = getNativeLevelsForFetch(model, maxAltitude);
  const bands = new Map(
    nativeLevels.map((level) => {
      const i = fetched.findIndex((item) => item.hPa === level.hPa);
      const prev = fetched[i - 1];
      const next = fetched[i + 1];
      return [
        level.hPa,
        {
          bottom: Math.min(
            pressureBottom,
            prev ? (prev.hPa + level.hPa) / 2 : next ? level.hPa + (level.hPa - next.hPa) / 2 : pressureBottom
          ),
          top: Math.max(pressureTop, next ? (level.hPa + next.hPa) / 2 : pressureTop),
        },
      ];
    })
  );
  const times = data.temperatureChartData.temperatureData.map((d) => +d.time).filter(Number.isFinite);
  const labelStep = Math.max(1, Math.ceil(times.length / Math.max(1, Math.floor(plotWidth / 65))));
  const timeTicks = times.filter((_, i) => i % labelStep === 0);
  const hitTest = (px: number, py: number) => {
    if (plotWidth <= 0 || px < left || px > right) return null;
    const panel = panels.findIndex((p) => py >= p.top && py <= p.top + p.height);
    return panel < 0
      ? null
      : { gridIndex: panel as ChartPanel, time: timeAt(px), hoveredWindPressure: panel === 2 ? pressureAt(py) : null };
  };
  return {
    width,
    height,
    left,
    right,
    plotWidth,
    panels,
    tempMin,
    tempMax,
    maxAltitude,
    nativeLevels,
    bands,
    timeTicks,
    x,
    timeAt,
    pressureY,
    pressureAt,
    temperatureY,
    humidityY,
    lclPoints,
    lclYAt: (px: number) => smoothLineYAt(lclPoints, px),
    hitTest,
  };
}
export type WindChartLayout = ReturnType<typeof buildWindChartLayout>;

export type ChartPoint = [number, number];
export function smoothLineYAt(points: ChartPoint[], x: number): number | null {
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (!start.every(Number.isFinite) || !end.every(Number.isFinite) || x < start[0] || x > end[0]) continue;
    if (end[0] <= start[0]) continue;
    const previous = points[i - 1];
    const next = points[i + 2];
    const [a, b] = curveControls(
      previous?.every(Number.isFinite) ? previous : start,
      start,
      end,
      next?.every(Number.isFinite) ? next : end
    );
    const t = (x - start[0]) / (end[0] - start[0]);
    const u = 1 - t;
    return u ** 3 * start[1] + 3 * u ** 2 * t * a[1] + 3 * u * t ** 2 * b[1] + t ** 3 * end[1];
  }
  return null;
}

export function curveControls(
  previous: ChartPoint,
  start: ChartPoint,
  end: ChartPoint,
  next: ChartPoint
): [ChartPoint, ChartPoint] {
  const clamp = (y: number) => Math.max(Math.min(start[1], end[1]), Math.min(Math.max(start[1], end[1]), y));
  const dx = (end[0] - start[0]) / 3;
  const slope = (a: ChartPoint, b: ChartPoint) => (b[0] === a[0] ? 0 : (b[1] - a[1]) / (b[0] - a[0]));
  return [
    [start[0] + dx, clamp(start[1] + slope(previous, end) * dx)],
    [end[0] - dx, clamp(end[1] - slope(start, next) * dx)],
  ];
}
