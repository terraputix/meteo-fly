<script lang="ts">
  import { init, use, type EChartsType } from 'echarts/core';
  import { CustomChart, LineChart } from 'echarts/charts';
  import { GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';
  import { buildTooltipStore, createActiveState, type ActiveState } from '$lib/charts/tooltipFormatter';
  import { buildWindChartOption, getChartHeight, getWindChartHeight, WIND_TOP } from '$lib/charts/buildWindChartOption';
  import type { WindChartData } from '$lib/api/types';
  import type { ChartWorkerOutput, ChartWorkerRequest } from '$lib/workers/chartWorker.types';
  import type { WeatherModel } from '$lib/api/types';
  import { MAX_ALTITUDE_OPTIONS, type MaxAltitude } from '$lib/meteo/types';
  import ChartLoadingOverlay from '$lib/components/ChartLoadingOverlay.svelte';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

  use([LineChart, CustomChart, GridComponent, TooltipComponent, MarkAreaComponent, MarkLineComponent, CanvasRenderer]);

  let {
    windChartData = null,
    maxAltitude = $bindable<MaxAltitude>(4000),
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

  let windHeight = $derived(getWindChartHeight(maxAltitude));
  let totalHeight = $derived(getChartHeight(windHeight));

  // ─── Svelte action ────────────────────────────────────────────────────────

  type RenderChartParams = {
    data: WindChartData | null;
    windHeight: number;
    maxAltitude: MaxAltitude;
    model: WeatherModel;
    daylightOnly: boolean;
  };

  function renderChart(node: HTMLElement, params: RenderChartParams) {
    let chart: EChartsType | null = init(node);
    let worker: Worker | null = null;
    let workerBusy = false;
    let requestId = 0;
    let destroyed = false;
    let pendingRender: { requestId: number; params: RenderChartParams } | null = null;
    let prevData = params.data;
    let prevDaylightOnly = params.daylightOnly;
    const activeState: ActiveState = createActiveState();

    function handleAxisPointer(event: unknown) {
      const e = event as { axesInfo?: Array<{ axisDim: string; axisIndex: number; value: number }> };
      const axes = e?.axesInfo;
      if (!axes?.length) {
        activeState.gridIndex = -1;
        activeState.hoveredWindPressure = null;
        return;
      }
      const yInfo = axes.find((axis) => axis.axisDim === 'y');
      if (!yInfo) {
        activeState.gridIndex = -1;
        activeState.hoveredWindPressure = null;
        return;
      }
      if (yInfo.axisIndex <= 1) {
        activeState.gridIndex = 0;
        activeState.hoveredWindPressure = null;
      } else if (yInfo.axisIndex === 2) {
        activeState.gridIndex = 1;
        activeState.hoveredWindPressure = null;
      } else {
        activeState.gridIndex = 2;
        activeState.hoveredWindPressure = yInfo.value;
      }
    }

    chart.on('updateaxispointer', handleAxisPointer);

    const resizeObserver = new ResizeObserver(() => chart?.resize());
    resizeObserver.observe(node);

    function terminateWorker(target: Worker) {
      target.onmessage = null;
      target.onerror = null;
      target.onmessageerror = null;
      target.terminate();
      if (worker === target) {
        worker = null;
        workerBusy = false;
      }
    }

    function terminateCurrentWorker() {
      if (!worker) return;
      terminateWorker(worker);
    }

    function handleWorkerMessage(source: Worker, event: MessageEvent<ChartWorkerOutput>) {
      if (worker !== source) return;
      workerBusy = false;

      const response = event.data;
      const render = pendingRender;
      if (destroyed || response.requestId !== requestId || render?.requestId !== response.requestId || !chart) {
        return;
      }
      pendingRender = null;

      try {
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

        activeState.gridIndex = -1;
        activeState.hoveredWindPressure = null;

        const store = buildTooltipStore(temperatureChartData, rainCloudChartData, windData, lcl);
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
            render.params.windHeight,
            render.params.maxAltitude,
            render.params.model,
            modelGridElevation
          ),
          { notMerge: true }
        );
      } catch (err) {
        console.error('Error updating EChart:', err);
      } finally {
        if (!destroyed && response.requestId === requestId) isRendering = false;
      }
    }

    function handleWorkerError(source: Worker, error: unknown) {
      if (worker !== source) return;
      terminateWorker(source);
      pendingRender = null;
      if (!destroyed) {
        console.error('Chart worker error:', error);
        isRendering = false;
      }
    }

    function createWorker() {
      const nextWorker = new Worker(new URL('$lib/workers/chartWorker.ts', import.meta.url), { type: 'module' });
      nextWorker.onmessage = (event: MessageEvent<ChartWorkerOutput>) => handleWorkerMessage(nextWorker, event);
      nextWorker.onerror = (error) => handleWorkerError(nextWorker, error);
      nextWorker.onmessageerror = (error) => handleWorkerError(nextWorker, error);
      return nextWorker;
    }

    function draw(currentParams: RenderChartParams) {
      if (!currentParams.data) return;

      const currentRequestId = ++requestId;
      if (workerBusy) terminateCurrentWorker();
      worker ??= createWorker();
      workerBusy = true;
      pendingRender = { requestId: currentRequestId, params: currentParams };
      isRendering = true;

      const request: ChartWorkerRequest = {
        requestId: currentRequestId,
        input: {
          windChartData: currentParams.data,
          maxAltitude: currentParams.maxAltitude,
          model: currentParams.model,
          daylightOnly: currentParams.daylightOnly,
        },
      };

      try {
        worker.postMessage(request);
      } catch (err) {
        handleWorkerError(worker, err);
      }
    }

    if (params.data) draw({ ...params });

    return {
      update(newParams: RenderChartParams) {
        if (newParams.data !== prevData || newParams.daylightOnly !== prevDaylightOnly) {
          prevData = newParams.data;
          prevDaylightOnly = newParams.daylightOnly;
          if (newParams.data) {
            draw({ ...newParams });
          } else {
            requestId++;
            terminateCurrentWorker();
            pendingRender = null;
            activeState.gridIndex = -1;
            activeState.hoveredWindPressure = null;
            chart?.clear();
            isRendering = false;
          }
        }
      },
      destroy() {
        destroyed = true;
        requestId++;
        terminateCurrentWorker();
        pendingRender = null;
        resizeObserver.disconnect();
        chart?.off('updateaxispointer', handleAxisPointer);
        chart?.dispose();
        chart = null;
        isRendering = false;
      },
    };
  }
</script>

<div class="chart-container" style="min-height: {totalHeight}px;">
  <ChartLoadingOverlay visible={isBusy} message="Loading weather data…" />

  <label
    class="group absolute left-0 z-[5] flex h-5 w-[54px] items-center rounded border border-transparent bg-white text-[10px] transition hover:border-slate-200 hover:bg-slate-50 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
    style="top: {WIND_TOP - 10}px;"
  >
    <select
      bind:value={maxAltitude}
      aria-label="Wind chart top height"
      title="Wind chart top height"
      class="h-full w-full cursor-pointer appearance-none border-0 bg-transparent py-0 pr-3 pl-0 text-right font-medium text-slate-600 outline-none"
    >
      {#each MAX_ALTITUDE_OPTIONS as option (option.value)}
        <option value={option.value}>{option.value}m</option>
      {/each}
    </select>
    <ChevronDownIcon
      class="pointer-events-none absolute right-0.5 h-3 w-3 text-slate-300 transition group-hover:text-slate-500"
      aria-hidden="true"
    />
  </label>

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

  @media (max-width: 768px) {
    .chart-container {
      padding: 0;
    }
  }
</style>
