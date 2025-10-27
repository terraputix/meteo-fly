<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl, { type Map, type Marker } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { Location } from '$lib/api/types';
  import { locationStore, type LocationState } from '$lib/services/location/store';

  import { LocationControlManager } from './LocationControl';
  export let latitude: number;
  export let longitude: number;

  let mapContainer: HTMLElement;
  let map: Map;
  let marker: Marker;
  let unsubscribe: () => void;

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

  // Watch for prop changes and update map
  $: if (map && marker && (latitude !== marker.getLngLat().lat || longitude !== marker.getLngLat().lng)) {
    const newPos = { lat: latitude, lng: longitude };
    marker.setLngLat(newPos);
    map.setCenter(newPos);
  }

  onMount(() => {
    // Initialize the map
    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://maptiler.servert.nl/styles/minimal-world-maps/style.json',
      center: [longitude, latitude],
      zoom: 8,
    });

    // Add marker
    marker = new maplibregl.Marker({ draggable: true }).setLngLat([longitude, latitude]).addTo(map);

    // Marker drag event
    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      updatePosition(pos.lat, pos.lng);
    });

    // Map click event
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      updatePosition(lat, lng);
    });

    const locationControlManager = new LocationControlManager({});
    map.addControl(locationControlManager, 'top-right');

    // Subscribe to location store changes
    unsubscribe = locationStore.subscribe((state: LocationState) => {
      locationControlManager.updateState(state);

      if (state.current) {
        handleLocationDetected(state.current);
      }
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

<div bind:this={mapContainer} id="map" style="height: 300px; width: 100%;"></div>

<style>
  #map {
    margin-top: 1rem;
    border-radius: 0.5rem;
  }

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
