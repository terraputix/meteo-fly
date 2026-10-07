<script lang="ts">
  import { buildTooltipStore, formatTooltip, snapToNearest, type TooltipStore } from '#lib/charts/tooltipFormatter.js';
  import {
    DAYLIGHT_CONTEXT_TOP,
    WIND_TOP,
    buildWindChartLayout,
    windTooltipPosition,
    WIND_TOOLTIP_INSET,
    type PreparedWindChart,
    type WindChartLayout,
  } from '#lib/charts/windChartLayout.js';
  import { renderWindChart, renderWindChartOverlay, type WindAxisUnit } from '#lib/charts/windChartRenderer.js';
  import { getNativeLevelsForModel } from '#lib/meteo/pressureLevels.js';
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
  let axisUnit = $state<WindAxisUnit>('m');

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
    axisUnit: WindAxisUnit;
  };

  function renderChart(node: HTMLElement, params: RenderChartParams) {
    const canvas = node.querySelector<HTMLCanvasElement>('canvas')!;
    const overlay = node.querySelector<HTMLCanvasElement>('canvas[data-overlay]')!;
    const tooltip = node.querySelector<HTMLDivElement>('[role="tooltip"]')!;
    const scrollContainer = node.closest<HTMLElement>('[data-chart-scroll]');
    let worker: Worker | null = null;
    let workerBusy = false;
    let requestId = 0;
    let destroyed = false;
    let prepared: PreparedWindChart | null = null;
    let cloudImage: HTMLCanvasElement | null = null;
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
        renderWindChart(ctx, prepared, layout, params.axisUnit, cloudImage);
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
      cloudImage = null;
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
      cloudImage = null;
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
              const raster = prepared.cloudRaster;
              if (raster) {
                cloudImage = document.createElement('canvas');
                cloudImage.width = raster.width;
                cloudImage.height = raster.height;
                cloudImage
                  .getContext('2d')
                  ?.putImageData(new ImageData(raster.pixels, raster.width, raster.height), 0, 0);
              }
              store = buildTooltipStore(
                prepared.temperatureChartData,
                prepared.rainCloudChartData,
                prepared.windData,
                prepared.lcl,
                prepared.cloudData,
                getNativeLevelsForModel(params.model, params.maxAltitude).map((level) => level.hPa)
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
      const scaleX = node.clientWidth / rect.width;
      const scaleY = node.clientHeight / rect.height;
      const px = (clientX - rect.left) * scaleX;
      const py = (clientY - rect.top) * scaleY;
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
      const lclY = layout.lclYAt(px);
      const windPanel = layout.panels[2];
      const showLcl =
        hit.gridIndex === 2 &&
        lclY != null &&
        lclY >= windPanel.top &&
        lclY <= windPanel.top + windPanel.height &&
        Math.abs(py - lclY) <= 10;
      tooltip.innerHTML = formatTooltip(store, { ...hit, showLcl }, prepared.timezone, hit.time);
      tooltip.hidden = false;
      const visibleRect = scrollContainer?.getBoundingClientRect() ?? rect;
      const bounds = {
        left: Math.max(0, (Math.max(0, visibleRect.left) - rect.left) * scaleX),
        top: Math.max(0, (Math.max(0, visibleRect.top) - rect.top) * scaleY),
        right: Math.min(node.clientWidth, (Math.min(window.innerWidth, visibleRect.right) - rect.left) * scaleX),
        bottom: Math.min(node.clientHeight, (Math.min(window.innerHeight, visibleRect.bottom) - rect.top) * scaleY),
      };
      const inset = WIND_TOOLTIP_INSET;
      tooltip.style.maxWidth = `${Math.max(0, bounds.right - bounds.left - 2 * inset)}px`;
      tooltip.style.maxHeight = `${Math.max(0, bounds.bottom - bounds.top - 2 * inset)}px`;
      const position = windTooltipPosition(
        { x: px, y: py },
        { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
        bounds
      );
      tooltip.style.left = `${position.left}px`;
      tooltip.style.top = `${position.top}px`;
    }

    function pointerMove(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        showSelection(event.clientX, event.clientY);
      });
    }
    function pointerUp(event: PointerEvent) {
      if (event.pointerType === 'touch' && event.isPrimary) showSelection(event.clientX, event.clientY);
    }
    function pointerLeave(event: PointerEvent) {
      if (event.pointerType !== 'touch') clearSelection();
    }
    function outsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !node.contains(event.target)) clearSelection();
    }
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointerleave', pointerLeave);
    canvas.addEventListener('pointercancel', clearSelection);
    document.addEventListener('pointerdown', outsidePointer);
    scrollContainer?.addEventListener('scroll', clearSelection);
    prepare();

    return {
      update(next: RenderChartParams) {
        const axisChanged = next.axisUnit !== params.axisUnit;
        const changed =
          next.data !== params.data ||
          next.daylightOnly !== params.daylightOnly ||
          next.maxAltitude !== params.maxAltitude ||
          next.model !== params.model;
        params = next;
        if (params.loading) clearSelection();
        if (changed) prepare();
        else if (axisChanged) schedulePaint();
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
        canvas.removeEventListener('pointerup', pointerUp);
        canvas.removeEventListener('pointerleave', pointerLeave);
        canvas.removeEventListener('pointercancel', clearSelection);
        document.removeEventListener('pointerdown', outsidePointer);
        scrollContainer?.removeEventListener('scroll', clearSelection);
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
      style="top: {WIND_TOP - 20}px;"
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

    <button
      type="button"
      aria-pressed={axisUnit === 'hPa'}
      aria-label="Use pressure scale instead of metres"
      title={axisUnit === 'm' ? 'Switch scale to pressure (hPa)' : 'Switch scale to altitude (m)'}
      class="absolute bottom-1 left-0 z-[5] flex h-6 w-[54px] items-center justify-center gap-1 rounded text-[10px] text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
      onclick={() => (axisUnit = axisUnit === 'm' ? 'hPa' : 'm')}
    >
      <span class:font-semibold={axisUnit === 'm'} class:text-slate-800={axisUnit === 'm'}>m</span>
      <span aria-hidden="true">/</span>
      <span class:font-semibold={axisUnit === 'hPa'} class:text-slate-800={axisUnit === 'hPa'}>hPa</span>
    </button>

    <div
      use:renderChart={{ data: windChartData, maxAltitude, model, daylightOnly, loading: isLoading, axisUnit }}
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
        class="pointer-events-none absolute z-10 w-max max-w-full max-h-[80vh] overflow-y-auto rounded-md border border-slate-200/80 bg-white/95 px-2 py-1.5 text-[11px] leading-snug text-slate-700 shadow-lg shadow-slate-900/10 tabular-nums"
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
