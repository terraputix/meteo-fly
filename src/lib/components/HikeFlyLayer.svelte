<script lang="ts">
  import type { MapLayerMouseEvent } from 'maplibre-gl';
  import { onDestroy } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { isMobile } from '$lib/stores/media';
  import {
    generateReachableArea,
    visitKey,
    HIKE_FLY_DEFAULT_GLIDE_RATIO,
    HIKE_FLY_DEFAULT_STEP_M,
    EARTH_RADIUS,
    toRadians,
    type HikeFlyGridPoint,
  } from '$lib/meteo/hikeAndFly';
  import {
    resolveTileUrlPattern,
    formatTileUrl,
    tilesForBbox,
    fetchDemTile,
    createElevationLookup,
    type DemTile,
  } from '$lib/meteo/dem';

  function heightAGLToRgba(h: number): [number, number, number, number] {
    if (h <= 0) return [239, 68, 68, 140];
    if (h <= 50) return [250, 204, 21, 140];
    if (h <= 200) return [132, 204, 22, 140];
    if (h <= 500) return [34, 197, 94, 140];
    return [20, 184, 166, 165];
  }

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

  const EARTH_CIRCUMFERENCE = 40_075_017;
  const DEM_ZOOM = 12;
  const DEM_ENCODING = 'terrarium' as const;

  let isComputing = $state(false);

  let computeGeneration = 0;
  let computeTimeout: ReturnType<typeof setTimeout> | null = null;

  let pointLookup = new SvelteMap<string, HikeFlyGridPoint>();
  let stepDegLatCache = 0;

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const tileCache = new Map<string, DemTile>();
  let resolvedTilePattern: string | null = null;

  function scheduleCompute() {
    if (computeTimeout) clearTimeout(computeTimeout);
    computeGeneration++;
    const gen = computeGeneration;
    computeTimeout = setTimeout(() => {
      if (gen === computeGeneration) computeAndRender(gen);
    }, 200);
  }

  function teardownHover() {
    if (!map) return;
    map.off('mousemove', onLayerHover);
    map.off('mouseleave', onLayerLeave);
    map.getCanvas().style.cursor = '';
  }

  function clearLayer() {
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
      const { latitude: tLat, longitude: tLon } = takeoff;

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

      const maxGlideM = glideRatio * Math.max(takeoff.elevation, 100);
      const degPerM = 360 / EARTH_CIRCUMFERENCE;
      const marginDeg = maxGlideM * degPerM * 1.2;
      const minLat = tLat - marginDeg;
      const maxLat = tLat + marginDeg;
      const minLon = tLon - marginDeg;
      const maxLon = tLon + marginDeg;

      const neededTiles = tilesForBbox(minLat, maxLat, minLon, maxLon, DEM_ZOOM);

      const fetchPromises = neededTiles.map(async (t) => {
        const key = `${t.z}/${t.x}/${t.y}`;
        if (!tileCache.has(key)) {
          const url = formatTileUrl(resolvedTilePattern!, t.z, t.x, t.y);
          try {
            const demTile = await fetchDemTile(url, DEM_ENCODING);
            tileCache.set(key, demTile);
          } catch (err) {
            console.warn('Failed to fetch DEM tile:', key, err);
          }
        }
      });
      await Promise.all(fetchPromises);
      if (gen !== computeGeneration) return;

      const getElevation = createElevationLookup(tileCache, DEM_ZOOM);

      const demElev = getElevation(tLat, tLon);
      if (demElev == null) {
        isComputing = false;
        return;
      }

      const reachable = generateReachableArea(
        {
          takeoff: { latitude: tLat, longitude: tLon, elevation: demElev },
          glideRatio,
          initialAltitude: 0,
          stepMeters,
        },
        getElevation
      );

      if (gen !== computeGeneration) return;

      const earthCirc = 2 * Math.PI * EARTH_RADIUS;
      stepDegLatCache = (stepMeters / earthCirc) * 360;

      pointLookup = new SvelteMap();
      let minRlat = Infinity;
      let maxRlat = -Infinity;
      let minRlon = Infinity;
      let maxRlon = -Infinity;
      for (const pt of reachable) {
        const k = visitKey(tLat, tLon, pt.latitude, pt.longitude, stepDegLatCache);
        pointLookup.set(k, pt);
        if (pt.latitude < minRlat) minRlat = pt.latitude;
        if (pt.latitude > maxRlat) maxRlat = pt.latitude;
        if (pt.longitude < minRlon) minRlon = pt.longitude;
        if (pt.longitude > maxRlon) maxRlon = pt.longitude;
      }

      const cosLat = Math.cos(toRadians((minRlat + maxRlat) / 2));
      const stepDegLon = cosLat > 0.01 ? stepDegLatCache / cosLat : stepDegLatCache;

      const nCols = Math.round((maxRlon - minRlon) / stepDegLon) + 1;
      const nRows = Math.round((maxRlat - minRlat) / stepDegLatCache) + 1;

      const canvas = new OffscreenCanvas(nCols, nRows);
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(nCols, nRows);
      const pixels = imageData.data;

      for (const pt of reachable) {
        const col = Math.round((pt.longitude - minRlon) / stepDegLon);
        const row = Math.round((maxRlat - pt.latitude) / stepDegLatCache);
        if (col < 0 || col >= nCols || row < 0 || row >= nRows) continue;
        const [r, g, b, a] = heightAGLToRgba(pt.heightAGL);
        const idx = (row * nCols + col) * 4;
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = a;
      }

      ctx.putImageData(imageData, 0, 0);
      const blob = await canvas.convertToBlob();
      const url = URL.createObjectURL(blob);

      teardownHover();
      clearLayer();

      map.addSource(hikeFlySourceId, {
        type: 'image',
        url,
        coordinates: [
          [minRlon, maxRlat],
          [maxRlon + stepDegLon, maxRlat],
          [maxRlon + stepDegLon, minRlat - stepDegLatCache],
          [minRlon, minRlat - stepDegLatCache],
        ],
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
    } catch (err) {
      console.error('Hike&fly compute error:', err);
    } finally {
      isComputing = false;
    }
  }

  // --- Hover tooltip ---
  let hoveredFeature: { heightAGL: number; terrainElevation: number } | null = $state(null);
  let hoverPos: { x: number; y: number } | null = $state(null);

  function onLayerHover(e: MapLayerMouseEvent) {
    if (!map || !active || !takeoff) return;
    const k = visitKey(takeoff.latitude, takeoff.longitude, e.lngLat.lat, e.lngLat.lng, stepDegLatCache);
    const cell = pointLookup.get(k);
    if (!cell) {
      hoveredFeature = null;
      hoverPos = null;
      map.getCanvas().style.cursor = '';
      return;
    }
    hoveredFeature = {
      heightAGL: cell.heightAGL,
      terrainElevation: cell.terrainElevation,
    };
    hoverPos = { x: e.point.x + 14, y: e.point.y - 10 };
    map.getCanvas().style.cursor = 'crosshair';
  }

  function onLayerLeave() {
    hoveredFeature = null;
    hoverPos = null;
    if (map) map.getCanvas().style.cursor = '';
  }

  $effect(() => {
    if (active && takeoff) {
      scheduleCompute();
    } else if (!active) {
      computeGeneration++;
      tileCache.clear();
      teardownHover();
      hoveredFeature = null;
      hoverPos = null;
      clearLayer();
    }
  });

  onDestroy(() => {
    if (computeTimeout) clearTimeout(computeTimeout);
    teardownHover();
    clearLayer();
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
