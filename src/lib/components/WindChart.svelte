<script lang="ts">
  import * as echarts from 'echarts';
  import { windDomains, windColors, windMaxSpeed } from '$lib/charts/scales';
  import { CHART_COLORS, LEGEND_ITEMS } from '$lib/charts/chartColors';
  import { buildTooltipStore } from '$lib/charts/tooltipFormatter';
  import { buildWindChartOption, TOTAL_HEIGHT } from '$lib/charts/buildWindChartOption';
  import type { WeatherDataType } from '$lib/api/types';
  import type { ChartWorkerInput, ChartWorkerOutput } from '$lib/workers/chartWorker.types';

  export let weatherData: WeatherDataType | null = null;

  let isRendering = false;

  // ─── Worker helper ────────────────────────────────────────────────────────

  function runChartWorker(input: ChartWorkerInput, signal?: { cancelled: boolean }): Promise<ChartWorkerOutput> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('$lib/workers/chartWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<ChartWorkerOutput>) => {
        worker.terminate();
        if (signal?.cancelled) return;
        resolve(e.data);
      };
      worker.onerror = (err) => {
        worker.terminate();
        if (signal?.cancelled) return;
        reject(err);
      };
      worker.postMessage(input);
    });
  }

  // ─── Svelte action ────────────────────────────────────────────────────────

  function renderChart(node: HTMLElement, data: WeatherDataType | null) {
    let chart: echarts.ECharts | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancellation: { cancelled: boolean } | null = null;

    function destroyChart() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      chart?.dispose();
      chart = null;
      node.innerHTML = '';
    }

    async function draw(currentData: WeatherDataType) {
      isRendering = true;
      destroyChart();

      // Cancel any previous in-flight worker
      if (cancellation) cancellation.cancelled = true;
      const signal = { cancelled: false };
      cancellation = signal;

      try {
        const response = await runChartWorker({ weatherData: currentData }, signal);
        if (signal.cancelled) return;

        if (!response.success) {
          console.error('Chart worker error:', response.error);
          return;
        }

        const {
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
          buildWindChartOption(
            temperatureChartData,
            rainCloudChartData,
            windData,
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
        if (!signal.cancelled) console.error('Error creating EChart:', err);
      } finally {
        if (!signal.cancelled) isRendering = false;
      }
    }

    if (data) draw(data);

    return {
      update(newData: WeatherDataType | null) {
        if (newData) {
          draw(newData);
        } else {
          if (cancellation) cancellation.cancelled = true;
          destroyChart();
          isRendering = false;
        }
      },
      destroy() {
        if (cancellation) cancellation.cancelled = true;
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
      {#each LEGEND_ITEMS as item}
        <span class="legend-item">
          {#if item.style === 'solid'}
            <span class="legend-line" style="background:{item.color}"></span>
          {:else if item.style === 'dashed'}
            <span class="legend-dashed" style="border-color:{item.color}"></span>
          {:else if item.style === 'emoji'}
            <span class="legend-raindrop">{item.emoji}</span>
          {/if}
          {item.label}
        </span>
      {/each}
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
