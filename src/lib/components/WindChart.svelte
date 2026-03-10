<script lang="ts">
  import * as echarts from 'echarts';
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

  // CallbackDataParams is not exported from the public echarts API – define what we use.
  interface EChartsCallbackParams {
    seriesName?: string;
    seriesIndex?: number;
    dataIndex: number;
    value?: unknown;
    data?: unknown;
    name?: string;
    componentIndex?: number;
    axisValue?: number;
    axisDimension?: string;
    axisIndex?: number;
  }

  import { windColorScale, strokeWidthScale, windDomains, windColors, windMaxSpeed } from '$lib/charts/scales';
  import type { WeatherDataType } from '$lib/api/types';
  import type {
    ChartWorkerInput,
    ChartWorkerOutput,
    TemperatureChartData,
    RainCloudChartData,
    WindChartData,
    WindCloudColumn,
  } from '$lib/workers/chartWorker.types';
  import type { CloudCoverData } from '$lib/charts/clouds';
  import type { WindFieldLevel } from '$lib/charts/wind';

  export let weatherData: WeatherDataType | null = null;

  let isRendering = false;

  // ─── Layout constants ────────────────────────────────────────────────────────
  // All grids share the same left/right so x-axes align perfectly.
  const MARGIN_LEFT = 60;
  const MARGIN_RIGHT = 70;
  const TEMP_HEIGHT_PX = 160;
  const RAIN_HEIGHT_PX = 100;
  const WIND_HEIGHT_PX = 620;

  const TEMP_TOP = 10;
  const TEMP_BOTTOM_PX = TEMP_TOP + TEMP_HEIGHT_PX;
  const RAIN_GAP = 4;
  const RAIN_TOP = TEMP_BOTTOM_PX + RAIN_GAP;
  const RAIN_BOTTOM_PX = RAIN_TOP + RAIN_HEIGHT_PX;
  const WIND_GAP = 4;
  const WIND_TOP = RAIN_BOTTOM_PX + WIND_GAP;
  const TOTAL_HEIGHT = WIND_TOP + WIND_HEIGHT_PX + 42;

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function fmtTime(d: Date): string {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // ─── Raindrop symbol ─────────────────────────────────────────────────────────
  // ECharts supports SVG path strings via the 'path://' prefix.
  const RAINDROP_SYMBOL = 'path://M 0 -7 C 3.5 -3.5 5 0.5 5 3 A 5 5 0 0 1 -5 3 C -5 0.5 -3.5 -3.5 0 -7 Z';

  // ─── Tooltip store ────────────────────────────────────────────────────────────
  // Pre-built look-up maps keyed by timestamp so the formatter is O(1).

  interface TooltipStore {
    tempByTime: Map<number, { temp: number; dew: number; hum: number }>;
    rainByTime: Map<number, number>;
    cloudLowByTime: Map<number, number>;
    cloudMidByTime: Map<number, number>;
    cloudHighByTime: Map<number, number>;
    cloudBaseByTime: Map<number, number>;
    windByTimeHeight: Map<string, { speed: number; direction: number }>;
    sortedWindTimes: number[]; // unique sorted timestamps in wind data
    sortedWindHeights: number[]; // unique sorted heights in wind data
  }

  function buildTooltipStore(
    tempData: TemperatureChartData,
    rainData: RainCloudChartData,
    windData: WindFieldLevel[],
    cloudBase: Array<{ x: Date; y: number }>
  ): TooltipStore {
    const tempByTime = new Map<number, { temp: number; dew: number; hum: number }>();
    tempData.temperatureData.forEach((d, i) => {
      tempByTime.set(d.time.getTime(), {
        temp: d.value,
        dew: tempData.dewpointData[i].value,
        hum: tempData.humidityData[i].value,
      });
    });

    const rainByTime = new Map<number, number>();
    rainData.rainDots.forEach((d) => rainByTime.set(d.time.getTime(), d.rain));

    const cloudLowByTime = new Map<number, number>();
    const cloudMidByTime = new Map<number, number>();
    const cloudHighByTime = new Map<number, number>();
    rainData.cloudRects.forEach((r) => {
      const mid = Math.round((r.x1.getTime() + r.x2.getTime()) / 2 / 3_600_000) * 3_600_000;
      if (r.y1 < 0.01) cloudLowByTime.set(mid, r.cloudCover);
      else if (r.y1 < 0.4) cloudMidByTime.set(mid, r.cloudCover);
      else cloudHighByTime.set(mid, r.cloudCover);
    });

    const cloudBaseByTime = new Map<number, number>();
    cloudBase.forEach((d) => cloudBaseByTime.set(d.x.getTime(), d.y));

    const windByTimeHeight = new Map<string, { speed: number; direction: number }>();
    const windTimesSet = new Set<number>();
    const windHeightsSet = new Set<number>();
    windData.forEach((w) => {
      const t = w.time.getTime();
      windByTimeHeight.set(`${t}_${w.height}`, { speed: w.speed, direction: w.direction });
      windTimesSet.add(t);
      windHeightsSet.add(w.height);
    });

    return {
      tempByTime,
      rainByTime,
      cloudLowByTime,
      cloudMidByTime,
      cloudHighByTime,
      cloudBaseByTime,
      windByTimeHeight,
      sortedWindTimes: Array.from(windTimesSet).sort((a, b) => a - b),
      sortedWindHeights: Array.from(windHeightsSet).sort((a, b) => a - b),
    };
  }

  // ─── Main option builder ──────────────────────────────────────────────────────

  function buildOption(
    tempChartData: TemperatureChartData,
    rainChartData: RainCloudChartData,
    windData: WindFieldLevel[],
    cloudData: CloudCoverData[],
    windCloudColumns: WindCloudColumn[],
    cloudBase: Array<{ x: Date; y: number }>,
    windChartData: WindChartData,
    xDomain: [Date, Date],
    store: TooltipStore
  ): EChartsOption {
    const xMin = xDomain[0].getTime();
    const xMax = xDomain[1].getTime();

    // ── Shared x-axis factory ─────────────────────────────────────────────────
    function makeXAxis(gridIndex: number, showLabels: boolean): XAXisComponentOption {
      return {
        type: 'time',
        gridIndex,
        min: xMin,
        max: xMax,
        axisLabel: showLabels ? { formatter: (v: number) => fmtTime(new Date(v)), fontSize: 11 } : { show: false },
        axisTick: { show: showLabels },
        axisLine: { show: true, lineStyle: { color: '#ccc' } },
        splitLine: { show: false },
      };
    }

    // ── Grids ──────────────────────────────────────────────────────────────────
    const grids: GridComponentOption[] = [
      { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: TEMP_TOP, height: TEMP_HEIGHT_PX },
      { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: RAIN_TOP, height: RAIN_HEIGHT_PX },
      { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: WIND_TOP, height: WIND_HEIGHT_PX },
    ];

    // ── X axes ─────────────────────────────────────────────────────────────────
    const xAxes: XAXisComponentOption[] = [
      makeXAxis(0, false),
      makeXAxis(1, false),
      {
        ...makeXAxis(2, true),
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
        nameLocation: 'end',
        nameTextStyle: { fontSize: 11 },
        min: tempAxisMin,
        max: tempAxisMax,
        axisLabel: { fontSize: 11 },
        splitLine: { show: true, lineStyle: { color: '#eee' } },
      },
      // 1 – humidity right
      {
        type: 'value',
        gridIndex: 0,
        name: 'Hum%',
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
        nameLocation: 'end',
        nameTextStyle: { fontSize: 11 },
        min: yDomain[0],
        max: yDomain[1],
        axisLabel: { formatter: (v: number) => `${v}`, fontSize: 10 },
        splitLine: { show: true, lineStyle: { color: '#eee' } },
        interval: 500,
      },
    ];

    // ═══════════════════════════════════════════════════════════════════════════
    // GRID 0 – Temperature / Dewpoint / Humidity
    // ═══════════════════════════════════════════════════════════════════════════

    const sunriseMarkData: [object, object][] = [
      [
        { xAxis: tempChartData.sunrise.getTime(), itemStyle: { color: 'rgba(255,220,0,0.18)' } },
        { xAxis: tempChartData.sunset.getTime() },
      ],
    ];

    // Anchor series: a silent line whose data drives the axis tooltip trigger.
    // It must have real [time, value] pairs so ECharts picks up the x position.
    const tempAnchorSeries: LineSeriesOption = {
      name: '__anchor_temp',
      type: 'line',
      xAxisIndex: 0,
      yAxisIndex: 0,
      silent: true,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      itemStyle: { opacity: 0 },
      data: tempChartData.temperatureData.map((d) => [d.time.getTime(), d.value] as [number, number]),
    };

    const tempSeries: LineSeriesOption = {
      name: 'Temperature',
      type: 'line',
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#e53e3e', width: 2 },
      itemStyle: { color: '#e53e3e' },
      markArea: { silent: true, data: sunriseMarkData },
      data: tempChartData.temperatureData.map((d) => [d.time.getTime(), d.value] as [number, number]),
      tooltip: { show: false },
    };

    const dewpointSeries: LineSeriesOption = {
      name: 'Dewpoint',
      type: 'line',
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#276749', width: 2 },
      itemStyle: { color: '#276749' },
      data: tempChartData.dewpointData.map((d) => [d.time.getTime(), d.value] as [number, number]),
      tooltip: { show: false },
    };

    const humiditySeries: LineSeriesOption = {
      name: 'Humidity',
      type: 'line',
      xAxisIndex: 0,
      yAxisIndex: 1,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#3182ce', width: 2, type: 'dashed' },
      itemStyle: { color: '#3182ce' },
      data: tempChartData.humidityData.map((d) => [d.time.getTime(), d.value] as [number, number]),
      tooltip: { show: false },
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // GRID 1 – Rain / Cloud cover bands
    // ═══════════════════════════════════════════════════════════════════════════

    // Anchor for grid 1 tooltip trigger
    const rainAnchorSeries: LineSeriesOption = {
      name: '__anchor_rain',
      type: 'line',
      xAxisIndex: 1,
      yAxisIndex: 2,
      silent: true,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      itemStyle: { opacity: 0 },
      data: tempChartData.temperatureData.map((d) => [d.time.getTime(), 0.5] as [number, number]),
    };

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
        // p1 = top-left corner in canvas pixels (high y-value → lower canvas-y)
        const p1 = api.coord([item.x1, item.y2]);
        const p2 = api.coord([item.x2, item.y1]);
        const w = Math.max(0, p2[0] - p1[0]);
        const h = Math.max(0, p2[1] - p1[1]);
        if (w === 0 || h === 0) return { type: 'group', children: [] };
        return {
          type: 'rect',
          shape: { x: p1[0], y: p1[1], width: w, height: h },
          style: {
            fill: `rgba(100,120,145,${(item.cloudCover / 100).toFixed(3)})`,
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
      itemStyle: { color: 'rgba(30,100,220,0.80)' },
      z: 3,
      tooltip: { show: false },
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // GRID 2 – Wind field / cloud raster
    // ═══════════════════════════════════════════════════════════════════════════

    // Anchor for grid 2 tooltip trigger
    const windAnchorSeries: LineSeriesOption = {
      name: '__anchor_wind',
      type: 'line',
      xAxisIndex: 2,
      yAxisIndex: 3,
      silent: true,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      itemStyle: { opacity: 0 },
      data: tempChartData.temperatureData.map((d) => [d.time.getTime(), yDomain[0]] as [number, number]),
    };

    // ── Cloud gradient columns ──────────────────────────────────────────────
    // Each WindCloudColumn covers one hourly timestamp.
    // x is the exact hourly timestamp (same as wind arrow x), halfWidth = 30 min,
    // so the column spans [x-30min, x+30min] — perfectly centred on each arrow.
    //
    // We render a single tall rectangle per column whose fill is a vertical
    // LinearGradient derived from the cloud-cover values at each pressure level.
    // The gradient stops are spaced proportionally by altitude so the colour
    // correctly reflects height even though pressure levels are not evenly spaced.
    //
    // Gradient direction in ECharts LinearGradient: (x0,y0) → (x1,y1) in
    // normalised rect coordinates where (0,0) = top-left, (1,1) = bottom-right.
    // We want top of rect (highest altitude, canvas y=0) → bottom of rect
    // (lowest altitude), so x0=0,y0=0,x1=0,y1=1.

    const windCloudSeries: CustomSeriesOption = {
      name: '_windCloud',
      type: 'custom',
      xAxisIndex: 2,
      yAxisIndex: 3,
      silent: true,
      renderItem(params, api) {
        const col = windCloudColumns[params.dataIndex];

        // Canvas pixel coordinates for the column edges.
        // topLeft  = coord of (left edge, top altitude)
        // botRight = coord of (right edge, bottom altitude)
        const topLeft = api.coord([col.x - col.halfWidth, col.yMax]);
        const botRight = api.coord([col.x + col.halfWidth, col.yMin]);

        const x = topLeft[0];
        const y = topLeft[1];
        const w = Math.max(1, botRight[0] - topLeft[0]);
        const h = Math.max(1, botRight[1] - topLeft[1]);

        // Build gradient stops.
        // col.levels is sorted bottom-to-top (ascending heightMeters).
        // We must map each level's altitude to a normalised [0,1] position in
        // the rect, where 0 = top of rect (yMax) and 1 = bottom of rect (yMin).
        const altRange = col.yMax - col.yMin;

        // Gradient runs top→bottom in the rect (y0=0 → y1=1).
        // A level at heightMeters=yMax maps to stop offset 0 (top).
        // A level at heightMeters=yMin maps to stop offset 1 (bottom).
        const stops = col.levels.map((lv) => {
          const offset = altRange > 0 ? 1 - (lv.heightMeters - col.yMin) / altRange : 0;
          const alpha = (0.85 * lv.cloudCover) / 100;
          return { offset: Math.max(0, Math.min(1, offset)), color: `rgba(90,110,140,${alpha.toFixed(3)})` };
        });

        // Ensure we always have stops at exactly 0 and 1 to avoid gradient artefacts.
        if (stops.length === 0) return { type: 'group', children: [] };
        const firstStop = { offset: 0, color: stops[0].color };
        const lastStop = { offset: 1, color: stops[stops.length - 1].color };
        const allStops = [firstStop, ...stops, lastStop];

        return {
          type: 'rect',
          // Expand 1 px horizontally to close any sub-pixel gap between columns.
          shape: { x: x - 0.5, y, width: w + 1, height: h },
          style: {
            fill: new echarts.graphic.LinearGradient(0, 0, 0, 1, allStops),
            stroke: 'none',
          },
        };
      },
      data: windCloudColumns.map((_, i) => i),
      z: 1,
      tooltip: { show: false },
    };

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

        return {
          type: 'group',
          children: [
            {
              type: 'line',
              shape: { x1: tailX, y1: tailY, x2: headX, y2: headY },
              style: { stroke: color, lineWidth: strokeW, lineCap: 'round' },
            },
            {
              type: 'line',
              shape: { x1: headX, y1: headY, x2: b1x, y2: b1y },
              style: { stroke: color, lineWidth: strokeW, lineCap: 'round' },
            },
            {
              type: 'line',
              shape: { x1: headX, y1: headY, x2: b2x, y2: b2y },
              style: { stroke: color, lineWidth: strokeW, lineCap: 'round' },
            },
          ],
        };
      },
      data: windItems.map((_, i) => i),
      z: 3,
      tooltip: { show: false },
    };

    const cloudBaseSeries: LineSeriesOption = {
      name: 'Cloud Base',
      type: 'line',
      xAxisIndex: 2,
      yAxisIndex: 3,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#805ad5', width: 2 },
      itemStyle: { color: '#805ad5' },
      data: cloudBase.map((d) => [d.x.getTime(), d.y] as [number, number]),
      z: 4,
      tooltip: { show: false },
    };

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
        lineStyle: { color: '#8B4513', width: 2, type: 'dashed' },
        label: {
          show: true,
          position: 'insideStartTop',
          formatter: `Elevation (${elevation}m)`,
          color: '#8B4513',
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
    // ECharts passes params as an array of CallbackDataParams when trigger='axis'.
    // The __anchor_* series have real [time, value] data so ECharts will fire the
    // axis trigger even when the cursor is over grids with only custom series.
    // We extract the hovered timestamp from the anchor series value.

    const tooltipFormatter = (paramsRaw: EChartsCallbackParams | EChartsCallbackParams[]): string => {
      const params = Array.isArray(paramsRaw) ? paramsRaw : [paramsRaw];
      if (!params.length) return '';

      // Find the hovered time from any anchor series
      let hoveredTime: number | null = null;
      for (const p of params) {
        const v = p.value as [number, number] | undefined;
        if (Array.isArray(v) && v[0] != null) {
          hoveredTime = v[0] as number;
          break;
        }
      }
      if (hoveredTime == null) return '';

      // Snap to the nearest hour (data is hourly)
      const snap = Math.round(hoveredTime / 3_600_000) * 3_600_000;
      const timeStr = fmtTime(new Date(snap));

      // Find which grid is hovered to optionally show wind data at nearest height.
      // We determine this by which anchor series appeared in params.
      const seriesNames = params.map((p) => p.seriesName ?? '');
      const inWindGrid = seriesNames.some((n) => n === '__anchor_wind');

      let html =
        `<div style="font-weight:600;margin-bottom:4px;padding-bottom:3px;` +
        `border-bottom:1px solid #ddd;font-size:13px">🕐 ${timeStr}</div>`;

      // ── Temperature / Dewpoint / Humidity ──
      const td = store.tempByTime.get(snap);
      if (td) {
        html += `<table style="border-collapse:collapse;width:100%;margin-bottom:4px">`;
        html +=
          `<tr><td style="padding:1px 4px 1px 0">` +
          `<span style="display:inline-block;width:12px;height:2px;background:#e53e3e;vertical-align:middle;margin-right:3px"></span>` +
          `Temp</td><td style="text-align:right;font-weight:600">${td.temp.toFixed(1)}&nbsp;°C</td></tr>`;
        html +=
          `<tr><td style="padding:1px 4px 1px 0">` +
          `<span style="display:inline-block;width:12px;height:2px;background:#276749;vertical-align:middle;margin-right:3px"></span>` +
          `Dew</td><td style="text-align:right;font-weight:600">${td.dew.toFixed(1)}&nbsp;°C</td></tr>`;
        html +=
          `<tr><td style="padding:1px 4px 1px 0">` +
          `<span style="display:inline-block;width:12px;height:0;border-top:2px dashed #3182ce;vertical-align:middle;margin-right:3px"></span>` +
          `Humidity</td><td style="text-align:right;font-weight:600">${td.hum.toFixed(0)}&nbsp;%</td></tr>`;
        html += `</table>`;
      }

      // ── Rain ──
      const rain = store.rainByTime.get(snap);
      if (rain != null && rain > 0) {
        html += `<div style="margin-bottom:3px">` + `💧 Rain:&nbsp;<b>${rain.toFixed(1)}&nbsp;mm/h</b></div>`;
      }

      // ── Cloud cover bands ──
      const low = store.cloudLowByTime.get(snap);
      const mid = store.cloudMidByTime.get(snap);
      const high = store.cloudHighByTime.get(snap);
      if (low != null || mid != null || high != null) {
        html += `<table style="border-collapse:collapse;width:100%;margin-bottom:4px">`;
        if (low != null)
          html += `<tr><td style="padding:1px 4px 1px 0">☁ Low cloud</td><td style="text-align:right;font-weight:600">${low}&nbsp;%</td></tr>`;
        if (mid != null)
          html += `<tr><td style="padding:1px 4px 1px 0">☁ Mid cloud</td><td style="text-align:right;font-weight:600">${mid}&nbsp;%</td></tr>`;
        if (high != null)
          html += `<tr><td style="padding:1px 4px 1px 0">☁ High cloud</td><td style="text-align:right;font-weight:600">${high}&nbsp;%</td></tr>`;
        html += `</table>`;
      }

      // ── Cloud base ──
      const cb = store.cloudBaseByTime.get(snap);
      if (cb != null) {
        html +=
          `<div style="margin-bottom:3px">` +
          `<span style="display:inline-block;width:12px;height:2px;background:#805ad5;vertical-align:middle;margin-right:3px"></span>` +
          `Cloud base:&nbsp;<b>${Math.round(cb)}&nbsp;m</b></div>`;
      }

      // ── Wind at all heights (only when hovering wind grid) ──
      if (inWindGrid) {
        const entries: { height: number; speed: number; direction: number }[] = [];
        for (const h of store.sortedWindHeights) {
          const w = store.windByTimeHeight.get(`${snap}_${h}`);
          if (w) entries.push({ height: h, speed: w.speed, direction: w.direction });
        }
        if (entries.length) {
          html += `<div style="margin-top:4px;padding-top:3px;border-top:1px solid #eee;font-size:11px">`;
          html += `<b>Wind at ${timeStr}</b>`;
          html += `<table style="border-collapse:collapse;width:100%;margin-top:2px">`;
          for (const e of entries) {
            const col = windColorScale(e.speed) as string;
            html +=
              `<tr>` +
              `<td style="padding:0 4px 0 0;color:#666">${e.height}&nbsp;m</td>` +
              `<td style="color:${col};font-weight:600;text-align:right">${e.speed}&nbsp;km/h</td>` +
              `<td style="color:#555;text-align:right;padding-left:6px">${e.direction}°</td>` +
              `</tr>`;
          }
          html += `</table></div>`;
        }
      }

      return html;
    };

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
      // Grid 2 – cloud gradient must be z=1, arrows z=3, lines above
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

  // ─── Svelte action ────────────────────────────────────────────────────────────

  function renderChart(node: HTMLElement, data: WeatherDataType | null) {
    let currentWorker: Worker | null = null;
    let chart: echarts.ECharts | null = null;
    let resizeObserver: ResizeObserver | null = null;

    function destroyChart() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      chart?.dispose();
      chart = null;
      node.innerHTML = '';
    }

    function draw(currentData: WeatherDataType): void {
      isRendering = true;
      destroyChart();
      currentWorker?.terminate();

      currentWorker = new Worker(new URL('$lib/workers/chartWorker.ts', import.meta.url), {
        type: 'module',
      });

      currentWorker.onmessage = function (e: MessageEvent<ChartWorkerOutput>) {
        const response = e.data;

        if (response.success) {
          try {
            const {
              cloudData,
              windCloudColumns,
              windData,
              cloudBase,
              temperatureChartData,
              rainCloudChartData,
              windChartData,
              xDomain,
            } = response.data;

            const canvas = document.createElement('div');
            canvas.style.cssText = `width:100%;height:${TOTAL_HEIGHT}px;`;
            node.appendChild(canvas);

            chart = echarts.init(canvas);

            const store = buildTooltipStore(temperatureChartData, rainCloudChartData, windData, cloudBase);

            chart.setOption(
              buildOption(
                temperatureChartData,
                rainCloudChartData,
                windData,
                cloudData,
                windCloudColumns,
                cloudBase,
                windChartData,
                xDomain,
                store
              )
            );

            resizeObserver = new ResizeObserver(() => chart?.resize());
            resizeObserver.observe(node);
          } catch (err) {
            console.error('Error creating EChart:', err);
          }
        } else {
          console.error('Chart worker error:', response.error);
        }

        isRendering = false;
        currentWorker?.terminate();
        currentWorker = null;
      };

      currentWorker.onerror = function (error: ErrorEvent) {
        console.error('Worker error:', error);
        isRendering = false;
        currentWorker?.terminate();
        currentWorker = null;
      };

      const workerInput: ChartWorkerInput = { weatherData: currentData };
      currentWorker.postMessage(workerInput);
    }

    if (data) draw(data);

    return {
      update(newData: WeatherDataType | null) {
        if (newData) {
          draw(newData);
        } else {
          currentWorker?.terminate();
          currentWorker = null;
          destroyChart();
          isRendering = false;
        }
      },
      destroy() {
        currentWorker?.terminate();
        currentWorker = null;
        destroyChart();
      },
    };
  }
</script>

<div class="chart-container">
  {#if isRendering}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Processing weather data…</p>
    </div>
  {/if}
  <div use:renderChart={weatherData} class="chart-content" style="opacity: {isRendering ? 0 : 1}"></div>
</div>

<!-- ─── Legend ──────────────────────────────────────────────────────────────── -->
<div class="legend-outer">
  <!-- Row 1: Line series -->
  <div class="legend-section">
    <span class="legend-title">Lines</span>
    <div class="legend-items-row">
      <span class="legend-item">
        <span class="legend-line" style="background:#e53e3e"></span>Temperature
      </span>
      <span class="legend-item">
        <span class="legend-line" style="background:#276749"></span>Dewpoint
      </span>
      <span class="legend-item">
        <span class="legend-dashed" style="border-color:#3182ce"></span>Humidity
      </span>
      <span class="legend-item">
        <span class="legend-line" style="background:#805ad5"></span>Cloud Base
      </span>
      <span class="legend-item">
        <span class="legend-dashed" style="border-color:#8B4513"></span>Surface Elev.
      </span>
      <span class="legend-item">
        <span class="legend-raindrop">💧</span>Rain
      </span>
    </div>
  </div>

  <!-- Row 2: Cloud cover -->
  <div class="legend-section">
    <span class="legend-title">Cloud Cover</span>
    <div class="legend-gradient-wrap">
      <div
        class="legend-gradient"
        style="background:linear-gradient(to right,
          rgba(100,120,145,0) 0%,
          rgba(100,120,145,0.4) 50%,
          rgba(100,120,145,0.82) 100%);"
      ></div>
      <div class="legend-gradient-ticks">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
    <div class="legend-bands">
      <span class="band-label" style="background:#f8f8f8">Low</span>
      <span class="band-label" style="background:#f2f2f2">Mid</span>
      <span class="band-label" style="background:#ebebeb">High</span>
      <span class="band-note">(rain panel)</span>
    </div>
  </div>

  <!-- Row 3: Wind speed -->
  <div class="legend-section">
    <span class="legend-title">Wind Speed (km/h)</span>
    <div class="legend-gradient-wrap">
      <div
        class="legend-gradient"
        style="background:linear-gradient(to right, {windDomains
          .map((d, i) => `${windColors[i]} ${((d / windMaxSpeed) * 100).toFixed(1)}%`)
          .join(', ')});"
      ></div>
      <div class="legend-gradient-ticks">
        {#each windDomains as d}
          <span>{Math.round(d)}</span>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  /* ── Chart ───────────────────────────────────────────────────────────────── */

  .chart-container {
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    position: relative;
    padding: 0 20px;
  }

  .chart-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    transition: opacity 0.3s ease;
  }

  .loading-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    z-index: 10;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4f46e5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* ── Legend ──────────────────────────────────────────────────────────────── */

  .legend-outer {
    width: 100%;
    max-width: 1040px;
    margin: 0.5rem auto 1rem;
    padding: 0.6rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    background: #fafafa;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.72rem;
    color: #444;
  }

  .legend-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .legend-title {
    font-weight: 700;
    font-size: 0.7rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    min-width: 80px;
  }

  .legend-items-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .legend-line {
    display: inline-block;
    width: 18px;
    height: 3px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-dashed {
    display: inline-block;
    width: 18px;
    height: 0;
    border-top: 2.5px dashed;
    background: transparent !important;
    flex-shrink: 0;
  }

  .legend-raindrop {
    font-size: 0.85rem;
    line-height: 1;
  }

  .legend-gradient-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 160px;
    max-width: 260px;
  }

  .legend-gradient {
    height: 13px;
    border-radius: 3px;
    border: 1px solid #ddd;
  }

  .legend-gradient-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 0.62rem;
    color: #888;
  }

  .legend-bands {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .band-label {
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid #ddd;
    font-size: 0.68rem;
    color: #555;
  }

  .band-note {
    font-size: 0.65rem;
    color: #999;
  }

  @media (max-width: 768px) {
    .chart-container {
      padding: 0 10px;
    }
    .legend-outer {
      padding: 0.5rem 0.75rem;
    }
  }
</style>
