<script lang="ts">
  import { init, use, type EChartsType } from 'echarts/core';
  import { CustomChart, LineChart } from 'echarts/charts';
  import { GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';
  import {
    buildTooltipStore,
    createActiveState,
    type ActiveState,
    type TooltipStore,
  } from '$lib/charts/tooltipFormatter';
  import {
    clampIndex,
    createWindChartSelection,
    findNearestIndex,
    type WindChartSelection,
  } from '$lib/charts/chartAccessibility';
  import { buildWindChartOption, getChartHeight } from '$lib/charts/buildWindChartOption';
  import type { WindChartData } from '$lib/api/types';
  import type { ChartWorkerOutput, ChartWorkerRequest } from '$lib/workers/chartWorker.types';
  import type { WeatherModel } from '$lib/api/types';
  import type { MaxAltitude } from '$lib/meteo/types';
  import ChartLoadingOverlay from '$lib/components/ChartLoadingOverlay.svelte';

  use([LineChart, CustomChart, GridComponent, TooltipComponent, MarkAreaComponent, MarkLineComponent, CanvasRenderer]);

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
  let windSelection = $state<WindChartSelection | null>(null);

  let isBusy = $derived(isLoading || isRendering);

  let windHeight = $derived(Math.ceil(maxAltitude / 10));
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
    let tooltipStore: TooltipStore | null = null;
    const activeState: ActiveState = createActiveState();

    function setSelection(timeIndex: number, heightIndex: number) {
      if (!tooltipStore) return;
      windSelection = createWindChartSelection(tooltipStore, timeIndex, heightIndex);
    }

    function setSelectionFromValues(timestamp: number, height: number | null) {
      if (!tooltipStore) return;
      const timeIndex = findNearestIndex(tooltipStore.sortedWindTimes, timestamp);
      const heightIndex =
        height == null ? (windSelection?.heightIndex ?? 0) : findNearestIndex(tooltipStore.sortedWindHeights, height);
      setSelection(timeIndex, heightIndex);
    }

    function showKeyboardSelection() {
      if (!chart || !windSelection || windSelection.height == null) return;
      const x = Number(chart.convertToPixel({ xAxisIndex: 2 }, windSelection.timestamp));
      const y = Number(chart.convertToPixel({ yAxisIndex: 3 }, windSelection.height));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      chart.dispatchAction({ type: 'updateAxisPointer', x, y });
    }

    function handleKeydown(event: KeyboardEvent) {
      if (!tooltipStore || tooltipStore.sortedWindTimes.length === 0) return;
      const current = windSelection ?? createWindChartSelection(tooltipStore, 0, 0);
      if (!current) return;

      let timeIndex = current.timeIndex;
      let heightIndex = current.heightIndex;
      if (event.key === 'ArrowLeft') timeIndex--;
      else if (event.key === 'ArrowRight') timeIndex++;
      else if (event.key === 'ArrowDown') heightIndex--;
      else if (event.key === 'ArrowUp') heightIndex++;
      else if (event.key === 'Home') timeIndex = 0;
      else if (event.key === 'End') timeIndex = tooltipStore.sortedWindTimes.length - 1;
      else return;

      event.preventDefault();
      setSelection(
        clampIndex(timeIndex, tooltipStore.sortedWindTimes.length),
        clampIndex(heightIndex, tooltipStore.sortedWindHeights.length)
      );
      showKeyboardSelection();
    }

    function handleAxisPointer(event: unknown) {
      const e = event as { axesInfo?: Array<{ axisDim: string; axisIndex: number; value: number }> };
      const axes = e?.axesInfo;
      if (!axes?.length) {
        activeState.gridIndex = -1;
        activeState.hoveredWindY = null;
        return;
      }
      const yInfo = axes.find((axis) => axis.axisDim === 'y');
      const xInfo = axes.find((axis) => axis.axisDim === 'x');
      if (xInfo) setSelectionFromValues(xInfo.value, yInfo?.axisIndex === 3 ? (yInfo.value ?? null) : null);
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
    }

    const keyboardTarget = node.parentElement;
    chart.on('updateaxispointer', handleAxisPointer);
    keyboardTarget?.addEventListener('keydown', handleKeydown);

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
        activeState.hoveredWindY = null;

        const store = buildTooltipStore(temperatureChartData, rainCloudChartData, windData, lcl);
        tooltipStore = store;
        setSelection(0, 0);
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
            activeState.hoveredWindY = null;
            chart?.clear();
            tooltipStore = null;
            windSelection = null;
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
        keyboardTarget?.removeEventListener('keydown', handleKeydown);
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

  <!-- Use a wrapper with fixed height to prevent layout shift -->
  <button
    type="button"
    class="block w-full border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    style="opacity: {isBusy ? 0 : 1}; height: {totalHeight}px;"
    aria-label="Wind forecast chart"
    aria-busy={isBusy}
  >
    <div
      use:renderChart={{ data: windChartData, windHeight, maxAltitude, model, daylightOnly }}
      class="chart-content"
      style="height: {totalHeight}px;"
    ></div>
  </button>
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
