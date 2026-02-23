<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl, { type Map, type Marker, type RequestParameters } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { defaultOmProtocolSettings, omProtocol, updateCurrentBounds } from '@openmeteo/mapbox-layer';
  import { Protocol } from 'pmtiles';
  import type { Location } from '$lib/api/types';
  import { locationStore, type LocationState } from '$lib/services/location/store';
  import { LocationControlManager } from './LocationControl';
  import type { WeatherMapManager, WeatherMapState } from '$lib/services/weatherMap/manager';
  import type { Subscriber, Unsubscriber } from 'svelte/store';
  import { buildOpenMeteoUrl } from '$lib/services/weatherMap/om_url';

  // Accept the manager and store as props
  export let weatherMapManager: WeatherMapManager;
  export let weatherMapStore: {
    subscribe: (this: void, run: Subscriber<WeatherMapState>, invalidate?: () => void) => Unsubscriber;
  };
  export let rasterTileSource: maplibregl.RasterTileSource | undefined;

  let mapContainer: HTMLElement;
  let map: Map;
  let marker: Marker;
  let locationUnsubscribe: () => void;

  function updatePosition(lat: number, lng: number) {
    const newLat = parseFloat(lat.toFixed(5));
    const newLng = parseFloat(lng.toFixed(5));

    if (marker) {
      marker.setLngLat([newLng, newLat]);
    }

    weatherMapManager.setLocation({ latitude: newLat, longitude: newLng });
  }

  function handleLocationDetected(location: Location) {
    const { latitude: lat, longitude: lng } = location;
    updatePosition(lat, lng);
    if (map) {
      map.flyTo({ center: [lng, lat], zoom: 10 });
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
    omProtocolOptions.fileReaderConfig.useSAB = true;
    maplibregl.addProtocol('om', (params: RequestParameters, abortController: AbortController) =>
      omProtocol(params, abortController, omProtocolOptions)
    );

    // Initialize the map
    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://maptiler.servert.nl/styles/minimal-world-maps/style.json',
      center: [$weatherMapStore.location.longitude, $weatherMapStore.location.latitude],
      zoom: 8,
    });

    // Add marker
    marker = new maplibregl.Marker({ draggable: true })
      .setLngLat([$weatherMapStore.location.longitude, $weatherMapStore.location.latitude])
      .addTo(map);
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
    map.on('dataloading', () => {
      updateCurrentBounds(map.getBounds());
    });

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

      const initialOmUrl = buildOpenMeteoUrl({
        domain: $weatherMapStore.domain,
        variable: $weatherMapStore.variable,
        datetime: $weatherMapStore.datetime,
        domainInfo: $weatherMapStore.domainInfo,
      });

      console.log('initial OmUrl', initialOmUrl);

      map.addSource('omFileSource', {
        url: 'om://' + initialOmUrl,
        type: 'raster',
        tileSize: 256,
        maxzoom: 12,
      });
      rasterTileSource = map.getSource('omFileSource')!;

      map.addLayer(
        {
          id: 'omFileLayer',
          type: 'raster',
          source: 'omFileSource',
        },
        'waterway-tunnel'
      );
      console.log('added weather layer');
    });

    map.on('dataloading', () => {
      updateCurrentBounds(map.getBounds());
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
