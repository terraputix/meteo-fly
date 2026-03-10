import type {
  EChartsOption,
  SeriesOption,
  CustomSeriesOption,
  LineSeriesOption,
  ScatterSeriesOption,
  TooltipComponentOption,
  GridComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';

import { windColorScale, strokeWidthScale } from '$lib/charts/scales';
import { CHART_COLORS } from '$lib/charts/chartColors';
import { makeAnchorSeries, makeLineSeries } from '$lib/charts/seriesFactories';
import { createTooltipFormatter, type TooltipStore } from '$lib/charts/tooltipFormatter';
import type { TemperatureChartData, RainCloudChartData, WindChartData } from '$lib/workers/chartWorker.types';
import type { WindFieldLevel } from '$lib/charts/wind';
import type { CloudCoverData } from '$lib/charts/clouds';
import { pressureLevels } from '$lib/charts/pressureLevels';
import { fmtTime } from '$lib/helpers';

// ─── Layout constants ────────────────────────────────────────────────────────
// All grids share the same left/right so x-axes align perfectly.
export const MARGIN_LEFT = 60;
export const MARGIN_RIGHT = 70;
export const TEMP_HEIGHT_PX = 160;
export const RAIN_HEIGHT_PX = 100;
export const WIND_HEIGHT_PX = 620;

export const TEMP_TOP = 10;
const TEMP_BOTTOM_PX = TEMP_TOP + TEMP_HEIGHT_PX;
const RAIN_GAP = 20;
export const RAIN_TOP = TEMP_BOTTOM_PX + RAIN_GAP;
const RAIN_BOTTOM_PX = RAIN_TOP + RAIN_HEIGHT_PX;
const WIND_GAP = 30;
export const WIND_TOP = RAIN_BOTTOM_PX + WIND_GAP;
export const TOTAL_HEIGHT = WIND_TOP + WIND_HEIGHT_PX + 42;

// ECharts supports SVG path strings via the 'path://' prefix.
const RAINDROP_SYMBOL = 'path://M 0 -7 C 3.5 -3.5 5 0.5 5 3 A 5 5 0 0 1 -5 3 C -5 0.5 -3.5 -3.5 0 -7 Z';

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

const CLOUD_Y_FLOOR = pressureLevels[0].heightMeters - 100;
const CLOUD_Y_CEIL = pressureLevels[pressureLevels.length - 1].heightMeters + 200;

const LEVEL_BANDS: LevelBand[] = pressureLevels.map((lv, i) => {
  const prev = pressureLevels[i - 1];
  const next = pressureLevels[i + 1];
  return {
    height: lv.heightMeters,
    bandBottom: prev ? (prev.heightMeters + lv.heightMeters) / 2 : CLOUD_Y_FLOOR,
    bandTop: next ? (lv.heightMeters + next.heightMeters) / 2 : CLOUD_Y_CEIL,
  };
});

// Map height → band boundaries for O(1) lookup inside renderItem.
const BAND_BY_HEIGHT = new Map<number, LevelBand>(LEVEL_BANDS.map((b) => [b.height, b]));

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
  rainChartData: RainCloudChartData,
  windData: WindFieldLevel[],
  cloudData: CloudCoverData[],
  cloudBase: Array<{ x: Date; y: number }>,
  windChartData: WindChartData,
  xDomain: [Date, Date],
  store: TooltipStore
): EChartsOption {
  const xMin = xDomain[0].getTime();
  const xMax = xDomain[1].getTime();

  // ── Grids ──────────────────────────────────────────────────────────────────
  const grids: GridComponentOption[] = [
    { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: TEMP_TOP, height: TEMP_HEIGHT_PX },
    { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: RAIN_TOP, height: RAIN_HEIGHT_PX },
    { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: WIND_TOP, height: WIND_HEIGHT_PX },
  ];

  // ── X axes ─────────────────────────────────────────────────────────────────
  const xAxes: XAXisComponentOption[] = [
    makeXAxis(0, false, xMin, xMax),
    makeXAxis(1, false, xMin, xMax),
    {
      ...makeXAxis(2, true, xMin, xMax),
      name: `Time [${windChartData.timezoneAbbr}]`,
      nameLocation: 'middle',
      nameGap: 28,
    },
  ];

  // ── Y axes ─────────────────────────────────────────────────────────────────
  const { tempAxisMin, tempAxisMax, humidityScale } = tempChartData;
  const humMin = humidityScale.domain[0];
  const humMax = humidityScale.domain[1];
  const { yDomain, elevation } = windChartData;

  const yAxes: YAXisComponentOption[] = [
    // 0 – temperature left
    {
      type: 'value',
      gridIndex: 0,
      name: '°C',
      offset: 10,
      nameLocation: 'end',
      nameTextStyle: { fontSize: 11 },
      min: tempAxisMin,
      max: tempAxisMax,
      axisLabel: { fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: CHART_COLORS.gridLine } },
    },
    // 1 – humidity right
    {
      type: 'value',
      gridIndex: 0,
      name: 'Hum%',
      offset: 10,
      nameLocation: 'end',
      nameTextStyle: { fontSize: 11 },
      min: humMin,
      max: humMax,
      position: 'right',
      axisLabel: { formatter: (v: number) => `${v}%`, fontSize: 11 },
      splitLine: { show: false },
    },
    // 2 – rain/cloud hidden
    {
      type: 'value',
      gridIndex: 1,
      offset: 10,
      min: 0,
      max: 1,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { show: false },
    },
    // 3 – wind height left
    {
      type: 'value',
      gridIndex: 2,
      name: 'm',
      offset: 10,
      nameLocation: 'end',
      nameTextStyle: { fontSize: 11 },
      min: yDomain[0],
      max: yDomain[1],
      axisLabel: { formatter: (v: number) => `${v}`, fontSize: 10 },
      splitLine: { show: true, lineStyle: { color: CHART_COLORS.gridLine } },
      interval: 500,
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
    tempChartData.temperatureData.map((d) => [d.time.getTime(), 0.5] as [number, number])
  );

  const cloudItems = rainChartData.cloudRects.map((r) => ({
    x1: r.x1.getTime(),
    x2: r.x2.getTime(),
    y1: r.y1,
    y2: r.y2,
    cloudCover: r.cloudCover,
  }));

  const bandMarkData: [object, object][] = [
    [{ yAxis: 0, itemStyle: { color: '#f8f8f8' } }, { yAxis: 1 / 3 }],
    [{ yAxis: 1 / 3, itemStyle: { color: '#f2f2f2' } }, { yAxis: 2 / 3 }],
    [{ yAxis: 2 / 3, itemStyle: { color: '#ebebeb' } }, { yAxis: 1 }],
  ];

  const bandPhantomSeries: LineSeriesOption = {
    name: '_bands',
    type: 'line',
    xAxisIndex: 1,
    yAxisIndex: 2,
    silent: true,
    symbol: 'none',
    lineStyle: { opacity: 0 },
    data: [[xMin, 0] as [number, number], [xMax, 1] as [number, number]],
    markArea: { silent: true, data: bandMarkData },
    z: 0,
    tooltip: { show: false },
  };

  const cloudRectSeries: CustomSeriesOption = {
    name: '_cloudRects',
    type: 'custom',
    xAxisIndex: 1,
    yAxisIndex: 2,
    silent: true,
    renderItem(params, api) {
      const item = cloudItems[params.dataIndex];
      const p1 = api.coord([item.x1, item.y2]);
      const p2 = api.coord([item.x2, item.y1]);
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

  type RainDot = { value: [number, number]; rain: number };
  const rainData: RainDot[] = rainChartData.rainDots.map((d) => ({
    value: [d.time.getTime(), 0.18] as [number, number],
    rain: d.rain,
  }));

  const rainSeries: ScatterSeriesOption = {
    name: 'Rain',
    type: 'scatter',
    xAxisIndex: 1,
    yAxisIndex: 2,
    data: rainData,
    symbol: RAINDROP_SYMBOL,
    symbolSize: (d: unknown) => {
      const dot = d as RainDot;
      if (dot.rain > 4) return [12, 18];
      if (dot.rain > 1) return [9, 14];
      return [6, 10];
    },
    itemStyle: { color: CHART_COLORS.rain },
    z: 3,
    tooltip: { show: false },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // GRID 2 – Wind field / cloud raster
  // ═══════════════════════════════════════════════════════════════════════════

  const windAnchorSeries = makeAnchorSeries(
    '__anchor_wind',
    2,
    3,
    tempChartData.temperatureData.map((d) => [d.time.getTime(), yDomain[0]] as [number, number])
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

      const band = BAND_BY_HEIGHT.get(item.height);
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

  // ── Wind arrows ────────────────────────────────────────────────────────────
  type WindItem = { time: number; height: number; speed: number; direction: number };
  const windItems: WindItem[] = windData.map((w) => ({
    time: w.time.getTime(),
    height: w.height,
    speed: w.speed,
    direction: w.direction,
  }));

  const windArrowSeries: CustomSeriesOption = {
    name: '_windArrows',
    type: 'custom',
    xAxisIndex: 2,
    yAxisIndex: 3,
    silent: true,
    renderItem(params, api) {
      const item = windItems[params.dataIndex];
      const coord = api.coord([item.time, item.height]);
      const cx = coord[0];
      const cy = coord[1];

      const arrowLength = 18;
      const strokeW = Math.max(0.75, strokeWidthScale(item.speed));
      const color = windColorScale(item.speed) as string;

      const angleDeg = item.direction - 180;
      const angleRad = (angleDeg * Math.PI) / 180;
      const dx = Math.sin(angleRad) * arrowLength;
      const dy = -Math.cos(angleRad) * arrowLength;

      const tailX = cx - dx / 2;
      const tailY = cy - dy / 2;
      const headX = cx + dx / 2;
      const headY = cy + dy / 2;

      const barbLen = Math.min(arrowLength * 0.45, 8);
      const barbAngle = Math.PI * (5 / 6);
      const b1x = headX + barbLen * Math.sin(angleRad + barbAngle);
      const b1y = headY - barbLen * Math.cos(angleRad + barbAngle);
      const b2x = headX + barbLen * Math.sin(angleRad - barbAngle);
      const b2y = headY - barbLen * Math.cos(angleRad - barbAngle);

      const lineStyle = { stroke: color, lineWidth: strokeW, lineCap: 'round' as const };

      return {
        type: 'group',
        children: [
          { type: 'line', shape: { x1: tailX, y1: tailY, x2: headX, y2: headY }, style: lineStyle },
          { type: 'line', shape: { x1: headX, y1: headY, x2: b1x, y2: b1y }, style: lineStyle },
          { type: 'line', shape: { x1: headX, y1: headY, x2: b2x, y2: b2y }, style: lineStyle },
        ],
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
    data: cloudBase.map((d) => [d.x.getTime(), d.y] as [number, number]),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Unified tooltip formatter
  // ═══════════════════════════════════════════════════════════════════════════

  const tooltipFormatter = createTooltipFormatter(store);

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
    bandPhantomSeries,
    cloudRectSeries,
    rainSeries,
    // Grid 2 – cloud rects z=1, arrows z=3, lines above
    windAnchorSeries,
    windCloudSeries,
    windArrowSeries,
    cloudBaseSeries,
    elevationLineSeries,
  ];

  return {
    animation: false,
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    axisPointer: {
      link: [{ xAxisIndex: [0, 1, 2] }],
      lineStyle: { color: '#999', type: 'dashed', width: 1 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
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
