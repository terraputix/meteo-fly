<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import maplibregl, { NavigationControl, type Map, type Marker } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { LngLatLike } from 'maplibre-gl';
  import { base } from '$app/paths';
  import type { Location } from '$lib/api/types';
  import { locationStore, type LocationState } from '$lib/services/location/store';

  import { LocationControlManager, TerrainControl } from './Controls';
  import ModelSelector from './ModelSelector.svelte';
  import ChartSettingsPopover from './ChartSettingsPopover.svelte';
  import type { WeatherModel, CellSelection } from '$lib/api/types';
  import type { MaxAltitude } from '$lib/meteo/types';
  export let latitude: number;
  export let longitude: number;
  export let chartOpen = false;
  export let selectedGridCell: Location | null = null;
  export let gridCellElevation: number | undefined = undefined;
  export let modelGridElevation: number | undefined = undefined;
  export let model: WeatherModel = 'icon_d2';
  export let maxAltitude: MaxAltitude = 4000;
  export let cellSelection: CellSelection = 'nearest';
  export let onLocationChange: ((location: Location) => void) | undefined = undefined;
  export let onToggleChart: (() => void) | undefined = undefined;

  const terrainSourceId = 'terrainSource';
  const hillshadeSourceId = 'hillshadeSource';
  const hillshadeLayerId = 'hills';
  const gridCellConnectorSourceId = 'grid-cell-connector';
  const gridCellConnectorLayerId = 'grid-cell-connector-line';
  const defaultTerrainExaggeration = 1;
  const earthRadiusMeters = 6371000;
  const aboutUrl = `${base}/about`;
  let mapContainer: HTMLElement;
  let map: Map;
  let marker: Marker;
  let elevationBadge: HTMLDivElement | undefined;
  let selectedGridCellMarker: Marker | null = null;
  let distanceMarker: Marker | null = null;
  let unsubscribe: () => void;
  let isTerrainEnabled = true;
  let lastTerrainElevation: number | undefined;

  function toRadians(value: number) {
    return (value * Math.PI) / 180;
  }

  function getHaversineDistanceMeters(a: Location, b: Location) {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);

    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const haversine = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
    const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return earthRadiusMeters * arc;
  }

  function formatDistance(distanceMeters: number) {
    return distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)} km`
      : `${Math.round(distanceMeters)} m`;
  }

  function queryElevation(lat: number, lng: number) {
    if (!map || !map.isStyleLoaded() || !isTerrainEnabled) return;
    const elev = map.queryTerrainElevation([lng, lat]);

    if (elev == null) return;
    const rounded = Math.round(elev);
    lastTerrainElevation = rounded;
    updateElevationBadge();
  }

  function updateElevationBadge() {
    if (!elevationBadge) return;
    const parts: string[] = [];
    if (lastTerrainElevation != null) parts.push(`Map ${lastTerrainElevation}m`);
    if (gridCellElevation != null) parts.push(`API DEM ${Math.round(gridCellElevation)}m`);
    if (parts.length === 0) {
      elevationBadge.style.display = 'none';
      return;
    }
    elevationBadge.style.display = '';
    elevationBadge.textContent = parts.join(' · ');
  }

  function updatePosition(lat: number, lng: number) {
    const nextLatitude = parseFloat(lat.toFixed(5));
    const nextLongitude = parseFloat(lng.toFixed(5));
    latitude = nextLatitude;
    longitude = nextLongitude;
    onLocationChange?.({ latitude: nextLatitude, longitude: nextLongitude });
    if (marker) {
      marker.setLngLat([nextLongitude, nextLatitude]);
    }
    queryElevation(nextLatitude, nextLongitude);
  }

  function handleLocationDetected(location: Location) {
    const { latitude: lat, longitude: lng } = location;
    updatePosition(lat, lng);
    if (map) {
      map.flyTo({ center: [lng, lat], zoom: 10 });
    }
  }

  function updateGridCellConnector() {
    if (!map || !map.getSource(gridCellConnectorSourceId)) {
      return;
    }

    const source = map.getSource(gridCellConnectorSourceId) as maplibregl.GeoJSONSource;
    const selectedLocation = { latitude, longitude };

    if (!selectedGridCell) {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
      distanceMarker?.remove();
      distanceMarker = null;
      return;
    }

    const gridCellLongitude = selectedGridCell.longitude;
    const gridCellLatitude = selectedGridCell.latitude;
    const selectedLocationPixel = map.project([longitude, latitude]);
    const gridCellPixel = map.project([gridCellLongitude, gridCellLatitude]);
    const lineLengthPixels = Math.hypot(
      gridCellPixel.x - selectedLocationPixel.x,
      gridCellPixel.y - selectedLocationPixel.y
    );

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [longitude, latitude],
              [gridCellLongitude, gridCellLatitude],
            ],
          },
          properties: {},
        },
      ],
    });

    if (lineLengthPixels < 72) {
      distanceMarker?.remove();
      distanceMarker = null;
      return;
    }

    const midpoint: LngLatLike = [(longitude + gridCellLongitude) / 2, (latitude + gridCellLatitude) / 2];
    const distanceLabel = formatDistance(getHaversineDistanceMeters(selectedLocation, selectedGridCell));

    if (!distanceMarker) {
      const element = document.createElement('div');
      element.className = 'grid-cell-distance-badge';
      distanceMarker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(midpoint).addTo(map);
    } else {
      distanceMarker.setLngLat(midpoint);
    }

    distanceMarker.getElement().textContent = distanceLabel;
  }

  function updateSelectedGridCellMarker() {
    if (!map) {
      return;
    }

    if (!selectedGridCell) {
      selectedGridCellMarker?.remove();
      selectedGridCellMarker = null;
      updateGridCellConnector();
      return;
    }

    const lngLat: LngLatLike = [selectedGridCell.longitude, selectedGridCell.latitude];
    const badgeText = modelGridElevation != null ? `Grid cell · ${Math.round(modelGridElevation)} m` : 'Grid cell';

    if (!selectedGridCellMarker) {
      const element = document.createElement('div');
      element.className = 'selected-grid-cell-marker';
      element.innerHTML =
        '<span class="selected-grid-cell-marker__ring"></span><span class="selected-grid-cell-marker__dot"></span><span class="selected-grid-cell-marker__badge">Grid cell</span>';

      selectedGridCellMarker = new maplibregl.Marker({
        element,
        anchor: 'center',
      })
        .setLngLat(lngLat)
        .addTo(map);

      const badgeEl = element.querySelector('.selected-grid-cell-marker__badge');
      if (badgeEl) badgeEl.textContent = badgeText;
    } else {
      selectedGridCellMarker.setLngLat(lngLat);
      const badgeEl = selectedGridCellMarker.getElement().querySelector('.selected-grid-cell-marker__badge');
      if (badgeEl) badgeEl.textContent = badgeText;
    }

    updateGridCellConnector();
  }

  function setTerrainVisibility(enabled: boolean) {
    isTerrainEnabled = enabled;

    if (!map) return;

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

    if (enabled) {
      queryElevation(latitude, longitude);
      map.once('idle', () => queryElevation(latitude, longitude));
    } else {
      lastTerrainElevation = undefined;
      updateElevationBadge();
    }
  }

  // Watch for prop changes and update map
  $: if (map && marker && (latitude !== marker.getLngLat().lat || longitude !== marker.getLngLat().lng)) {
    const newPos = { lat: latitude, lng: longitude };
    marker.setLngLat(newPos);
    map.setCenter(newPos);
  }

  $: void (selectedGridCell, latitude, longitude, modelGridElevation, map, updateSelectedGridCellMarker());
  $: void (gridCellElevation, modelGridElevation, updateElevationBadge());

  function handleMapViewChange() {
    updateGridCellConnector();
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

    const selectedLocationElement = document.createElement('div');
    selectedLocationElement.className = 'selected-location-marker';
    selectedLocationElement.innerHTML =
      '<span class="selected-location-marker__outer"></span><span class="selected-location-marker__inner"></span><span class="selected-location-marker__core"></span>';

    elevationBadge = document.createElement('div');
    elevationBadge.className = 'selected-location-marker__elevation';
    selectedLocationElement.appendChild(elevationBadge);
    marker = new maplibregl.Marker({
      element: selectedLocationElement,
      draggable: true,
      anchor: 'center',
    })
      .setLngLat([longitude, latitude])
      .addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      updatePosition(pos.lat, pos.lng);
    });
    updateSelectedGridCellMarker();

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      updatePosition(lat, lng);
    });
    map.on('zoom', handleMapViewChange);
    map.on('move', handleMapViewChange);

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
      map.addSource(gridCellConnectorSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
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
      map.addLayer({
        id: gridCellConnectorLayerId,
        type: 'line',
        source: gridCellConnectorSourceId,
        paint: {
          'line-color': 'rgba(99, 102, 241, 0.32)',
          'line-width': 1.5,
        },
      });
      setTerrainVisibility(isTerrainEnabled);
      terrainControl.setEnabled(isTerrainEnabled);
      updateSelectedGridCellMarker();
    });
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (selectedGridCellMarker) {
      selectedGridCellMarker.remove();
    }
    if (distanceMarker) {
      distanceMarker.remove();
    }
    if (map) {
      map.off('zoom', handleMapViewChange);
      map.off('move', handleMapViewChange);
      map.remove();
    }
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={mapContainer} id="map" class="h-full w-full"></div>

  <div class="controls-stack pointer-events-none absolute right-3 z-10 flex flex-col items-end gap-2">
    <div class="pointer-events-auto">
      <ModelSelector bind:model />
    </div>

    <button
      type="button"
      class:chart-open={chartOpen}
      class="pointer-events-auto flex w-full items-center gap-2 rounded-xl border border-slate-200/80 bg-white/92 px-2.5 py-2 text-left text-slate-700 shadow-lg backdrop-blur-md transition hover:bg-white"
      onclick={() => onToggleChart?.()}
      aria-label={chartOpen ? 'Hide forecast chart panel' : 'Show forecast chart panel'}
      title={chartOpen ? 'Hide forecast chart panel' : 'Show forecast chart panel'}
    >
      <span class="ml-auto min-w-0 text-right">
        <span class="block text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Forecast</span>
        <span class="block text-xs font-semibold text-slate-800"
          >{chartOpen ? 'Hide chart panel' : 'Show chart panel'}</span
        >
      </span>
      <span
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
        aria-hidden="true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6.5h12m-3-3 3 3-3 3" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6m3-3-3 3 3 3" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 17.5h12m-3-3 3 3-3 3" />
        </svg>
      </span>
    </button>

    <div class="pointer-events-auto">
      <ChartSettingsPopover bind:maxAltitude bind:cellSelection />
    </div>

    <button
      type="button"
      class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/92 shadow-lg backdrop-blur-md transition hover:bg-white"
      onclick={() =>
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        goto(aboutUrl)}
      aria-label="About"
      title="About"
    >
      <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 9h.01" />
        </svg>
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

  :global(.selected-location-marker) {
    position: relative;
    width: 22px;
    height: 22px;
    cursor: grab;
  }

  :global(.selected-location-marker:active) {
    cursor: grabbing;
  }

  :global(.selected-location-marker__outer) {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: rgba(37, 99, 235, 0.18);
    border: 1.5px solid rgba(59, 130, 246, 0.95);
    box-shadow: 0 3px 10px rgba(37, 99, 235, 0.18);
  }

  :global(.selected-location-marker__inner) {
    position: absolute;
    inset: 4px;
    border-radius: 9999px;
    border: 1px solid rgba(191, 219, 254, 0.95);
    background: rgba(125, 211, 252, 0.12);
  }

  :global(.selected-location-marker__core) {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 5px;
    height: 5px;
    border-radius: 9999px;
    background: rgba(224, 242, 254, 0.95);
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.24);
  }

  :global(.selected-location-marker__elevation) {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(30, 41, 59, 0.85);
    color: #f8fafc;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.1;
    white-space: nowrap;
    pointer-events: none;
    backdrop-filter: blur(4px);
  }

  :global(.selected-grid-cell-marker) {
    position: absolute;
    width: 16px;
    height: 16px;
    pointer-events: none;
    z-index: 2;
  }

  :global(.selected-grid-cell-marker__ring) {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: rgba(15, 23, 42, 0.04);
    border: 1.5px solid rgba(71, 85, 105, 0.72);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  }

  :global(.selected-grid-cell-marker__dot) {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4px;
    height: 4px;
    border-radius: 9999px;
    background: rgba(51, 65, 85, 0.88);
    transform: translate(-50%, -50%);
  }

  :global(.selected-grid-cell-marker__badge) {
    position: absolute;
    top: 50%;
    left: calc(100% + 0.4rem);
    transform: translateY(-50%);
    padding: 0.14rem 0.38rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(148, 163, 184, 0.28);
    color: rgb(51, 65, 85);
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(6px);
  }

  :global(.grid-cell-distance-badge) {
    padding: 0.18rem 0.45rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(148, 163, 184, 0.28);
    color: rgb(51, 65, 85);
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(6px);
    pointer-events: none;
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

  .controls-stack {
    top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
  }

  button.chart-open {
    border-color: rgba(99, 102, 241, 0.25);
    background: rgba(238, 242, 255, 0.96);
  }

  button.chart-open span:last-child {
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
