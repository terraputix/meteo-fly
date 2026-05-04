<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl, { NavigationControl, type Map, type Marker } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { Location } from '$lib/api/types';
  import { locationStore, type LocationState } from '$lib/services/location/store';

  import { LocationControlManager, TerrainControl } from './LocationControl';
  export let latitude: number;
  export let longitude: number;
  export let chartOpen = false;
  export let onToggleChart: (() => void) | undefined = undefined;

  const terrainSourceId = 'terrainSource';
  const hillshadeSourceId = 'hillshadeSource';
  const hillshadeLayerId = 'hills';
  const defaultTerrainExaggeration = 1;

  let mapContainer: HTMLElement;
  let map: Map;
  let marker: Marker;
  let unsubscribe: () => void;
  let isTerrainEnabled = true;

  function updatePosition(lat: number, lng: number) {
    latitude = parseFloat(lat.toFixed(5));
    longitude = parseFloat(lng.toFixed(5));
    if (marker) {
      marker.setLngLat([longitude, latitude]);
    }
  }

  function handleLocationDetected(location: Location) {
    const { latitude: lat, longitude: lng } = location;
    updatePosition(lat, lng);
    if (map) {
      map.flyTo({ center: [lng, lat], zoom: 10 });
    }
  }

  function setTerrainVisibility(enabled: boolean) {
    isTerrainEnabled = enabled;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    if (map.getLayer(hillshadeLayerId)) {
      map.setLayoutProperty(hillshadeLayerId, 'visibility', enabled ? 'visible' : 'none');
    }

    map.setTerrain(
      enabled
        ? {
            source: terrainSourceId,
            exaggeration: defaultTerrainExaggeration,
          }
        : null
    );
  }

  // Watch for prop changes and update map
  $: if (map && marker && (latitude !== marker.getLngLat().lat || longitude !== marker.getLngLat().lng)) {
    const newPos = { lat: latitude, lng: longitude };
    marker.setLngLat(newPos);
    map.setCenter(newPos);
  }

  onMount(async () => {
    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [longitude, latitude],
      zoom: 8,
    });

    map.addControl(
      new NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      'top-left'
    );

    const locationControlManager = new LocationControlManager({
      title: 'Use my location',
      className: 'maplibregl-ctrl-geolocate',
      onLocationDetected: handleLocationDetected,
    });
    const terrainControl = new TerrainControl({
      title: 'Disable terrain and hillshade',
      className: 'maplibregl-ctrl-terrain-toggle',
      initialEnabled: isTerrainEnabled,
      onToggle: setTerrainVisibility,
    });

    map.addControl(locationControlManager, 'top-left');
    map.addControl(terrainControl, 'top-left');

    marker = new maplibregl.Marker({ draggable: true }).setLngLat([longitude, latitude]).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      updatePosition(pos.lat, pos.lng);
    });

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      updatePosition(lat, lng);
    });

    unsubscribe = locationStore.subscribe((state: LocationState) => {
      locationControlManager.updateState(state);
    });

    map.on('load', () => {
      map.addSource(terrainSourceId, {
        type: 'raster-dem',
        url: 'https://tiles.mapterhorn.com/tilejson.json',
      });
      map.addSource(hillshadeSourceId, {
        type: 'raster-dem',
        url: 'https://tiles.mapterhorn.com/tilejson.json',
      });
      map.addLayer(
        {
          id: hillshadeLayerId,
          type: 'hillshade',
          source: hillshadeSourceId,
          paint: {
            'hillshade-shadow-color': '#473B24',
            'hillshade-exaggeration': 0.35,
            'hillshade-highlight-color': 'rgba(255,255,255,0.2)',
            'hillshade-accent-color': 'rgba(120,95,58,0.18)',
          },
        },
        'waterway_line_label'
      );
      setTerrainVisibility(isTerrainEnabled);
      terrainControl.setEnabled(isTerrainEnabled);
    });
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (map) {
      map.remove();
    }
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={mapContainer} id="map" class="h-full w-full"></div>

  <div class="chart-toggle-anchor pointer-events-none absolute left-[4.65rem] z-10 md:left-[4.9rem]">
    <button
      type="button"
      class:chart-open={chartOpen}
      class="pointer-events-auto flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/92 px-3 py-2 text-left text-slate-700 shadow-lg backdrop-blur-md transition hover:bg-white"
      on:click={() => onToggleChart?.()}
      aria-label={chartOpen ? 'Hide forecast chart panel' : 'Show forecast chart panel'}
      title={chartOpen ? 'Hide forecast chart panel' : 'Show forecast chart panel'}
    >
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
        aria-hidden="true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6.5h12m-3-3 3 3-3 3" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6m3-3-3 3 3 3" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 17.5h12m-3-3 3 3-3 3" />
        </svg>
      </span>
      <span class="min-w-0">
        <span class="block text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Forecast</span>
        <span class="block text-sm font-semibold text-slate-800"
          >{chartOpen ? 'Hide chart panel' : 'Show chart panel'}</span
        >
      </span>
    </button>
  </div>
</div>

<style>
  :global(.maplibregl-ctrl-top-left) {
    top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
    left: calc(env(safe-area-inset-left, 0px) + 0.75rem);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  :global(.maplibregl-ctrl-top-left .maplibregl-ctrl) {
    margin: 0;
  }

  :global(.maplibregl-ctrl-group--floating) {
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18);
  }

  :global(.maplibregl-ctrl-group) {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
  }

  :global(.maplibregl-ctrl-group button) {
    background-color: transparent;
    border: none;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #374151;
    transition:
      background-color 0.2s ease,
      color 0.2s ease,
      transform 0.2s ease;
  }

  :global(.maplibregl-ctrl-group button + button) {
    border-top: 1px solid rgba(148, 163, 184, 0.2);
  }

  :global(.maplibregl-ctrl-group button:hover:not(:disabled)) {
    background: #f8fafc;
    color: #2563eb;
    transform: translateY(-1px);
  }

  :global(.maplibregl-ctrl-group button:active) {
    transform: translateY(0);
  }

  :global(.maplibregl-ctrl-geolocate.loading) {
    color: #3b82f6;
    cursor: wait;
  }

  :global(.maplibregl-ctrl-geolocate.error) {
    color: #ef4444;
  }

  :global(.maplibregl-ctrl-geolocate.error:hover) {
    background: #fef2f2;
    color: #dc2626;
  }

  :global(.maplibregl-ctrl-geolocate.success) {
    color: #10b981;
  }

  :global(.maplibregl-ctrl-geolocate.success:hover) {
    background: #f0fdf4;
    color: #059669;
  }

  :global(.maplibregl-ctrl-terrain-toggle.is-active) {
    color: #2563eb;
  }

  :global(.maplibregl-ctrl-group button:disabled) {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
  }

  :global(.location-spinner) {
    animation: spin 1s linear infinite;
  }

  .chart-toggle-anchor {
    top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
  }

  button.chart-open {
    border-color: rgba(99, 102, 241, 0.25);
    background: rgba(238, 242, 255, 0.96);
  }

  button.chart-open span:first-child {
    background: rgb(224, 231, 255);
    color: rgb(79, 70, 229);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
