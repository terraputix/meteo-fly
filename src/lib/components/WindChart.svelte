<script lang="ts">
  import * as echarts from 'echarts';
  import { buildTooltipStore, createActiveState, type ActiveState } from '$lib/charts/tooltipFormatter';
  import { buildWindChartOption, TOTAL_HEIGHT } from '$lib/charts/buildWindChartOption';
  import type { WeatherDataType } from '$lib/api/types';
  import type { ChartWorkerInput, ChartWorkerOutput } from '$lib/workers/chartWorker.types';
  import Legend from './Legend.svelte';

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

        const { cloudData, windData, cloudBase, temperatureChartData, rainCloudChartData, windChartData, xDomain } =
          response.data;

        const canvas = document.createElement('div');
        canvas.style.cssText = `width:100%;height:${TOTAL_HEIGHT}px;`;
        node.appendChild(canvas);

        chart = echarts.init(canvas);

        const store = buildTooltipStore(temperatureChartData, rainCloudChartData, windData, cloudBase);
        const activeState: ActiveState = createActiveState();

        chart.setOption(
          buildWindChartOption(
            temperatureChartData,
            rainCloudChartData,
            windData,
            cloudData,
            cloudBase,
            windChartData,
            xDomain,
            store,
            activeState
          )
        );

        // Track which grid the cursor is in and the hovered y-value for the
        // wind grid.  ECharts fires `updateaxispointer` on every mouse-move
        // with an `axesInfo` array describing each active axis.
        //
        // Y-axis → grid mapping:
        //   axisIndex 0 or 1  →  grid 0 (temperature)
        //   axisIndex 2       →  grid 1 (rain / cloud)
        //   axisIndex 3       →  grid 2 (wind field)
        chart.on('updateaxispointer', (event: unknown) => {
          const e = event as { axesInfo?: Array<{ axisDim: string; axisIndex: number; value: number }> };
          const axes = e?.axesInfo;
          if (!axes?.length) {
            activeState.gridIndex = -1;
            activeState.hoveredWindY = null;
            return;
          }
          const yInfo = axes.find((a) => a.axisDim === 'y');
          if (!yInfo) {
            activeState.gridIndex = -1;
            activeState.hoveredWindY = null;
            return;
          }
          if (yInfo.axisIndex <= 1) {
            activeState.gridIndex = 0;
            activeState.hoveredWindY = null;
          } else if (yInfo.axisIndex === 2) {
            activeState.gridIndex = 1;
            activeState.hoveredWindY = null;
          } else {
            activeState.gridIndex = 2;
            activeState.hoveredWindY = yInfo.value;
          }
        });

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

<div class="chart-container" style="min-height: {TOTAL_HEIGHT}px;">
  {#if isRendering}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Processing weather data…</p>
    </div>
  {/if}

  <!-- Use a wrapper with fixed height to prevent layout shift -->
  <div
    use:renderChart={weatherData}
    class="chart-content"
    style="opacity: {isRendering ? 0 : 1}; height: {TOTAL_HEIGHT}px;"
  ></div>
</div>

<Legend />

<style>
  .chart-container {
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    position: relative;
    padding: 0 20px;
    contain: layout;
  }

  .chart-content {
    width: 100%;
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
    gap: 12px;
    z-index: 10;
    pointer-events: none;
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

  @media (max-width: 768px) {
    .chart-container {
      padding: 0 10px;
    }
  }
</style>
