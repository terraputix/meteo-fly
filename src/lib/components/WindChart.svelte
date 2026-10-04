<script lang="ts">
  import { buildTooltipStore, formatTooltip, snapToNearest, type TooltipStore } from '#lib/charts/tooltipFormatter.js';
  import {
    DAYLIGHT_CONTEXT_TOP,
    WIND_TOP,
    buildWindChartLayout,
    type PreparedWindChart,
    type WindChartLayout,
  } from '#lib/charts/windChartLayout.js';
  import { renderWindChart, renderWindChartOverlay } from '#lib/charts/windChartRenderer.js';
  import { getWindChartSize } from '#lib/charts/chartSizing.js';
  import type { WindChartData } from '#lib/api/types.js';
  import type { ChartWorkerOutput, ChartWorkerRequest } from '#lib/workers/chartWorker.types.js';
  import type { WeatherModel } from '#lib/api/types.js';
  import { MAX_ALTITUDE_OPTIONS, type MaxAltitude } from '#lib/meteo/types.js';
  import ChartLoadingOverlay from '#lib/components/ChartLoadingOverlay.svelte';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import FoldHorizontalIcon from '@lucide/svelte/icons/fold-horizontal';
  import UnfoldHorizontalIcon from '@lucide/svelte/icons/unfold-horizontal';

  let {
    windChartData = null,
    maxAltitude = $bindable<MaxAltitude>(4000),
    model = 'icon_seamless',
    isLoading = false,
    daylightOnly = $bindable(false),
  }: {
    windChartData: WindChartData | null;
    maxAltitude: MaxAltitude;
    model: WeatherModel;
    isLoading: boolean;
    daylightOnly?: boolean;
  } = $props();

  let isRendering = $state(false);
  let renderError = $state('');

  let isBusy = $derived(isLoading || isRendering);

  let availableWidth = $state(600);
  let availableHeight = $state(0);
  let chartSize = $derived(getWindChartSize(availableWidth, availableHeight, maxAltitude));

  type RenderChartParams = {
    data: WindChartData | null;
    maxAltitude: MaxAltitude;
    model: WeatherModel;
    daylightOnly: boolean;
    loading: boolean;
  };

  function renderChart(node: HTMLElement, params: RenderChartParams) {
    const canvas = node.querySelector<HTMLCanvasElement>('canvas')!;
    const overlay = node.querySelector<HTMLCanvasElement>('canvas[data-overlay]')!;
    const tooltip = node.querySelector<HTMLDivElement>('[role="tooltip"]')!;
    let worker: Worker | null = null;
    let workerBusy = false;
    let requestId = 0;
    let destroyed = false;
    let prepared: PreparedWindChart | null = null;
    let layout: WindChartLayout | null = null;
    let store: TooltipStore | null = null;
    let baseFrame = 0;
    let pointerFrame = 0;
    let dpr = window.devicePixelRatio || 1;
    let resolutionQuery: MediaQueryList;

    function clearSelection() {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      tooltip.hidden = true;
      overlay.getContext('2d')?.clearRect(0, 0, node.clientWidth, node.clientHeight);
    }

    function paint() {
      baseFrame = 0;
      if (destroyed) return;
      clearSelection();
      layout = null;
      dpr = window.devicePixelRatio || 1;
      for (const target of [canvas, overlay]) {
        target.width = Math.round(node.clientWidth * dpr);
        target.height = Math.round(node.clientHeight * dpr);
        target.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (!prepared) return;
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D is unavailable');
        layout = buildWindChartLayout(prepared, node.clientWidth, node.clientHeight, params.maxAltitude, params.model);
        renderWindChart(ctx, prepared, layout);
      } catch (error) {
        layout = null;
        renderError = 'Unable to draw the weather chart.';
        console.error('Chart render error:', error);
      } finally {
        isRendering = false;
      }
    }

    function schedulePaint() {
      if (!baseFrame) baseFrame = requestAnimationFrame(paint);
    }

    function watchResolution() {
      resolutionQuery?.removeEventListener('change', resolutionChanged);
      resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolutionQuery.addEventListener('change', resolutionChanged);
    }
    function resolutionChanged() {
      watchResolution();
      schedulePaint();
    }
    watchResolution();
    const resizeObserver = new ResizeObserver(schedulePaint);
    resizeObserver.observe(node);

    function terminateWorker() {
      if (!worker) return;
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      worker = null;
      workerBusy = false;
    }

    function fail(source: Worker | null, error: unknown) {
      if (destroyed || source !== worker) return;
      terminateWorker();
      prepared = null;
      store = null;
      isRendering = false;
      renderError = 'Unable to prepare the weather chart.';
      console.error('Chart worker error:', error);
      schedulePaint();
    }

    function prepare() {
      requestId++;
      clearSelection();
      prepared = null;
      store = null;
      layout = null;
      renderError = '';
      if (workerBusy || !params.data) terminateWorker();
      if (!params.data) {
        isRendering = false;
        schedulePaint();
        return;
      }
      isRendering = true;
      try {
        if (!worker) {
          const source = new Worker(new URL('#lib/workers/chartWorker.ts', import.meta.url), { type: 'module' });
          worker = source;
          source.onmessage = (event: MessageEvent<ChartWorkerOutput>) => {
            const response = event.data;
            if (destroyed || worker !== source || response.requestId !== requestId) return;
            workerBusy = false;
            if (!response.success) {
              fail(source, response.error);
              return;
            }
            try {
              prepared = response.data;
              store = buildTooltipStore(
                prepared.temperatureChartData,
                prepared.rainCloudChartData,
                prepared.windData,
                prepared.lcl
              );
              schedulePaint();
            } catch (error) {
              fail(source, error);
            }
          };
          source.onerror = (error) => fail(source, error);
          source.onmessageerror = (error) => fail(source, error);
        }
        workerBusy = true;
        const request: ChartWorkerRequest = {
          requestId,
          input: {
            windChartData: params.data,
            maxAltitude: params.maxAltitude,
            model: params.model,
            daylightOnly: params.daylightOnly,
          },
        };
        worker.postMessage(request);
      } catch (error) {
        fail(worker, error);
      }
    }

    function showSelection(clientX: number, clientY: number) {
      if (!prepared || !layout || !store || params.loading || isRendering) return;
      const rect = node.getBoundingClientRect();
      const px = ((clientX - rect.left) * node.clientWidth) / rect.width;
      const py = ((clientY - rect.top) * node.clientHeight) / rect.height;
      const hit = layout.hitTest(px, py);
      const ctx = overlay.getContext('2d');
      if (!hit || !ctx) {
        clearSelection();
        return;
      }
      const time = snapToNearest(store.sortedTimes, hit.time);
      if (time == null) {
        clearSelection();
        return;
      }
      const pressure =
        hit.hoveredWindPressure == null ? null : snapToNearest(store.sortedWindPressures, hit.hoveredWindPressure);
      renderWindChartOverlay(ctx, layout, time, hit.gridIndex, pressure == null ? py : layout.pressureY(pressure));
      tooltip.innerHTML = formatTooltip(store, hit, prepared.timezone, time);
      tooltip.hidden = false;
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const preferredX = px + 14 + tooltipWidth <= rect.width ? px + 14 : px - tooltipWidth - 14;
      tooltip.style.left = `${Math.max(0, Math.min(node.clientWidth - tooltipWidth, preferredX))}px`;
      tooltip.style.top = `${Math.max(0, Math.min(node.clientHeight - tooltipHeight, py + 14))}px`;
    }

    function pointerMove(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        showSelection(event.clientX, event.clientY);
      });
    }
    function click(event: PointerEvent) {
      if (event.pointerType === 'touch') showSelection(event.clientX, event.clientY);
    }
    function pointerLeave(event: PointerEvent) {
      if (event.pointerType !== 'touch') clearSelection();
    }
    function outsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !node.contains(event.target)) clearSelection();
    }
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('click', click);
    canvas.addEventListener('pointerleave', pointerLeave);
    canvas.addEventListener('pointercancel', clearSelection);
    document.addEventListener('pointerdown', outsidePointer);
    prepare();

    return {
      update(next: RenderChartParams) {
        const changed =
          next.data !== params.data ||
          next.daylightOnly !== params.daylightOnly ||
          next.maxAltitude !== params.maxAltitude ||
          next.model !== params.model;
        params = next;
        if (params.loading) clearSelection();
        if (changed) prepare();
      },
      destroy() {
        destroyed = true;
        requestId++;
        terminateWorker();
        cancelAnimationFrame(baseFrame);
        clearSelection();
        resizeObserver.disconnect();
        resolutionQuery.removeEventListener('change', resolutionChanged);
        canvas.removeEventListener('pointermove', pointerMove);
        canvas.removeEventListener('click', click);
        canvas.removeEventListener('pointerleave', pointerLeave);
        canvas.removeEventListener('pointercancel', clearSelection);
        document.removeEventListener('pointerdown', outsidePointer);
        isRendering = false;
      },
    };
  }
</script>

<div
  class="relative flex-1 shrink-0"
  style="min-height: {getWindChartSize(availableWidth, 0, maxAltitude).height}px;"
  bind:clientWidth={availableWidth}
  bind:clientHeight={availableHeight}
>
  <div class="chart-container" style="width: {chartSize.width}px; height: {chartSize.height}px;">
    <ChartLoadingOverlay visible={isBusy} message="Loading weather data…" />

    <label
      class="group absolute left-0 z-[5] flex h-5 w-[54px] items-center rounded border border-transparent bg-white text-[10px] transition hover:border-slate-200 hover:bg-slate-50 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
      style="top: {WIND_TOP - 10}px;"
    >
      <select
        bind:value={maxAltitude}
        aria-label="Wind chart top height"
        title="Wind chart top height"
        class="h-full w-full cursor-pointer appearance-none border-0 bg-transparent py-0 pr-4 pl-0 text-right font-semibold text-slate-700 outline-none"
      >
        {#each MAX_ALTITUDE_OPTIONS as option (option.value)}
          <option value={option.value}>{option.value}m</option>
        {/each}
      </select>
      <ChevronDownIcon
        class="pointer-events-none absolute right-0.5 h-3 w-3 text-slate-500 transition group-hover:text-slate-700"
        aria-hidden="true"
      />
    </label>

    <button
      type="button"
      aria-pressed={daylightOnly}
      aria-label={daylightOnly ? 'Extend chart to full day' : 'Compress chart to daylight hours'}
      title={daylightOnly ? 'Extend to full day' : 'Compress to daylight hours'}
      class="absolute left-1 z-[5] flex h-5 w-5 items-center justify-center rounded-full bg-slate-100/80 text-slate-400 transition hover:bg-amber-50 hover:text-amber-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset focus-visible:outline-none"
      style="top: {DAYLIGHT_CONTEXT_TOP + 6}px;"
      onclick={() => (daylightOnly = !daylightOnly)}
    >
      {#if daylightOnly}
        <UnfoldHorizontalIcon class="h-3 w-3" aria-hidden="true" />
      {:else}
        <FoldHorizontalIcon class="h-3 w-3" aria-hidden="true" />
      {/if}
    </button>

    <div
      use:renderChart={{ data: windChartData, maxAltitude, model, daylightOnly, loading: isLoading }}
      class="chart-content"
      style="opacity: {isBusy ? 0 : 1};"
    >
      <canvas
        class="h-full w-full touch-pan-y touch-pinch-zoom cursor-crosshair"
        aria-label="Weather meteogram: temperature, humidity, rain, clouds and wind by altitude"
      ></canvas>
      <canvas data-overlay class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"></canvas>
      <div
        role="tooltip"
        hidden
        class="pointer-events-none absolute z-10 max-h-[80vh] max-w-[min(260px,100%)] overflow-y-auto rounded border border-[#ddd] bg-white/95 p-2 text-xs text-[#333] shadow-lg"
      ></div>
    </div>
    {#if renderError}
      <p role="status" class="absolute inset-x-0 top-4 z-10 bg-white p-3 text-center text-sm text-red-700">
        {renderError}
      </p>
    {/if}
  </div>
</div>

<style>
  .chart-container {
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 0;
    contain: layout;
  }

  .chart-content {
    position: absolute;
    inset: 0;
    height: 100%;
    width: 100%;
    transition: opacity 0.3s ease;
  }

  @media (max-width: 768px) {
    .chart-container {
      padding: 0;
    }
  }
</style>
