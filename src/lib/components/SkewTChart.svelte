<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { renderSkewT, renderHoverOverlay, type HitTestResult, type PlotLayout } from '$lib/charts/skewTRenderer';
  import { CHART_COLORS } from '$lib/charts/chartColors';
  import { clampIndex, createSkewTLevelSelection, findNearestIndex } from '$lib/charts/chartAccessibility';
  import type { SkewTData } from '$lib/meteo/types';
  import ChartLoadingOverlay from '$lib/components/ChartLoadingOverlay.svelte';

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
  let activePointerId: number | null = null;
  let selectedLevelIndex = 0;
  let selectedResult: HitTestResult | null = null;
  let selectionVisible = false;

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

    const levels = orderedLevels();
    if (levels.length > 0) {
      selectedLevelIndex = clampIndex(selectedLevelIndex, levels.length);
      selectedResult = createSkewTLevelSelection(levels[selectedLevelIndex]);
      if (selectionVisible) renderSelection(selectedResult);
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

  function orderedLevels() {
    return currentTrace ? [...currentTrace.levels].sort((a, b) => a.heightMeters - b.heightMeters) : [];
  }

  function renderSelection(result: HitTestResult) {
    if (!overlayCanvas || !currentTrace || !lastLayout || !skewTData) return;
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;
    const { dpr, width } = canvasSize();
    overlayCtx.save();
    overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlayCtx.clearRect(0, 0, width, totalHeight);
    renderHoverOverlay(overlayCtx, lastLayout, currentTrace, result, width, skewTData.elevation);
    overlayCtx.restore();
  }

  function selectPointerPosition(e: PointerEvent) {
    if (!hitTest || !canvas || !overlayCanvas || !currentTrace || !lastLayout) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const result = hitTest(x, y);
    if (!result) {
      clearOverlay();
      return;
    }
    const levels = orderedLevels();
    selectedLevelIndex = findNearestIndex(
      levels.map((level) => level.heightMeters),
      result.heightMeters
    );
    selectedResult = result;
    selectionVisible = true;
    renderSelection(result);
  }

  function handlePointerDown(e: PointerEvent) {
    activePointerId = e.pointerId;
    canvas?.setPointerCapture(e.pointerId);
    selectPointerPosition(e);
  }

  function handlePointerMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse' && activePointerId !== e.pointerId) return;
    selectPointerPosition(e);
  }

  function handlePointerUp(e: PointerEvent) {
    if (activePointerId !== e.pointerId) return;
    if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    activePointerId = null;
  }

  function handlePointerLeave(e: PointerEvent) {
    if (e.pointerType === 'mouse' && activePointerId === null) {
      selectionVisible = false;
      clearOverlay();
    }
  }

  function selectLevel(index: number) {
    const levels = orderedLevels();
    if (levels.length === 0) return;
    selectedLevelIndex = clampIndex(index, levels.length);
    selectedResult = createSkewTLevelSelection(levels[selectedLevelIndex]);
    selectionVisible = true;
    renderSelection(selectedResult);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!skewTData || !currentTrace) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const increment = e.key === 'ArrowLeft' ? -1 : 1;
      hour = clampIndex(hour + increment, skewTData.traces.length);
      selectionVisible = true;
      return;
    }

    const levels = orderedLevels();
    if (levels.length === 0) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectLevel(selectedLevelIndex + 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectLevel(selectedLevelIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectLevel(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectLevel(levels.length - 1);
    }
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

  <button
    type="button"
    class="chart-wrapper block w-full border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    style="position: relative;"
    aria-label="Skew-T atmospheric sounding chart"
    onkeydown={handleKeydown}
  >
    <canvas
      bind:this={canvas}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
      onpointerleave={handlePointerLeave}
      class="chart-canvas"
      aria-hidden="true"
    ></canvas>
    <canvas bind:this={overlayCanvas} class="overlay-canvas" aria-hidden="true"></canvas>
  </button>

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
    touch-action: none;
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
