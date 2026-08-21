<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    renderSkewT,
    renderHoverOverlay,
    SKEWT_PLOT_TOP,
    type HitTestResult,
    type PlotLayout,
  } from '$lib/charts/skewTRenderer';
  import { CHART_COLORS } from '$lib/charts/chartColors';
  import { MAX_ALTITUDE_OPTIONS, type MaxAltitude, type SkewTData } from '$lib/meteo/types';
  import type { WeatherModel } from '$lib/api/types';
  import { getTopPressureForModel } from '$lib/meteo/pressureLevels';
  import ChartLoadingOverlay from '$lib/components/ChartLoadingOverlay.svelte';
  import ThermalSummary from '$lib/components/ThermalSummary.svelte';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

  export let skewTData: SkewTData | null = null;
  export let hour = 0; // index into traces array
  export let maxAltitude: MaxAltitude = 4000;
  export let model: WeatherModel = 'icon_seamless';
  export let isLoading = false;

  const totalHeight = 520;

  $: topPressureOptions = MAX_ALTITUDE_OPTIONS.map((option) => ({
    ...option,
    pressure: getTopPressureForModel(model, option.value),
  }));

  let canvas: HTMLCanvasElement | undefined;
  let overlayCanvas: HTMLCanvasElement | undefined;
  let container: HTMLDivElement | undefined;
  let hitTest: ((cx: number, cy: number) => HitTestResult | null) | null = null;
  let lastLayout: PlotLayout | null = null;
  let currentTrace: SkewTData['traces'][number] | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function canvasSize() {
    const dpr = window.devicePixelRatio || 1;
    const width = container?.clientWidth || 600;
    return { dpr, width };
  }

  const legendItems: Array<{
    label: string;
    color: string;
    dash: boolean;
    opacity?: number;
    fill?: boolean;
  }> = [
    { label: 'Temperature', color: CHART_COLORS.temperature, dash: false },
    { label: 'Dewpoint', color: CHART_COLORS.dewpoint, dash: false },
    { label: 'Dry adiabat', color: CHART_COLORS.dryAdiabat, dash: true, opacity: 0.7 },
    { label: 'Moist adiabat', color: CHART_COLORS.moistAdiabat, dash: true, opacity: 0.6 },
    { label: 'Isohume', color: CHART_COLORS.isohume, dash: true, opacity: 0.65 },
    { label: 'Surface parcel', color: CHART_COLORS.thermalParcel, dash: true, opacity: 0.9 },
    { label: 'Buoyant layer', color: CHART_COLORS.thermalTop, dash: false, opacity: 0.14, fill: true },
  ];

  function render() {
    if (!canvas || !overlayCanvas || !skewTData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { dpr, width } = canvasSize();
    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, totalHeight);

    const result = renderSkewT(ctx, skewTData, hour, width, totalHeight);
    hitTest = result?.hitTest ?? null;
    lastLayout = result?.layout ?? null;
    currentTrace = result?.layout ? (skewTData.traces[hour] ?? skewTData.traces[0]) : null;

    const overlayCtx = overlayCanvas.getContext('2d');
    if (overlayCtx) {
      overlayCanvas.width = width * dpr;
      overlayCanvas.height = totalHeight * dpr;
      overlayCanvas.style.width = `${width}px`;
      overlayCanvas.style.height = `${totalHeight}px`;
      overlayCtx.scale(dpr, dpr);
      overlayCtx.clearRect(0, 0, width, totalHeight);
    }
  }

  $: if (canvas && skewTData && (hour, true)) render();

  onMount(() => {
    if (!container) return;
    resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(container);
    document.addEventListener('pointerdown', handleDocumentPointerDown);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    document.removeEventListener('pointerdown', handleDocumentPointerDown);
  });

  function showSelection(e: MouseEvent) {
    if (!hitTest || !canvas || !overlayCanvas || !currentTrace || !lastLayout || !skewTData) return;
    const rect = canvas.getBoundingClientRect();
    const result = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (!result) {
      clearOverlay();
      return;
    }

    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;
    const { dpr, width } = canvasSize();
    overlayCtx.save();
    overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlayCtx.clearRect(0, 0, width, totalHeight);
    renderHoverOverlay(overlayCtx, lastLayout, currentTrace, result, width);
    overlayCtx.restore();
  }

  function handlePointerMove(e: PointerEvent) {
    if (e.pointerType !== 'touch') showSelection(e);
  }

  function handleClick(e: MouseEvent) {
    if ((e as PointerEvent).pointerType === 'touch') showSelection(e);
  }

  function handlePointerCancel(e: PointerEvent) {
    if (e.pointerType === 'touch') clearOverlay();
  }

  function handlePointerLeave(e: PointerEvent) {
    if (e.pointerType === 'mouse') clearOverlay();
  }

  function handleDocumentPointerDown(e: PointerEvent) {
    if (e.target instanceof Node && !container?.contains(e.target)) clearOverlay();
  }

  function clearOverlay() {
    if (!overlayCanvas) return;
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;
    const { dpr, width } = canvasSize();
    overlayCtx.save();
    overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlayCtx.clearRect(0, 0, width, totalHeight);
    overlayCtx.restore();
  }
</script>

<div bind:this={container} class="skewt-chart-container" style="min-height: {totalHeight}px;">
  <ChartLoadingOverlay visible={isLoading} message="Loading sounding data…" />

  <div class="chart-wrapper" style="position: relative;">
    <label
      class="group absolute left-0 z-[5] flex h-5 w-[58px] items-center rounded border border-transparent bg-white text-[10px] transition hover:border-slate-200 hover:bg-slate-50 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
      style="top: {SKEWT_PLOT_TOP - 10}px;"
    >
      <select
        bind:value={maxAltitude}
        aria-label="Skew-T top height"
        title="Skew-T top height: {maxAltitude}m"
        class="h-full w-full cursor-pointer appearance-none border-0 bg-transparent py-0 pr-3 pl-0 text-right font-medium text-slate-600 outline-none"
      >
        {#each topPressureOptions as option (option.value)}
          <option value={option.value}>{option.pressure}hPa</option>
        {/each}
      </select>
      <ChevronDownIcon
        class="pointer-events-none absolute right-0.5 h-3 w-3 text-slate-300 transition group-hover:text-slate-500"
        aria-hidden="true"
      />
    </label>

    <canvas
      bind:this={canvas}
      onpointermove={handlePointerMove}
      onclick={handleClick}
      onpointercancel={handlePointerCancel}
      onpointerleave={handlePointerLeave}
      class="chart-canvas"
    ></canvas>
    <canvas bind:this={overlayCanvas} class="overlay-canvas"></canvas>
  </div>

  <div class="skewt-legend">
    {#each legendItems as item (item.label)}
      <span class="legend-item">
        <svg width="24" height="12" viewBox="0 0 24 12">
          {#if item.fill}
            <rect x="0" y="2" width="24" height="8" rx="2" fill={item.color} opacity={item.opacity ?? 1} />
          {:else}
            <line
              x1="0"
              y1="6"
              x2="24"
              y2="6"
              stroke={item.color}
              stroke-width="2"
              stroke-dasharray={item.dash ? '4,2' : '0'}
              opacity={item.opacity ?? 1}
            />
          {/if}
        </svg>
        <span class="legend-label">{item.label}</span>
      </span>
    {/each}
  </div>

  {#if skewTData?.traces[hour] ?? skewTData?.traces[0]}
    {@const trace = skewTData?.traces[hour] ?? skewTData?.traces[0]}
    {#if trace}
      <ThermalSummary {trace} {model} />
    {/if}
  {/if}
</div>

<style>
  .skewt-chart-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    position: relative;
  }

  .chart-canvas {
    display: block;
    width: 100%;
    cursor: crosshair;
    touch-action: pan-y pinch-zoom;
  }

  .overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }

  .skewt-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    justify-content: center;
    padding: 8px 0 0;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-label {
    font-size: 11px;
    color: #666;
  }
</style>
