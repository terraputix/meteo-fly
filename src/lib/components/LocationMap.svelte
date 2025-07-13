<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet/dist/images/marker-icon.png';
  import type { Location } from '$lib/api/types';
  import { locationActions, locationStore } from '$lib/services/location/store';

  export let latitude: number;
  export let longitude: number;

  let mapContainer: HTMLElement;
  let map: L.Map;
  let marker: L.Marker;
  let unsubscribe: () => void;

  function updatePosition(lat: number, lng: number) {
    latitude = parseFloat(lat.toFixed(5));
    longitude = parseFloat(lng.toFixed(5));
    if (marker) {
      marker.setLatLng([latitude, longitude]);
    }
  }

  function handleLocationDetected(location: Location) {
    const { latitude: lat, longitude: lng } = location;
    updatePosition(lat, lng);
    if (map) {
      map.flyTo([lat, lng], 10);
    }
  }

  // Watch for prop changes and update map
  $: if (map && marker && (latitude !== marker.getLatLng().lat || longitude !== marker.getLatLng().lng)) {
    const newPos = [latitude, longitude] as [number, number];
    marker.setLatLng(newPos);
    map.setView(newPos, map.getZoom());
  }

  onMount(() => {
    // Initialize the map
    map = L.map(mapContainer).setView([latitude, longitude], 8);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Add marker
    marker = L.marker([latitude, longitude], {
      draggable: true,
    }).addTo(map);

    // Marker drag event
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      updatePosition(pos.lat, pos.lng);
    });

    // Map click event
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      updatePosition(lat, lng);
    });

    // Add custom control for location detection
    const locationControl = L.Control.extend({
      options: {
        position: 'topright',
      },
      onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-control-location');
        const button = L.DomUtil.create('button', 'location-btn', container);
        button.type = 'button';
        button.title = 'Use My Location';
        button.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
            <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        `;

        L.DomEvent.on(button, 'click', () => {
          locationActions.detectLocation();
        });

        L.DomEvent.disableClickPropagation(container);
        return container;
      },
    });

    map.addControl(new locationControl());

    // Subscribe to location store changes
    unsubscribe = locationStore.subscribe((state) => {
      if (state.current) {
        handleLocationDetected(state.current);
      }
    });
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
</script>

<div bind:this={mapContainer} id="map" style="height: 300px; width: 100%;"></div>

<style>
  #map {
    margin-top: 1rem;
    border-radius: 0.5rem;
  }

  :global(.leaflet-container) {
    z-index: 0;
  }

  :global(.leaflet-control-location) {
    background: white;
    border-radius: 6px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.1);
    margin: 10px;
  }

  :global(.location-btn) {
    background: white;
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

  :global(.location-btn:hover) {
    background: #f8fafc;
    color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  :global(.location-btn:active) {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
</style>
