<script lang="ts">
  import * as echarts from 'echarts';
  import { buildTooltipStore, createActiveState, type ActiveState } from '$lib/charts/tooltipFormatter';
  import { buildWindChartOption, getChartHeight } from '$lib/charts/buildWindChartOption';
  import type { WindChartData } from '$lib/api/types';
  import type { ChartWorkerInput, ChartWorkerOutput } from '$lib/workers/chartWorker.types';
  import type { WeatherModel } from '$lib/api/types';
  import type { MaxAltitude } from '$lib/meteo/types';

  let {
    windChartData = null,
    maxAltitude = 4000,
    model = 'icon_seamless',
    isLoading = false,
    daylightOnly = false,
  }: {
    windChartData: WindChartData | null;
    maxAltitude: MaxAltitude;
    model: WeatherModel;
    isLoading: boolean;
    daylightOnly?: boolean;
  } = $props();

  let isRendering = $state(false);

  let isBusy = $derived(isLoading || isRendering);

  let windHeight = $derived(Math.ceil(maxAltitude / 10));
  let totalHeight = $derived(getChartHeight(windHeight));

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

  type RenderChartParams = {
    data: WindChartData | null;
    windHeight: number;
    maxAltitude: MaxAltitude;
    model: WeatherModel;
    daylightOnly: boolean;
  };

  function renderChart(node: HTMLElement, params: RenderChartParams) {
    let chart: echarts.ECharts | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancellation: { cancelled: boolean } | null = null;
    let prevData = params.data;
    let prevDaylightOnly = params.daylightOnly;

    function destroyChart() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      chart?.dispose();
      chart = null;
      node.innerHTML = '';
    }

    async function draw(currentData: WindChartData) {
      isRendering = true;
      destroyChart();

      // Cancel any previous in-flight worker
      if (cancellation) cancellation.cancelled = true;
      const signal = { cancelled: false };
      cancellation = signal;

      try {
        const response = await runChartWorker({ windChartData: currentData, maxAltitude, model, daylightOnly }, signal);
        if (signal.cancelled) return;

        if (!response.success) {
          console.error('Chart worker error:', response.error);
          return;
        }

        const {
          cloudData,
          windData,
          lcl,
          elevation,
          modelGridElevation,
          timezoneAbbr,
          temperatureChartData,
          rainCloudChartData,
          xDomain,
        } = response.data;

        const canvas = document.createElement('div');
        canvas.style.cssText = `width:100%;height:${totalHeight}px;`;
        node.appendChild(canvas);

        chart = echarts.init(canvas);

        const store = buildTooltipStore(temperatureChartData, rainCloudChartData, windData, lcl);
        const activeState: ActiveState = createActiveState();

        chart.setOption(
          buildWindChartOption(
            temperatureChartData,
            rainCloudChartData,
            windData,
            cloudData,
            lcl,
            elevation,
            timezoneAbbr,
            xDomain,
            store,
            activeState,
            windHeight,
            maxAltitude,
            model,
            modelGridElevation
          )
        );

        // Track which grid the cursor is in and the hovered y-value for the
        // wind grid.  ECharts fires `updateaxispointer` on every mouse-move
        // with an `axesInfo` array describing each active axis.
        //
        // Y-axis → grid mapping:
        //   axisIndex 0 or 1  →  grid 0 (temperature)
        //   axisIndex 2       →  grid 1 (rain / cloud)
        //   axisIndex 3 or 4  →  grid 2 (wind field)
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
            // axisIndex 3 (wind height left) or 4 (pressure right) → grid 2
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

    if (params.data) draw(params.data);

    return {
      update(newParams: RenderChartParams) {
        model = newParams.model;
        maxAltitude = newParams.maxAltitude;
        if (newParams.data !== prevData || newParams.daylightOnly !== prevDaylightOnly) {
          prevData = newParams.data;
          prevDaylightOnly = newParams.daylightOnly;
          if (newParams.data) {
            draw(newParams.data);
          } else {
            if (cancellation) cancellation.cancelled = true;
            destroyChart();
            isRendering = false;
          }
        }
      },
      destroy() {
        if (cancellation) cancellation.cancelled = true;
        destroyChart();
      },
    };
  }
</script>

<div class="chart-container" style="min-height: {totalHeight}px;">
  <div class="loading-state" class:loading-state--visible={isBusy} aria-hidden={!isBusy}>
    <div class="loading-spinner"></div>
    <p>Loading weather data…</p>
  </div>

  <!-- Use a wrapper with fixed height to prevent layout shift -->
  <div
    use:renderChart={{ data: windChartData, windHeight, maxAltitude, model, daylightOnly }}
    class="chart-content"
    style="opacity: {isBusy ? 0 : 1}; height: {totalHeight}px;"
  ></div>
</div>

<style>
  .chart-container {
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    position: relative;
    padding: 0;
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
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .loading-state--visible {
    opacity: 1;
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
      padding: 0;
    }
  }
</style>
