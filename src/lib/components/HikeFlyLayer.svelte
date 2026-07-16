<script lang="ts">
  import type { MapLayerMouseEvent } from 'maplibre-gl';
  import { onDestroy } from 'svelte';
  import { isMobile } from '$lib/stores/media';
  import { HIKE_FLY_DEFAULT_GLIDE_RATIO, HIKE_FLY_DEFAULT_STEP_M } from '$lib/meteo/hikeAndFly';
  import { resolveTileUrlPattern } from '$lib/meteo/dem';
  import { HikeFlyWorkerController } from '$lib/workers/hikeFlyWorkerController';

  let {
    map,
    active = $bindable(),
    takeoff = $bindable<{ latitude: number; longitude: number; elevation: number } | null>(null),
    glideRatio = $bindable<number>(HIKE_FLY_DEFAULT_GLIDE_RATIO as number),
    stepMeters = $bindable<number>(HIKE_FLY_DEFAULT_STEP_M as number),
  } = $props();

  const hikeFlySourceId = 'hike-fly-source';
  const hikeFlyLayerId = 'hike-fly-layer';
  const hikeFlyTakeoffSourceId = 'hike-fly-takeoff-source';
  const hikeFlyTakeoffLayerId = 'hike-fly-takeoff-layer';

  let isComputing = $state(false);

  let computeGeneration = 0;
  let computeTimeout: ReturnType<typeof setTimeout> | null = null;
  let resolvedTilePattern: string | null = null;

  function scheduleCompute() {
    if (computeTimeout) clearTimeout(computeTimeout);
    computeGeneration++;
    workerController.invalidate();
    hoveredFeature = null;
    hoverPos = null;
    const gen = computeGeneration;
    computeTimeout = setTimeout(() => {
      if (gen === computeGeneration) computeAndRender(gen);
    }, 200);
  }

  function teardownHover() {
    workerController.cancelLookup();
    if (!map) return;
    map.off('mousemove', onLayerHover);
    map.off('mouseleave', onLayerLeave);
    map.off('move', updateHoverTooltip);
    map.off('zoom', updateHoverTooltip);
    map.getCanvas().style.cursor = '';
  }

  function removeRenderedResult() {
    teardownHover();
    if (!map) return;
    if (map.getLayer(hikeFlyLayerId)) map.removeLayer(hikeFlyLayerId);
    if (map.getSource(hikeFlySourceId)) map.removeSource(hikeFlySourceId);
    if (map.getLayer(hikeFlyTakeoffLayerId)) map.removeLayer(hikeFlyTakeoffLayerId);
    if (map.getSource(hikeFlyTakeoffSourceId)) map.removeSource(hikeFlyTakeoffSourceId);
  }

  function setupTakeoffMarker() {
    if (!map || !takeoff) return;
    if (map.getSource(hikeFlyTakeoffSourceId)) return;

    map.addSource(hikeFlyTakeoffSourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [takeoff.longitude, takeoff.latitude],
        },
        properties: { elevation: takeoff.elevation },
      },
    });

    map.addLayer({
      id: hikeFlyTakeoffLayerId,
      type: 'circle',
      source: hikeFlyTakeoffSourceId,
      paint: {
        'circle-radius': 10,
        'circle-color': '#f59e0b',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 3,
        'circle-opacity': 0.9,
      },
    });
  }

  async function computeAndRender(gen: number) {
    if (!map || !takeoff) return;
    if (gen !== computeGeneration) return;
    isComputing = true;

    try {
      if (!map.isStyleLoaded()) {
        await new Promise<void>((resolve) => map.once('idle', resolve));
        if (gen !== computeGeneration) return;
      }

      if (!map.getTerrain()) {
        isComputing = false;
        return;
      }

      if (!resolvedTilePattern) {
        resolvedTilePattern = await resolveTileUrlPattern('https://tiles.mapterhorn.com/tilejson.json');
      }
      if (gen !== computeGeneration) return;
      workerController.compute({
        takeoff,
        glideRatio,
        stepMeters,
        tileUrlPattern: resolvedTilePattern,
      });
    } catch (err) {
      console.error('Hike&fly compute error:', err);
      if (gen === computeGeneration) isComputing = false;
    }
  }

  // --- Hover tooltip ---
  let hoveredFeature: { heightAGL: number; terrainElevation: number; lat: number; lng: number } | null = $state(null);

  function onLayerHover(e: MapLayerMouseEvent) {
    if (!map || !active || !takeoff) return;
    workerController.lookup(e.lngLat.lat, e.lngLat.lng);
  }

  function onLayerLeave() {
    workerController.cancelLookup();
    hoveredFeature = null;
    if (map) map.getCanvas().style.cursor = '';
  }

  const workerController = new HikeFlyWorkerController({
    createWorker: () => new Worker(new URL('$lib/workers/hikeFlyWorker.ts', import.meta.url), { type: 'module' }),
    removeRenderedResult,
    renderResult: (data, objectUrl) => {
      if (!map) throw new Error('Map is unavailable');
      map.addSource(hikeFlySourceId, {
        type: 'image',
        url: objectUrl,
        coordinates: data.coordinates,
      });
      map.addLayer({
        id: hikeFlyLayerId,
        type: 'raster',
        source: hikeFlySourceId,
        paint: { 'raster-opacity': 0.85, 'raster-resampling': 'nearest' },
      });
      setupTakeoffMarker();
      map.on('mousemove', onLayerHover);
      map.on('mouseleave', onLayerLeave);
      map.on('move', updateHoverTooltip);
      map.on('zoom', updateHoverTooltip);
    },
    onComputingChange: (computing) => (isComputing = computing),
    onHover: ({ point, latitude, longitude }) => {
      if (!map) return;
      if (!point) {
        hoveredFeature = null;
        map.getCanvas().style.cursor = '';
        return;
      }
      hoveredFeature = {
        heightAGL: point.heightAGL,
        terrainElevation: point.terrainElevation,
        lat: latitude,
        lng: longitude,
      };
      map.getCanvas().style.cursor = 'crosshair';
    },
    onError: (error) => console.error('Hike&fly compute error:', error),
  });

  // Update tooltip position on any map move/zoom to keep it pinned to the hovered cell
  let hoverPos: { x: number; y: number } | null = $state(null);
  function updateHoverTooltip() {
    if (!map || !hoveredFeature) {
      hoverPos = null;
      return;
    }
    let { lat, lng } = hoveredFeature;
    // keep it inside viewport
    const p = map.project([lng, lat]);
    const container = map.getContainer();
    if (p.x < 0 || p.y < 0 || p.x > container.clientWidth || p.y > container.clientHeight) {
      hoverPos = null;
      return;
    }
    hoverPos = { x: p.x + 14, y: p.y - 10 };
  }
  $effect(() => {
    void hoveredFeature;
    updateHoverTooltip();
  });

  $effect(() => {
    if (active && takeoff) {
      scheduleCompute();
    } else if (!active) {
      computeGeneration++;
      hoveredFeature = null;
      hoverPos = null;
      workerController.clear();
    }
  });

  onDestroy(() => {
    if (computeTimeout) clearTimeout(computeTimeout);
    workerController.destroy();
  });
</script>

{#if active}
  <div
    class="pointer-events-auto absolute z-20 flex flex-col rounded-xl border border-slate-200/80 bg-white/92 text-xs shadow-lg backdrop-blur-md
      {$isMobile
      ? 'bottom-0 left-0 right-0 rounded-none rounded-t-xl border-b-0 px-4 py-3 gap-2'
      : 'bottom-2 left-2 px-3 py-2 gap-1.5'}"
  >
    <div class="flex items-center gap-2">
      <span class="font-semibold text-slate-700 {$isMobile ? 'text-sm' : ''}">Hike & Fly</span>
      {#if isComputing}
        <span class="text-slate-400">Computing…</span>
      {/if}
      <button
        type="button"
        class="ml-auto text-slate-400 hover:text-slate-600 {$isMobile
          ? 'h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100'
          : ''}"
        onclick={() => (active = false)}
        aria-label="Close hike & fly layer">✕</button
      >
    </div>
    <div class="flex {$isMobile ? 'flex-col gap-2' : 'flex-wrap items-center gap-x-3 gap-y-1'}">
      <label class="flex items-center gap-1.5 text-slate-600 {$isMobile ? 'w-full' : ''}">
        <span class="shrink-0 {$isMobile ? 'w-8 text-xs' : ''}">Glide</span>
        <button
          type="button"
          class="flex {$isMobile
            ? 'h-9 w-9'
            : 'h-5 w-5'} items-center justify-center rounded bg-slate-100 text-xs text-slate-500 hover:bg-slate-200 disabled:opacity-30"
          onclick={() => {
            glideRatio = Math.max(2, +(glideRatio - 0.5).toFixed(1));
            scheduleCompute();
          }}
          disabled={glideRatio <= 2}>−</button
        >
        <input
          type="range"
          min="2"
          max="14"
          step="0.5"
          bind:value={glideRatio}
          oninput={scheduleCompute}
          class="{$isMobile ? 'h-2 flex-1' : 'h-1.5 w-20'} accent-emerald-600"
        />
        <button
          type="button"
          class="flex {$isMobile
            ? 'h-9 w-9'
            : 'h-5 w-5'} items-center justify-center rounded bg-slate-100 text-xs text-slate-500 hover:bg-slate-200 disabled:opacity-30"
          onclick={() => {
            glideRatio = Math.min(14, +(glideRatio + 0.5).toFixed(1));
            scheduleCompute();
          }}
          disabled={glideRatio >= 14}>+</button
        >
        <span class="w-12 text-right tabular-nums text-slate-800 {$isMobile ? 'text-sm' : ''}">{glideRatio}:1</span>
      </label>
      <label class="flex items-center gap-1.5 text-slate-600 {$isMobile ? 'w-full' : ''}">
        <span class="shrink-0 {$isMobile ? 'w-8 text-xs' : ''}">Grid</span>
        <button
          type="button"
          class="flex {$isMobile
            ? 'h-9 w-9'
            : 'h-5 w-5'} items-center justify-center rounded bg-slate-100 text-xs text-slate-500 hover:bg-slate-200 disabled:opacity-30"
          onclick={() => {
            const values = [25, 50, 100, 200];
            const idx = values.indexOf(stepMeters);
            if (idx > 0) {
              stepMeters = values[idx - 1];
              scheduleCompute();
            }
          }}
          disabled={stepMeters <= 25}>−</button
        >
        <input
          type="range"
          min="0"
          max="3"
          step="1"
          value={[25, 50, 100, 200].indexOf(stepMeters)}
          oninput={(e) => {
            stepMeters = [25, 50, 100, 200][+(e.target as HTMLInputElement).value];
            scheduleCompute();
          }}
          class="{$isMobile ? 'h-2 flex-1' : 'h-1.5 w-20'} accent-emerald-600"
        />
        <button
          type="button"
          class="flex {$isMobile
            ? 'h-9 w-9'
            : 'h-5 w-5'} items-center justify-center rounded bg-slate-100 text-xs text-slate-500 hover:bg-slate-200 disabled:opacity-30"
          onclick={() => {
            const values = [25, 50, 100, 200];
            const idx = values.indexOf(stepMeters);
            if (idx < values.length - 1) {
              stepMeters = values[idx + 1];
              scheduleCompute();
            }
          }}
          disabled={stepMeters >= 200}>+</button
        >
        <span class="w-12 text-right tabular-nums text-slate-800 {$isMobile ? 'text-sm' : ''}">{stepMeters}m</span>
      </label>
    </div>
  </div>
{/if}

{#if hoveredFeature && hoverPos}
  <div
    class="pointer-events-none absolute z-30 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-md"
    style="left: {hoverPos.x}px; top: {hoverPos.y}px;"
  >
    <div class="text-slate-500">
      DEM <span class="font-semibold text-slate-700">{hoveredFeature.terrainElevation} m</span>
    </div>
    <div class="text-slate-500">
      AGL <span class="font-semibold text-slate-700">{hoveredFeature.heightAGL} m</span>
    </div>
  </div>
{/if}
