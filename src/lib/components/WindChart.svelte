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

  // CallbackDataParams is not exported from the public echarts API, so we define
  // a local equivalent covering the properties we actually use.
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
  }

  import { windColorScale, strokeWidthScale, windDomains, windColors, windMaxSpeed } from '$lib/charts/scales';
  import type { WeatherDataType } from '$lib/api/types';
  import type {
    ChartWorkerInput,
    ChartWorkerOutput,
    TemperatureChartData,
    RainCloudChartData,
    WindChartData,
  } from '$lib/workers/chartWorker.types';
  import type { CloudCoverData } from '$lib/charts/clouds';
  import type { WindFieldLevel } from '$lib/charts/wind';

  export let weatherData: WeatherDataType | null = null;

  let isRendering = false;

  // ─── Layout constants ────────────────────────────────────────────────────────
  // All grids share the same left/right margins so x-axes align perfectly.
  const MARGIN_LEFT = 60;
  const MARGIN_RIGHT = 70; // extra for right-side humidity axis label
  const TEMP_HEIGHT_PX = 160;
  const RAIN_HEIGHT_PX = 100;
  // wind chart fills the rest

  // Grid top offsets (pixels from chart top)
  const TEMP_TOP = 10;
  const TEMP_BOTTOM_PX = TEMP_TOP + TEMP_HEIGHT_PX; // absolute bottom edge of temp grid
  const RAIN_GAP = 4;
  const RAIN_TOP = TEMP_BOTTOM_PX + RAIN_GAP;
  const RAIN_BOTTOM_PX = RAIN_TOP + RAIN_HEIGHT_PX;
  const WIND_GAP = 4;
  const WIND_TOP = RAIN_BOTTOM_PX + WIND_GAP;
  const WIND_HEIGHT_PX = 620;
  const TOTAL_HEIGHT = WIND_TOP + WIND_HEIGHT_PX + 40; // +40 for bottom axis label

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function fmtTime(d: Date): string {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // ─── Raindrop symbol ─────────────────────────────────────────────────────────
  // Registered once so ECharts can use 'raindrop' as a symbol name.

  // SVG path for a raindrop symbol, used via ECharts' 'path://' prefix.
  // The path is centred at (0,0) in a 10×14 viewBox so ECharts can scale it.
  const RAINDROP_SYMBOL = 'path://M 0 -7 C 4 -3 5 1 5 4 A 5 5 0 0 1 -5 4 C -5 1 -4 -3 0 -7 Z';

  function ensureRaindropSymbol() {
    // No registration needed — ECharts supports 'path://' natively.
  }

  // ─── Unified tooltip data store ───────────────────────────────────────────────
  // We build look-up maps outside the option builder so the tooltip formatter
  // can access all series data for a given timestamp.

  interface UnifiedTooltipStore {
    temperatureByTime: Map<number, { temp: number; dew: number; hum: number }>;
    rainByTime: Map<number, number>;
    cloudLowByTime: Map<number, number>;
    cloudMidByTime: Map<number, number>;
    cloudHighByTime: Map<number, number>;
    cloudBaseByTime: Map<number, number>;
    windByTimeHeight: Map<string, { speed: number; direction: number }>;
    timezoneAbbr: string;
  }

  function buildTooltipStore(
    temperatureChartData: TemperatureChartData,
    rainCloudChartData: RainCloudChartData,
    windData: WindFieldLevel[],
    cloudBase: Array<{ x: Date; y: number }>,
    timezoneAbbr: string
  ): UnifiedTooltipStore {
    const temperatureByTime = new Map<number, { temp: number; dew: number; hum: number }>();
    temperatureChartData.temperatureData.forEach((d, i) => {
      temperatureByTime.set(d.time.getTime(), {
        temp: d.value,
        dew: temperatureChartData.dewpointData[i].value,
        hum: temperatureChartData.humidityData[i].value,
      });
    });

    const rainByTime = new Map<number, number>();
    rainCloudChartData.rainDots.forEach((d) => rainByTime.set(d.time.getTime(), d.rain));

    // Build cloud cover maps from rects: pick the rect centred on each hour
    const cloudLowByTime = new Map<number, number>();
    const cloudMidByTime = new Map<number, number>();
    const cloudHighByTime = new Map<number, number>();
    rainCloudChartData.cloudRects.forEach((r) => {
      const t = new Date((r.x1.getTime() + r.x2.getTime()) / 2).getTime();
      // snap to nearest hour
      const snap = Math.round(t / 3_600_000) * 3_600_000;
      if (r.y1 < 0.01) cloudLowByTime.set(snap, r.cloudCover);
      else if (r.y1 < 0.4) cloudMidByTime.set(snap, r.cloudCover);
      else cloudHighByTime.set(snap, r.cloudCover);
    });

    const cloudBaseByTime = new Map<number, number>();
    cloudBase.forEach((d) => cloudBaseByTime.set(d.x.getTime(), d.y));

    const windByTimeHeight = new Map<string, { speed: number; direction: number }>();
    windData.forEach((w) => {
      windByTimeHeight.set(`${w.time.getTime()}_${w.height}`, {
        speed: w.speed,
        direction: w.direction,
      });
    });

    return {
      temperatureByTime,
      rainByTime,
      cloudLowByTime,
      cloudMidByTime,
      cloudHighByTime,
      cloudBaseByTime,
      windByTimeHeight,
      timezoneAbbr,
    };
  }

  // ─── Main chart option builder ────────────────────────────────────────────────

  function buildOption(
    temperatureChartData: TemperatureChartData,
    rainCloudChartData: RainCloudChartData,
    windData: WindFieldLevel[],
    cloudData: CloudCoverData[],
    cloudBase: Array<{ x: Date; y: number }>,
    windChartData: WindChartData,
    xDomain: [Date, Date],
    store: UnifiedTooltipStore
  ): EChartsOption {
    const xMin = xDomain[0].getTime();
    const xMax = xDomain[1].getTime();

    // ── Shared x-axis config factory ─────────────────────────────────────────
    function makeXAxis(gridIndex: number, showLabels: boolean): XAXisComponentOption {
      return {
        type: 'time',
        gridIndex,
        min: xMin,
        max: xMax,
        axisLabel: showLabels ? { formatter: (v: number) => fmtTime(new Date(v)), fontSize: 11 } : { show: false },
        axisTick: { show: showLabels },
        axisLine: { show: true, lineStyle: { color: '#ccc' } },
        splitLine: { show: showLabels, lineStyle: { color: '#eee' } },
      };
    }

    // ── Three grids ──────────────────────────────────────────────────────────
    // Use absolute pixel values for top so all grids line up exactly.
    const grids: GridComponentOption[] = [
      // grid 0 – temperature
      { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: TEMP_TOP, height: TEMP_HEIGHT_PX },
      // grid 1 – rain / cloud cover
      { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: RAIN_TOP, height: RAIN_HEIGHT_PX },
      // grid 2 – wind field
      { left: MARGIN_LEFT, right: MARGIN_RIGHT, top: WIND_TOP, height: WIND_HEIGHT_PX },
    ];

    // ── X axes (one per grid) ────────────────────────────────────────────────
    const xAxes: XAXisComponentOption[] = [
      makeXAxis(0, false), // temp — no bottom labels (rain is directly below)
      makeXAxis(1, false), // rain — no bottom labels
      {
        ...makeXAxis(2, true),
        name: `Time [${windChartData.timezoneAbbr}]`,
        nameLocation: 'middle',
        nameGap: 28,
      },
    ];

    // ── Y axes ───────────────────────────────────────────────────────────────
    const { tempAxisMin, tempAxisMax, humidityScale } = temperatureChartData;
    const humMin = humidityScale.domain[0];
    const humMax = humidityScale.domain[1];
    const { yDomain, elevation } = windChartData;

    const yAxes: YAXisComponentOption[] = [
      // 0 – temperature (left)
      {
        type: 'value',
        gridIndex: 0,
        name: '°C',
        nameLocation: 'end',
        nameTextStyle: { fontSize: 11, padding: [0, 0, 0, 0] },
        min: tempAxisMin,
        max: tempAxisMax,
        axisLabel: { fontSize: 11 },
        splitLine: { show: true, lineStyle: { color: '#eee' } },
      },
      // 1 – humidity (right)
      {
        type: 'value',
        gridIndex: 0,
        name: 'Hum %',
        nameLocation: 'end',
        nameTextStyle: { fontSize: 11 },
        min: humMin,
        max: humMax,
        position: 'right',
        axisLabel: { formatter: (v: number) => `${v}%`, fontSize: 11 },
        splitLine: { show: false },
      },
      // 2 – rain/cloud (hidden)
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
      // 3 – wind height (left)
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

    // ── Temperature series ────────────────────────────────────────────────────
    const sunriseMarkData: [object, object][] = [
      [
        { xAxis: temperatureChartData.sunrise.getTime(), itemStyle: { color: 'rgba(255,220,0,0.18)' } },
        { xAxis: temperatureChartData.sunset.getTime() },
      ],
    ];

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
      data: temperatureChartData.temperatureData.map((d) => [d.time.getTime(), d.value] as [number, number]),
      tooltip: { show: false }, // handled by unified formatter
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
      data: temperatureChartData.dewpointData.map((d) => [d.time.getTime(), d.value] as [number, number]),
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
      data: temperatureChartData.humidityData.map((d) => [d.time.getTime(), d.value] as [number, number]),
      tooltip: { show: false },
    };

    // ── Rain / cloud cover series ─────────────────────────────────────────────
    const cloudItems = rainCloudChartData.cloudRects.map((r) => ({
      x1: r.x1.getTime(),
      x2: r.x2.getTime(),
      y1: r.y1,
      y2: r.y2,
      cloudCover: r.cloudCover,
    }));

    type RainDot = { value: [number, number]; rain: number };
    const rainData: RainDot[] = rainCloudChartData.rainDots.map((d) => ({
      value: [d.time.getTime(), d.y] as [number, number],
      rain: d.rain,
    }));

    // Band background markArea (phantom line over the rain/cloud grid)
    const bandMarkData: [object, object][] = [
      [{ yAxis: 0, itemStyle: { color: '#fafafa' } }, { yAxis: 1 / 3 }],
      [{ yAxis: 1 / 3, itemStyle: { color: '#f4f4f4' } }, { yAxis: 2 / 3 }],
      [{ yAxis: 2 / 3, itemStyle: { color: '#eeeeee' } }, { yAxis: 1 }],
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
      name: 'Cloud Cover',
      type: 'custom',
      xAxisIndex: 1,
      yAxisIndex: 2,
      silent: true, // tooltip handled globally
      renderItem(params, api) {
        const item = cloudItems[params.dataIndex];
        const p1 = api.coord([item.x1, item.y2]);
        const p2 = api.coord([item.x2, item.y1]);
        return {
          type: 'rect',
          shape: { x: p1[0], y: p1[1], width: Math.max(0, p2[0] - p1[0]), height: Math.max(0, p2[1] - p1[1]) },
          style: { fill: `rgba(100,120,140,${item.cloudCover / 100})`, stroke: 'none' },
        };
      },
      data: cloudItems.map((_, i) => i),
      z: 1,
      tooltip: { show: false },
    };

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
      itemStyle: { color: 'rgba(30,100,220,0.75)' },
      z: 3,
      tooltip: { show: false },
    };

    // ── Wind field series ─────────────────────────────────────────────────────
    const windCloudItems = cloudData.map((c) => ({
      x1: c.x1.getTime(),
      x2: c.x2.getTime(),
      y1: c.y1,
      y2: c.y2,
      value: c.value,
    }));

    type WindItem = { time: number; height: number; speed: number; direction: number };
    const windItems: WindItem[] = windData.map((w) => ({
      time: w.time.getTime(),
      height: w.height,
      speed: w.speed,
      direction: w.direction,
    }));

    const windCloudRasterSeries: CustomSeriesOption = {
      name: '_windCloud',
      type: 'custom',
      xAxisIndex: 2,
      yAxisIndex: 3,
      silent: true,
      renderItem(params, api) {
        const item = windCloudItems[params.dataIndex];
        const p1 = api.coord([item.x1, item.y2]);
        const p2 = api.coord([item.x2, item.y1]);
        const alpha = 0.85 * (item.value / 100);
        return {
          type: 'rect',
          shape: { x: p1[0], y: p1[1], width: Math.max(0, p2[0] - p1[0]), height: Math.max(0, p2[1] - p1[1]) },
          style: { fill: `rgba(100,120,140,${alpha})`, stroke: 'none' },
        };
      },
      data: windCloudItems.map((_, i) => i),
      z: 1,
      tooltip: { show: false },
    };

    const windArrowSeries: CustomSeriesOption = {
      name: 'Wind',
      type: 'custom',
      xAxisIndex: 2,
      yAxisIndex: 3,
      silent: true, // tooltip handled globally
      renderItem(params, api) {
        const item = windItems[params.dataIndex];
        const coord = api.coord([item.time, item.height]);
        const cx = coord[0];
        const cy = coord[1];

        const arrowLength = 18;
        const strokeW = Math.max(0.75, strokeWidthScale(item.speed));
        const color = windColorScale(item.speed) as string;

        const angleDeg = item.direction - 180; // arrow points in direction wind travels
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

    // ── Unified tooltip ───────────────────────────────────────────────────────
    // ECharts fires the tooltip on the axisPointer time value from whichever
    // grid the cursor is in.  We snap the hovered x to the nearest hour and
    // show a combined panel for all three charts, plus wind info at the
    // nearest height level when hovering over the wind chart.

    const tooltipFormatter = (paramsRaw: EChartsCallbackParams | EChartsCallbackParams[]): string => {
      // params can be an array (axis trigger) or single object (item trigger)
      const params = Array.isArray(paramsRaw) ? paramsRaw : [paramsRaw];
      if (!params.length) return '';

      // Determine hovered time from the first param that has a value
      let hoveredTime: number | null = null;
      for (const p of params) {
        if (p.axisValue != null) {
          hoveredTime = p.axisValue;
          break;
        }
        const v = p.value as [number, number] | undefined;
        if (v?.[0] != null) {
          hoveredTime = v[0];
          break;
        }
      }
      if (hoveredTime == null) return '';

      // Snap to nearest hour
      const snap = Math.round(hoveredTime / 3_600_000) * 3_600_000;
      const timeStr = fmtTime(new Date(snap));

      // Determine which grid is active (0=temp, 1=rain, 2=wind)
      const activeGridIndex = params[0]?.componentIndex ?? params[0]?.seriesIndex ?? 0;

      // ── Temperature section ──
      const td = store.temperatureByTime.get(snap);
      let html = `<div style="font-weight:600;margin-bottom:4px;border-bottom:1px solid #ddd;padding-bottom:3px">🕐 ${timeStr}</div>`;

      if (td) {
        html += `<div style="display:flex;flex-direction:column;gap:1px;margin-bottom:4px">`;
        html += `<span><span style="display:inline-block;width:10px;height:2px;background:#e53e3e;margin-right:4px;vertical-align:middle"></span>Temp: <b>${td.temp.toFixed(1)}°C</b></span>`;
        html += `<span><span style="display:inline-block;width:10px;height:2px;background:#276749;margin-right:4px;vertical-align:middle"></span>Dew: <b>${td.dew.toFixed(1)}°C</b></span>`;
        html += `<span><span style="display:inline-block;width:10px;height:2px;background:#3182ce;margin-right:4px;border-top:2px dashed #3182ce;height:0"></span>Humidity: <b>${td.hum.toFixed(0)}%</b></span>`;
        html += `</div>`;
      }

      // ── Rain + cloud cover section ──
      const rain = store.rainByTime.get(snap);
      const low = store.cloudLowByTime.get(snap);
      const mid = store.cloudMidByTime.get(snap);
      const high = store.cloudHighByTime.get(snap);

      html += `<div style="display:flex;flex-direction:column;gap:1px;margin-bottom:4px">`;
      if (rain != null && rain > 0) {
        html += `<span>🌧 Rain: <b>${rain.toFixed(1)} mm/h</b></span>`;
      }
      if (low != null) html += `<span>☁ Cloud Low: <b>${low}%</b></span>`;
      if (mid != null) html += `<span>☁ Cloud Mid: <b>${mid}%</b></span>`;
      if (high != null) html += `<span>☁ Cloud High: <b>${high}%</b></span>`;
      html += `</div>`;

      // ── Cloud base ──
      const cb = store.cloudBaseByTime.get(snap);
      if (cb != null) {
        html += `<div style="margin-bottom:4px"><span style="display:inline-block;width:10px;height:2px;background:#805ad5;margin-right:4px;vertical-align:middle"></span>Cloud Base: <b>${Math.round(cb)} m</b></div>`;
      }

      return html;
    };

    // ── Assemble option ───────────────────────────────────────────────────────
    const allSeries: SeriesOption[] = [
      tempSeries,
      dewpointSeries,
      humiditySeries,
      bandPhantomSeries,
      cloudRectSeries,
      rainSeries,
      windCloudRasterSeries,
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
        lineStyle: { color: '#aaa', type: 'dashed' },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: tooltipFormatter as TooltipComponentOption['formatter'],
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderColor: '#ddd',
        borderWidth: 1,
        textStyle: { fontSize: 12, color: '#333' },
        extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.12); max-width: 220px;',
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

    ensureRaindropSymbol(); // noop, kept for clarity

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
            const { cloudData, windData, cloudBase, temperatureChartData, rainCloudChartData, windChartData, xDomain } =
              response.data;

            // Single canvas element sized to fit all grids
            const canvas = document.createElement('div');
            canvas.style.cssText = `width:100%;height:${TOTAL_HEIGHT}px;`;
            node.appendChild(canvas);

            chart = echarts.init(canvas);

            const store = buildTooltipStore(
              temperatureChartData,
              rainCloudChartData,
              windData,
              cloudBase,
              windChartData.timezoneAbbr
            );

            chart.setOption(
              buildOption(
                temperatureChartData,
                rainCloudChartData,
                windData,
                cloudData,
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
      <p>Processing weather data...</p>
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
        <span class="legend-line legend-dashed" style="border-color:#3182ce"></span>Humidity
      </span>
      <span class="legend-item">
        <span class="legend-line" style="background:#805ad5"></span>Cloud Base
      </span>
      <span class="legend-item">
        <span class="legend-line legend-dashed" style="border-color:#8B4513"></span>Surface Elev.
      </span>
      <span class="legend-item">
        <span class="legend-raindrop">💧</span>Rain
      </span>
    </div>
  </div>

  <!-- Row 2: Cloud cover gradient -->
  <div class="legend-section">
    <span class="legend-title">Cloud Cover</span>
    <div class="legend-gradient-wrap">
      <div
        class="legend-gradient"
        style="background: linear-gradient(to right, rgba(100,120,140,0) 0%, rgba(100,120,140,0.5) 50%, rgba(100,120,140,0.85) 100%);"
      ></div>
      <div class="legend-gradient-ticks">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
    <div class="legend-bands">
      <span class="band-label" style="background:#fafafa">Low</span>
      <span class="band-label" style="background:#f4f4f4">Mid</span>
      <span class="band-label" style="background:#eeeeee">High</span>
      <span class="band-note">(rain/cloud panel)</span>
      <span class="band-label" style="background:#dde4ea;color:#333">↑ in wind panel</span>
    </div>
  </div>

  <!-- Row 3: Wind speed gradient -->
  <div class="legend-section">
    <span class="legend-title">Wind Speed (km/h)</span>
    <div class="legend-gradient-wrap">
      <div
        class="legend-gradient"
        style="background: linear-gradient(to right, {windDomains
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
