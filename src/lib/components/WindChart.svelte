<script lang="ts">
  import { init, use, type EChartsType } from 'echarts/core';
  import { CustomChart, LineChart } from 'echarts/charts';
  import { GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';
  import { buildTooltipStore, createActiveState, type ActiveState } from '$lib/charts/tooltipFormatter';
  import { buildWindChartOption, getChartHeight } from '$lib/charts/buildWindChartOption';
  import type { WindChartData } from '$lib/api/types';
  import type { ChartWorkerInput, ChartWorkerOutput } from '$lib/workers/chartWorker.types';
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
    let activeWorker: Worker | null = null;
    let requestId = 0;
    let destroyed = false;
    let prevData = params.data;
    let prevDaylightOnly = params.daylightOnly;
    const activeState: ActiveState = createActiveState();

    function handleAxisPointer(event: unknown) {
      const e = event as { axesInfo?: Array<{ axisDim: string; axisIndex: number; value: number }> };
      const axes = e?.axesInfo;
      if (!axes?.length) {
        activeState.gridIndex = -1;
        activeState.hoveredWindY = null;
        return;
      }
      const yInfo = axes.find((axis) => axis.axisDim === 'y');
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

    chart.on('updateaxispointer', handleAxisPointer);

    const resizeObserver = new ResizeObserver(() => chart?.resize());
    resizeObserver.observe(node);

    function releaseWorker(worker: Worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      if (activeWorker === worker) activeWorker = null;
    }

    function cancelActiveWorker() {
      if (!activeWorker) return;
      releaseWorker(activeWorker);
    }

    function draw(currentParams: RenderChartParams) {
      if (!currentParams.data) return;

      const currentRequestId = ++requestId;
      cancelActiveWorker();
      isRendering = true;

      const worker = new Worker(new URL('$lib/workers/chartWorker.ts', import.meta.url), { type: 'module' });
      activeWorker = worker;

      worker.onmessage = (event: MessageEvent<ChartWorkerOutput>) => {
        releaseWorker(worker);
        if (destroyed || currentRequestId !== requestId || !chart) return;

        try {
          const response = event.data;
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
              currentParams.windHeight,
              currentParams.maxAltitude,
              currentParams.model,
              modelGridElevation
            ),
            { notMerge: true }
          );
        } catch (err) {
          console.error('Error updating EChart:', err);
        } finally {
          if (!destroyed && currentRequestId === requestId) isRendering = false;
        }
      };

      const handleWorkerError = (error: unknown) => {
        releaseWorker(worker);
        if (destroyed || currentRequestId !== requestId) return;
        console.error('Chart worker error:', error);
        isRendering = false;
      };

      worker.onerror = handleWorkerError;
      worker.onmessageerror = handleWorkerError;

      const input: ChartWorkerInput = {
        windChartData: currentParams.data,
        maxAltitude: currentParams.maxAltitude,
        model: currentParams.model,
        daylightOnly: currentParams.daylightOnly,
      };

      try {
        worker.postMessage(input);
      } catch (err) {
        handleWorkerError(err);
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
            cancelActiveWorker();
            activeState.gridIndex = -1;
            activeState.hoveredWindY = null;
            chart?.clear();
            isRendering = false;
          }
        }
      },
      destroy() {
        destroyed = true;
        requestId++;
        cancelActiveWorker();
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
