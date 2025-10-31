<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl, { type Map, type Marker, type RequestParameters } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { defaultOmProtocolSettings, GridFactory, omProtocol, type Domain } from '@openmeteo/mapbox-layer';
  import { Protocol } from 'pmtiles';
  import type { Location } from '$lib/api/types';
  import { locationStore, type LocationState } from '$lib/services/location/store';
  import { weatherMapStore, buildOpenMeteoUrl } from '$lib/services/weatherMap/store';
  import { LocationControlManager } from './LocationControl';

  export let latitude: number;
  export let longitude: number;

  let mapContainer: HTMLElement;
  let map: Map;
  let marker: Marker;
  let locationUnsubscribe: () => void;
  let omFileSource: maplibregl.RasterTileSource | undefined;

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

  function updateWeatherLayer() {
    if (!map || !omFileSource) return;

    // Update layer
    const omUrl = buildOpenMeteoUrl($weatherMapStore);
    omFileSource.setUrl('om://' + omUrl);
  }

  // Watch for prop changes and update map
  $: if (map && marker && (latitude !== marker.getLngLat().lat || longitude !== marker.getLngLat().lng)) {
    const newPos = { lat: latitude, lng: longitude };
    marker.setLngLat(newPos);
  }

  $: triggeredUpdate(
    $weatherMapStore.variable,
    $weatherMapStore.domain,
    $weatherMapStore.datetime,
    $weatherMapStore.paddedBounds
  );

  function triggeredUpdate(
    _variable: string,
    _domain: Domain,
    _datetime: string,
    _paddedBounds: maplibregl.LngLatBounds | null
  ) {
    if (map && omFileSource) {
      updateWeatherLayer();
    }
  }

  onMount(async () => {
    const protocol = new Protocol();

    // Terrain Sources via mapterhorn protocol
    maplibregl.addProtocol('mapterhorn', async (params: RequestParameters, abortController: AbortController) => {
      const [z, x, y] = params.url.replace('mapterhorn://', '').split('/').map(Number);
      const name = z <= 12 ? 'planet' : `6-${x >> (z - 6)}-${y >> (z - 6)}`;
      const url = `pmtiles://https://mapterhorn.servert.ch/${name}.pmtiles/${z}/${x}/${y}.webp`;
      return await protocol.tile({ ...params, url }, abortController);
    });

    // Add OpenMeteo Protocol for weather maps
    const omProtocolOptions = defaultOmProtocolSettings;
    omProtocolOptions.resolutionFactor = 1;
    omProtocolOptions.useSAB = true;
    maplibregl.addProtocol('om', (params) => omProtocol(params, undefined, omProtocolOptions));

    // Initialize the map
    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://maptiler.servert.nl/styles/minimal-world-maps/style.json',
      center: [longitude, latitude],
      zoom: 8,
    });

    // Add marker
    marker = new maplibregl.Marker({ draggable: true }).setLngLat([longitude, latitude]).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      updatePosition(pos.lat, pos.lng);
    });
    // Map click event
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      updatePosition(lat, lng);
    });

    // Update bounds when map moves
    map.on('moveend', checkBounds);
    map.on('zoomend', checkBounds);

    const locationControlManager = new LocationControlManager({});
    map.addControl(locationControlManager, 'top-right');

    // Subscribe to location store changes
    locationUnsubscribe = locationStore.subscribe((state: LocationState) => {
      locationControlManager.updateState(state);
      if (state.current) {
        handleLocationDetected(state.current);
      }
    });

    map.on('load', () => {
      map.addSource('terrainSource', {
        type: 'raster-dem',
        tiles: ['mapterhorn://{z}/{x}/{y}'],
        encoding: 'terrarium',
        tileSize: 512,
        attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
      });
      map.addLayer({
        source: 'terrainSource',
        id: 'hillshadeLayer',
        type: 'hillshade',
        paint: {
          'hillshade-method': 'igor',
          'hillshade-shadow-color': 'rgba(0,0,0,0.4)',
          'hillshade-highlight-color': 'rgba(255,255,255,0.35)',
        },
      });
      map.setTerrain({
        source: 'terrainSource',
        exaggeration: 1.0,
      });

      updatePaddedBounds();

      const omUrl = buildOpenMeteoUrl($weatherMapStore);
      map.addSource('omFileSource', {
        url: 'om://' + omUrl,
        type: 'raster',
        tileSize: 256,
        maxzoom: 12,
      });
      omFileSource = map.getSource('omFileSource');

      map.addLayer({
        id: 'omFileLayer',
        type: 'raster',
        source: 'omFileSource',
      });
    });
  });

  onDestroy(() => {
    if (locationUnsubscribe) {
      locationUnsubscribe();
    }

    if (map) {
      map.remove();
    }
  });

  const padding = 25;

  const checkBounds = () => {
    const domain = $weatherMapStore.domain;
    const mapBounds = map.getBounds();
    const paddedBounds = $weatherMapStore.paddedBounds;

    if (paddedBounds) {
      let exceededPadding = false;

      const gridBounds = GridFactory.create(domain.grid).getBounds();

      if (mapBounds.getSouth() < paddedBounds.getSouth() && paddedBounds.getSouth() > gridBounds[1]) {
        exceededPadding = true;
      }
      if (mapBounds.getWest() < paddedBounds.getWest() && paddedBounds.getWest() > gridBounds[0]) {
        exceededPadding = true;
      }
      if (mapBounds.getNorth() > paddedBounds.getNorth() && paddedBounds.getNorth() < gridBounds[3]) {
        exceededPadding = true;
      }
      if (mapBounds.getEast() > paddedBounds.getEast() && paddedBounds.getEast() < gridBounds[2]) {
        exceededPadding = true;
      }

      if (exceededPadding) {
        updatePaddedBounds();
      }
    }
  };

  const updatePaddedBounds = () => {
    const domain = $weatherMapStore.domain;
    const mapBounds = map.getBounds();

    const gridBounds = GridFactory.create(domain.grid).getBounds();

    const mapBoundsSW = mapBounds.getSouthWest();
    const mapBoundsNE = mapBounds.getNorthEast();
    const dLat = mapBoundsNE.lat - mapBoundsSW.lat;
    const dLon = mapBoundsNE.lng - mapBoundsSW.lng;

    // Calculate the new padded bounds
    const newBounds: [number, number, number, number] = [
      Math.max(Math.max(mapBoundsSW.lng - (dLon * padding) / 100, gridBounds[0]), -180),
      Math.max(Math.max(mapBoundsSW.lat - (dLat * padding) / 100, gridBounds[1]), -90),
      Math.min(Math.min(mapBoundsNE.lng + (dLon * padding) / 100, gridBounds[2]), 180),
      Math.min(Math.min(mapBoundsNE.lat + (dLat * padding) / 100, gridBounds[3]), 90),
    ];

    // Create a new LngLatBounds object
    const newPaddedBounds = new maplibregl.LngLatBounds(newBounds);

    // Update the store with the new padded bounds
    weatherMapStore.setPaddedBounds(newPaddedBounds);
  };
</script>

<div bind:this={mapContainer} id="map" class="h-full w-full"></div>

<style>
  :global(.maplibregl-ctrl-group button) {
    background-color: white;
    border: none;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 6px;
    color: #374151;
    transition: all 0.2s ease;
  }

  :global(.maplibregl-ctrl-group button:hover:not(:disabled)) {
    background: #f8fafc;
    color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  :global(.maplibregl-ctrl-group button:active) {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
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

  :global(.maplibregl-ctrl-geolocate:disabled) {
    cursor: not-allowed;
    opacity: 0.6;
  }

  :global(.location-spinner) {
    animation: spin 1s linear infinite;
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
