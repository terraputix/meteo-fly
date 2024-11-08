<script lang="ts">
	import { onMount } from 'svelte';
	import L from 'leaflet';
	import 'leaflet/dist/leaflet.css';
	import 'leaflet/dist/images/marker-icon.png';

	export let latitude: number;
	export let longitude: number;

	let mapContainer: HTMLElement;
	let map: L.Map;
	let marker: L.Marker;

	function updatePosition(lat: number, lng: number) {
		latitude = parseFloat(lat.toFixed(5));
		longitude = parseFloat(lng.toFixed(5));
		if (marker) {
			marker.setLatLng([latitude, longitude]);
		}
	}

	// Watch for prop changes and update map
	$: if (
		map &&
		marker &&
		(latitude !== marker.getLatLng().lat || longitude !== marker.getLatLng().lng)
	) {
		const newPos = [latitude, longitude] as [number, number];
		marker.setLatLng(newPos);
		map.setView(newPos, map.getZoom());
	}

	onMount(() => {
		// Initialize the map
		map = L.map(mapContainer).setView([latitude, longitude], 8);

		// Add tile layer
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors'
		}).addTo(map);

		// Add marker
		marker = L.marker([latitude, longitude], {
			draggable: true
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
</style>
