import type {
  EChartsOption,
  SeriesOption,
  CustomSeriesOption,
  LineSeriesOption,
  TooltipComponentOption,
  GridComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';

import { windColorScale, strokeWidthScale } from '$lib/charts/scales';
import { CHART_COLORS } from '$lib/charts/chartColors';
import { makeAnchorSeries, makeLineSeries } from '$lib/charts/seriesFactories';
import { createTooltipFormatter, type TooltipStore, type ActiveState } from '$lib/charts/tooltipFormatter';
import type { TemperatureChartData, RainCloudChartData } from '$lib/workers/chartWorker.types';
import type { WindFieldLevel } from '$lib/charts/wind';
import type { CloudCoverData } from '$lib/charts/clouds';
import type { WeatherModel } from '$lib/api/types';
import { getNativeLevelsForModel } from '$lib/meteo/pressureLevels';
import { fmtTime } from '$lib/helpers';

// ─── Layout constants ────────────────────────────────────────────────────────
// All grids share the same left/right so x-axes align perfectly.
export const MARGIN_LEFT = 40;
export const MARGIN_RIGHT = 25;
export const TEMP_HEIGHT_PX = 130;
export const RAIN_HEIGHT_PX = 66;

export const TEMP_TOP = 10;
const TEMP_BOTTOM_PX = TEMP_TOP + TEMP_HEIGHT_PX;
const RAIN_GAP = 10;
export const RAIN_TOP = TEMP_BOTTOM_PX + RAIN_GAP;
const RAIN_BOTTOM_PX = RAIN_TOP + RAIN_HEIGHT_PX;
const WIND_GAP = 20;
export const WIND_TOP = RAIN_BOTTOM_PX + WIND_GAP;

export function getChartHeight(windHeight: number = 440) {
  return WIND_TOP + windHeight + 42;
}

export const TOTAL_HEIGHT = getChartHeight(440);

// ─── Pre-computed pressure-level band boundaries ─────────────────────────────
// For each pressure level at index i, the band it paints spans from the
// midpoint between level[i-1] and level[i] (or the chart floor for the first)
// to the midpoint between level[i] and level[i+1] (or the chart ceiling for
// the last).  These boundaries are in metres and stay constant across renders.
interface LevelBand {
  height: number; // centre altitude of this pressure level (metres)
  bandBottom: number; // lower altitude boundary of the band (metres)
  bandTop: number; // upper altitude boundary of the band (metres)
}

// Canonical arrow path
const MODEL_ARROW_PATH = 'M 0 7 L 0 -7 L 3.15 -1.54 L 0 -7 L -3.15 -1.54';

// ─── Shared x-axis factory ───────────────────────────────────────────────────
function makeXAxis(gridIndex: number, showLabels: boolean, xMin: number, xMax: number): XAXisComponentOption {
  return {
    type: 'time',
    gridIndex,
    min: xMin,
    max: xMax,
    axisLabel: showLabels ? { formatter: (v: number) => fmtTime(new Date(v)), fontSize: 11 } : { show: false },
    axisTick: { show: showLabels },
    axisLine: { show: true, lineStyle: { color: CHART_COLORS.axisLine } },
    splitLine: { show: false },
  };
}

// ─── Helper: map time-series data to [ms, value] tuples ─────────────────────

function toTimePairs(data: Array<{ time: Date; value: number }>): [number, number][] {
  return data.map((d) => [d.time.getTime(), d.value]);
}

// ─── Cloud cover render items ─────────────────────────────────────────────────
// Flat CloudCoverData[] is indexed directly; each point knows its time and
// height.  We convert time → ms once up front so renderItem is allocation-free.
interface CloudItem {
  timeMs: number;
  height: number;
  value: number; // 0–100 %
}

// ─── Main option builder ─────────────────────────────────────────────────────

export function buildWindChartOption(
  tempChartData: TemperatureChartData,
  rainCloudChartData: RainCloudChartData,
  windData: WindFieldLevel[],
  cloudData: CloudCoverData[],
  cloudBase: Array<{ time: Date; value: number }>,
  elevation: number,
  timezoneAbbr: string,
  xDomain: [Date, Date],
  store: TooltipStore,
  activeState: ActiveState,
  windHeight: number = 440,
  maxAltitude: number = 4350,
  model: WeatherModel = 'icon_d2'
): EChartsOption {
  // ── Model-specific level data ──────────────────────────────────────────────
  // nativeLevels drives cloud-band geometry and pressure labels.
  // bandByHeight is keyed by level height for O(1) lookup inside renderItem.
  const nativeLevels = getNativeLevelsForModel(model, maxAltitude);
  const cloudFloor = nativeLevels[0].heightMeters - 100;
  const cloudCeil = nativeLevels[nativeLevels.length - 1].heightMeters + 200;
  const bandByHeight = new Map<number, LevelBand>(
    nativeLevels.map((lv, i): [number, LevelBand] => {
      const prev = nativeLevels[i - 1];
      const next = nativeLevels[i + 1];
      return [
        lv.heightMeters,
        {
          height: lv.heightMeters,
          bandBottom: prev ? (prev.heightMeters + lv.heightMeters) / 2 : cloudFloor,
          bandTop: next ? (lv.heightMeters + next.heightMeters) / 2 : cloudCeil,
        },
      ];
    })
  );

  const xMin = xDomain[0].getTime();
  const xMax = xDomain[1].getTime();

  // ── Grids ──────────────────────────────────────────────────────────────────
  const grids: GridComponentOption[] = [
    { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: TEMP_TOP, height: TEMP_HEIGHT_PX },
    { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: RAIN_TOP, height: RAIN_HEIGHT_PX },
    { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: WIND_TOP, height: windHeight },
  ];

  // ── X axes ─────────────────────────────────────────────────────────────────
  const xAxes: XAXisComponentOption[] = [
    makeXAxis(0, false, xMin, xMax),
    makeXAxis(1, false, xMin, xMax),
    {
      ...makeXAxis(2, true, xMin, xMax),
      name: `Time [${timezoneAbbr}]`,
      nameLocation: 'middle',
      nameGap: 28,
    },
  ];

  // ── Y axes ─────────────────────────────────────────────────────────────────
  const WIND_Y_MIN = 0;
  const WIND_Y_MAX = maxAltitude;

  const yAxes: YAXisComponentOption[] = [
    // 0 – temperature left
    {
      type: 'value',
      gridIndex: 0,
      name: '°C',
      scale: true,
      nameGap: 0,
      offset: 10,
      nameLocation: 'end',
      nameTextStyle: { fontSize: 11 },
      minInterval: 5,
      interval: 5,
      alignTicks: true,
      axisLabel: { fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: CHART_COLORS.gridLine } },
    },
    // 1 – humidity right
    {
      type: 'value',
      gridIndex: 0,
      name: '%',
      nameGap: 0,
      offset: -5,
      nameLocation: 'end',
      nameTextStyle: { fontSize: 11 },
      min: 0,
      max: 100,
      interval: 25,
      position: 'right',
      axisLabel: { fontSize: 11 },
      splitLine: { show: false },
    },
    // 2 – rain/cloud hidden
    {
      type: 'value',
      gridIndex: 1,
      min: 0,
      max: 3,
      interval: 0.5,
      axisLabel: {
        show: true,
        fontSize: 10,
        color: '#999',
        margin: 10,
        formatter: (v: number) => {
          if (v === 0.5) return 'Low ☁️';
          if (v === 1.5) return 'Mid ☁️';
          if (v === 2.5) return 'High ☁️';
          return '';
        },
      },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { show: false },
    },
    // 3 – wind height left
    {
      type: 'value',
      gridIndex: 2,
      nameLocation: 'end',
      nameTextStyle: { fontSize: 11 },
      min: WIND_Y_MIN,
      max: WIND_Y_MAX,
      axisLine: { show: true, lineStyle: { color: CHART_COLORS.axisLine } },
      axisLabel: { formatter: (v: number) => `${v}m`, fontSize: 10 },
      splitLine: { show: true, lineStyle: { color: CHART_COLORS.gridLine } },
      interval: 500,
    },
    // 4 – wind height right (pressure labels via markLine, axis provides right border)
    {
      type: 'value',
      gridIndex: 2,
      position: 'right',
      min: WIND_Y_MIN,
      max: WIND_Y_MAX,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: true, lineStyle: { color: CHART_COLORS.axisLine } },
      splitLine: { show: false },
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // GRID 0 – Temperature / Dewpoint / Humidity
  // ═══════════════════════════════════════════════════════════════════════════

  const sunriseMarkData: [object, object][] = [
    [
      { xAxis: tempChartData.sunrise.getTime(), itemStyle: { color: CHART_COLORS.sunriseFill } },
      { xAxis: tempChartData.sunset.getTime() },
    ],
  ];

  const tempTimePairs = toTimePairs(tempChartData.temperatureData);

  const tempAnchorSeries = makeAnchorSeries('__anchor_temp', 0, 0, tempTimePairs);

  const tempSeries = makeLineSeries({
    name: 'Temperature',
    xAxisIndex: 0,
    yAxisIndex: 0,
    color: CHART_COLORS.temperature,
    data: tempTimePairs,
    markArea: { silent: true, data: sunriseMarkData },
  });

  const dewpointSeries = makeLineSeries({
    name: 'Dewpoint',
    xAxisIndex: 0,
    yAxisIndex: 0,
    color: CHART_COLORS.dewpoint,
    data: toTimePairs(tempChartData.dewpointData),
  });

  const humiditySeries = makeLineSeries({
    name: 'Humidity',
    xAxisIndex: 0,
    yAxisIndex: 1,
    color: CHART_COLORS.humidity,
    lineType: 'dashed',
    data: toTimePairs(tempChartData.humidityData),
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GRID 1 – Rain / Cloud cover bands
  // ═══════════════════════════════════════════════════════════════════════════

  const rainAnchorSeries = makeAnchorSeries(
    '__anchor_rain',
    1,
    2,
    rainCloudChartData.cloudRects
      .filter((r) => r.y1 === 0)
      .map((r) => [r.x1.getTime() + 1_800_000, 1.5] as [number, number])
  );

  rainAnchorSeries.markLine = {
    silent: true,
    symbol: 'none',
    label: { show: false },
    lineStyle: {
      color: CHART_COLORS.gridLine,
      type: 'solid',
      width: 1,
    },
    data: [
      { yAxis: 1 }, // Line between Low and Mid
      { yAxis: 2 }, // Line between Mid and High
      { yAxis: 3 }, // Line between Mid and High
    ],
  };

  const cloudItems = rainCloudChartData.cloudRects.map((r) => ({
    x1: r.x1.getTime(),
    x2: r.x2.getTime(),
    y1: r.y1,
    y2: r.y2,
    cloudCover: r.cloudCover,
  }));

  const cloudRectSeries: CustomSeriesOption = {
    name: '_cloudRects',
    type: 'custom',
    xAxisIndex: 1,
    yAxisIndex: 2,
    silent: true,
    renderItem(params, api) {
      const item = cloudItems[params.dataIndex];
      const p1 = api.coord([item.x1, item.y2 * 3]);
      const p2 = api.coord([item.x2, item.y1 * 3]);
      const w = Math.max(0, p2[0] - p1[0]);
      const h = Math.max(0, p2[1] - p1[1]);
      if (w === 0 || h === 0) return { type: 'group', children: [] };
      return {
        type: 'rect',
        shape: { x: p1[0], y: p1[1], width: w, height: h },
        style: {
          fill: `${CHART_COLORS.cloudRect},${(item.cloudCover / 100).toFixed(3)})`,
          stroke: 'none',
        },
      };
    },
    data: cloudItems.map((_, i) => i),
    z: 1,
    tooltip: { show: false },
  };

  type RainDot = { timeMs: number; rain: number };
  const rainDots: RainDot[] = rainCloudChartData.rainDots.map((d) => ({
    timeMs: d.time.getTime(),
    rain: d.rain,
  }));

  function rainDropCount(rain: number): number {
    if (rain > 5) return 3;
    if (rain > 1) return 2;
    return 1;
  }

  const DROP_W = 8;
  const DROP_H = 12;
  const DROP_PATH = 'M 0 -7 C 3.5 -3.5 5 0.5 5 3 A 5 5 0 0 1 -5 3 C -5 0.5 -3.5 -3.5 0 -7 Z';

  const rainSeries: CustomSeriesOption = {
    name: 'Rain',
    type: 'custom',
    xAxisIndex: 1,
    yAxisIndex: 2,
    z: 3,
    tooltip: { show: false },
    silent: true,
    renderItem(params, api) {
      const dot = rainDots[params.dataIndex];
      const count = rainDropCount(dot.rain);

      const drops = Array.from({ length: count }, (_, i) => {
        const [cx, cy] = api.coord([dot.timeMs, i + 0.5]);
        return {
          type: 'path' as const,
          shape: { pathData: DROP_PATH, x: cx - DROP_W / 2, y: cy - DROP_H / 2, width: DROP_W, height: DROP_H },
          style: { fill: CHART_COLORS.rain },
        };
      });

      return { type: 'group', children: drops };
    },
    data: rainDots.map((_, i) => i),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // GRID 2 – Wind field / cloud raster
  // ═══════════════════════════════════════════════════════════════════════════

  const windAnchorSeries = makeAnchorSeries(
    '__anchor_wind',
    2,
    3,
    tempChartData.temperatureData.map((d) => [d.time.getTime(), WIND_Y_MIN] as [number, number])
  );

  // ── Cloud cover rectangles ─────────────────────────────────────────────────
  // Each CloudCoverData point maps to exactly one rect in the wind grid whose
  // horizontal extent spans ±30 min around the observation time and whose
  // vertical extent covers the midpoint band around that pressure level.
  // api.coord() is called inside renderItem so ECharts handles all axis-to-pixel
  // conversion correctly regardless of zoom or resize.
  const HALF_WIDTH_MS = 1_800_000; // 30 minutes

  const cloudItems2: CloudItem[] = cloudData.map((d) => ({
    timeMs: d.time.getTime(),
    height: d.height,
    value: d.value,
  }));

  const windCloudSeries: CustomSeriesOption = {
    name: '_windCloud',
    type: 'custom',
    xAxisIndex: 2,
    yAxisIndex: 3,
    silent: true,
    renderItem(params, api) {
      const item = cloudItems2[params.dataIndex];
      if (item.value <= 0) return { type: 'group', children: [] };

      const band = bandByHeight.get(item.height);
      if (!band) return { type: 'group', children: [] };

      // Horizontal: pixel coords of the ±30 min window around this timestamp.
      const xLeft = api.coord([item.timeMs - HALF_WIDTH_MS, band.bandBottom])[0];
      const xRight = api.coord([item.timeMs + HALF_WIDTH_MS, band.bandBottom])[0];
      const w = Math.max(1, xRight - xLeft);

      // Vertical: pixel coords of the band boundaries.
      // Higher altitude → smaller canvas-y, so yTop < yBottom in pixel space.
      const yBottom = api.coord([item.timeMs, band.bandBottom])[1];
      const yTop = api.coord([item.timeMs, band.bandTop])[1];
      const h = Math.max(1, yBottom - yTop);

      const alpha = (0.85 * item.value) / 100;

      return {
        type: 'rect',
        // Expand 1 px horizontally to close any sub-pixel gap between columns.
        shape: { x: xLeft - 0.5, y: yTop, width: w + 1, height: h },
        style: {
          fill: `${CHART_COLORS.windCloud},${alpha.toFixed(3)})`,
          stroke: 'none',
        },
      };
    },
    data: cloudItems2.map((_, i) => i),
    z: 1,
    tooltip: { show: false },
  };

  // Each arrow is a single path element rotated into the wind direction via the
  // element-level `rotation` transform.
  type WindItem = { time: number; height: number; speed: number; direction: number; interpolated: boolean };
  const windItems: WindItem[] = windData.map((w) => ({
    time: w.time.getTime(),
    height: w.height,
    speed: w.speed,
    direction: w.direction,
    interpolated: w.source === 'interpolated',
  }));

  const windArrowSeries: CustomSeriesOption = {
    name: '_windArrows',
    type: 'custom',
    xAxisIndex: 2,
    yAxisIndex: 3,
    silent: true,
    renderItem(params, api) {
      const item = windItems[params.dataIndex];
      const [cx, cy] = api.coord([item.time, item.height]);
      // Rotate canonical up-pointing path to match wind direction.
      // direction is meteorological (where wind comes FROM), so subtract 180°
      // to get the "going-to" bearing, which is what the arrowhead should show.
      const rotation = (((item.direction - 180) * Math.PI) / 180) * -1;

      return {
        type: 'path',
        shape: { pathData: MODEL_ARROW_PATH },
        style: {
          stroke: windColorScale(item.speed),
          lineWidth: strokeWidthScale(item.speed),
          lineCap: 'round' as const,
          lineJoin: 'round' as const,
          fill: 'none',
          opacity: item.interpolated ? 0.4 : 1.0,
        },
        x: cx,
        y: cy,
        rotation,
      };
    },
    data: windItems.map((_, i) => i),
    z: 3,
    tooltip: { show: false },
  };

  const cloudBaseSeries = makeLineSeries({
    name: 'Cloud Base',
    xAxisIndex: 2,
    yAxisIndex: 3,
    color: CHART_COLORS.cloudBase,
    data: cloudBase.map((d) => [d.time.getTime(), d.value] as [number, number]),
    z: 4,
  });

  const elevationLineSeries: LineSeriesOption = {
    name: '_elevation',
    type: 'line',
    xAxisIndex: 2,
    yAxisIndex: 3,
    silent: true,
    symbol: 'none',
    lineStyle: { opacity: 0 },
    data: [],
    markLine: {
      silent: true,
      symbol: 'none',
      data: [{ yAxis: elevation }],
      lineStyle: { color: CHART_COLORS.elevation, width: 2, type: 'dashed' },
      label: {
        show: true,
        position: 'insideStartTop',
        formatter: `Elevation (${elevation}m)`,
        color: CHART_COLORS.elevation,
        fontWeight: 'bold',
        fontSize: 10,
      },
    },
    z: 5,
    tooltip: { show: false },
  };

  // ── Pressure-level markLines (right-side hPa labels) ──────────────────────
  // Only draw lines for pressure levels that come directly from the weather model.
  const heightToHpa = new Map<number, number>(nativeLevels.map((l) => [l.heightMeters, l.hPa]));

  const pressureLabelSeries: LineSeriesOption = {
    name: '_pressureLabels',
    type: 'line',
    xAxisIndex: 2,
    yAxisIndex: 3,
    silent: true,
    symbol: 'none',
    lineStyle: { opacity: 0 },
    data: [],
    markLine: {
      silent: true,
      symbol: 'none',
      animation: false,
      lineStyle: { color: 'rgba(160,160,160,0.35)', type: 'dashed', width: 0.8 },
      label: {
        show: true,
        position: 'insideEndTop',
        formatter: (params: unknown) => {
          const p = params as { value?: unknown };
          const hPa = heightToHpa.get(Number(p.value));
          return hPa != null ? `${hPa}hPa` : '';
        },
        color: '#888',
        fontSize: 9,
        padding: [1, 3],
      },
      data: nativeLevels.map((l) => ({ yAxis: l.heightMeters })),
    },
    z: 2,
    tooltip: { show: false },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Unified tooltip formatter
  // ═══════════════════════════════════════════════════════════════════════════

  const tooltipFormatter = createTooltipFormatter(store, activeState);

  // ═══════════════════════════════════════════════════════════════════════════
  // Assemble
  // ═══════════════════════════════════════════════════════════════════════════

  const allSeries: SeriesOption[] = [
    // Grid 0
    tempAnchorSeries,
    tempSeries,
    dewpointSeries,
    humiditySeries,
    // Grid 1
    rainAnchorSeries,
    cloudRectSeries,
    rainSeries,
    // Grid 2 – cloud rects z=1, arrows z=3, lines above
    windAnchorSeries,
    windCloudSeries,
    windArrowSeries,
    cloudBaseSeries,
    elevationLineSeries,
    pressureLabelSeries,
  ];

  return {
    animation: false,
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    axisPointer: {
      link: [{ xAxisIndex: [0, 1, 2] }],
      lineStyle: { color: '#999', type: 'dashed', width: 1 },
      label: {
        fontSize: 0,
        backgroundColor: 'transparent',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: tooltipFormatter as TooltipComponentOption['formatter'],
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: { fontSize: 12, color: '#333' },
      extraCssText: 'box-shadow:0 2px 10px rgba(0,0,0,0.14);max-width:260px;overflow-y:auto;max-height:80vh;',
      confine: true,
    },
    series: allSeries,
  };
}
