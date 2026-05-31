<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { renderSkewT, renderHoverOverlay, type HitTestResult, type PlotLayout } from '$lib/charts/skewTRenderer';
  import { CHART_COLORS } from '$lib/charts/chartColors';
  import type { SkewTData } from '$lib/meteo/types';

  export let skewTData: SkewTData | null = null;
  export let hour = 0; // index into traces array
  export let isLoading = false;

  const totalHeight = 520;

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

  const legendItems = [
    { label: 'Temperature', color: CHART_COLORS.temperature, dash: false },
    { label: 'Dewpoint', color: CHART_COLORS.dewpoint, dash: false },
    { label: 'Dry adiabat', color: CHART_COLORS.dryAdiabat, dash: true, opacity: 0.7 },
    { label: 'Moist adiabat', color: CHART_COLORS.moistAdiabat, dash: true, opacity: 0.6 },
    { label: 'Isohume', color: CHART_COLORS.isohume, dash: true, opacity: 0.65 },
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
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });

  function handleMouseMove(e: MouseEvent) {
    if (!hitTest || !canvas || !overlayCanvas || !currentTrace || !lastLayout) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const result = hitTest(x, y);
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
    renderHoverOverlay(overlayCtx, lastLayout, currentTrace, result, width, skewTData!.elevation);
    overlayCtx.restore();
  }

  function handleMouseLeave() {
    clearOverlay();
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
  <div class="loading-state" class:loading-state--visible={isLoading} aria-hidden={!isLoading}>
    <div class="loading-spinner"></div>
    <p>Loading sounding data…</p>
  </div>

  <div class="chart-wrapper" style="position: relative;">
    <canvas bind:this={canvas} on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave} class="chart-canvas"
    ></canvas>
    <canvas bind:this={overlayCanvas} class="overlay-canvas"></canvas>
  </div>

  <div class="skewt-legend">
    {#each legendItems as item (item.label)}
      <span class="legend-item">
        <svg width="24" height="12" viewBox="0 0 24 12">
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
        </svg>
        <span class="legend-label">{item.label}</span>
      </span>
    {/each}
  </div>
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
  }

  .overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
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
