<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { renderSkewT, type HitTestResult } from '$lib/charts/skewTRenderer';
  import { CHART_COLORS } from '$lib/charts/chartColors';
  import { windColorScale } from '$lib/charts/scales';
  import type { SkewTData } from '$lib/meteo/types';

  export let skewTData: SkewTData | null = null;
  export let selectedTraceIndex = 0;
  export let isLoading = false;

  const totalHeight = 520;

  let canvas: HTMLCanvasElement | undefined;
  let container: HTMLDivElement | undefined;
  let tooltipData: HitTestResult | null = null;
  let tooltipPos = { x: 0, y: 0 };
  let showTooltip = false;
  let hitTest: ((cx: number, cy: number) => HitTestResult | null) | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const legendItems = [
    { label: 'Temperature', color: CHART_COLORS.temperature, dash: false },
    { label: 'Dewpoint', color: CHART_COLORS.dewpoint, dash: false },
    { label: 'Parcel', color: '#f80', dash: true },
    { label: 'LCL', color: CHART_COLORS.lcl, dash: true },
    { label: 'Dry adiabat', color: '#e55', dash: false },
    { label: 'Moist adiabat', color: '#55e', dash: true },
    { label: 'Wind (native)', color: windColorScale(20), dash: false, opacity: 1 },
    { label: 'Wind (interp.)', color: windColorScale(20), dash: false, opacity: 0.4 },
  ];

  function render() {
    if (!canvas || !skewTData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = container?.clientWidth || 600;
    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, totalHeight);

    const result = renderSkewT(ctx, skewTData, selectedTraceIndex, width, totalHeight);
    hitTest = result?.hitTest ?? null;
  }

  $: if (canvas && skewTData) render();

  onMount(() => {
    if (!container) return;
    resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(container);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });

  function handleMouseMove(e: MouseEvent) {
    if (!hitTest || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const result = hitTest(x, y);
    if (result) {
      tooltipData = result;
      tooltipPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      showTooltip = true;
    } else {
      showTooltip = false;
    }
  }

  function handleMouseLeave() {
    showTooltip = false;
    tooltipData = null;
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

    {#if showTooltip && tooltipData}
      <div
        class="tooltip"
        style="left: {Math.min(tooltipPos.x + 12, (container?.clientWidth || 600) - 180)}px; top: {Math.max(
          tooltipPos.y - 10,
          0
        )}px;"
      >
        <div class="tooltip-line">{tooltipData.temperature.toFixed(1)}°C / {tooltipData.dewpoint.toFixed(1)}°C</div>
        <div class="tooltip-line">{tooltipData.windSpeed.toFixed(1)} km/h @ {tooltipData.windDirection}°</div>
        <div class="tooltip-line">
          {tooltipData.pressure} hPa &middot; {tooltipData.heightMeters} m{tooltipData.isNative ? '' : ' (interp.)'}
        </div>
      </div>
    {/if}
  </div>

  <div class="skewt-legend">
    {#each legendItems as item}
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

  .tooltip {
    position: absolute;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    line-height: 1.5;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    z-index: 20;
  }

  .tooltip-line {
    color: #333;
  }
</style>
