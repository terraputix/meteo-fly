<script lang="ts">
	import { onMount } from 'svelte';
	import LocationMap from '$lib/components/LocationMap.svelte';

	import WindChart from './WindChart.svelte';
	import {
		fetchWeatherData,
		type Location,
		type WeatherDataType,
		type WeatherModel
	} from '$lib/api';
	import '../utils/dateExtensions';

	let location: Location = { latitude: 44.52, longitude: 9.41 };
	let selectedModel: WeatherModel = 'icon_seamless';
	let selectedDay: number = 1;

	$: startDate = new Date().addDays(selectedDay - 1);

	let weatherData: WeatherDataType | null = null;
	let error: string | null = null;

	// Timer for debouncing
	let updateTimer: number;
	let isUpdating: boolean = false;

	// Watch for changes in parameters
	$: {
		// just reference location,  selectedModel and selectedDay to trigger the watcher
		if (location && selectedModel && selectedDay) {
			isUpdating = true;
			clearTimeout(updateTimer);
			updateTimer = setTimeout(() => {
				updateWeather().then(() => {
					isUpdating = false;
				});
			}, 1500);
		}
	}

	async function updateWeather() {
		try {
			error = null;
			weatherData = await fetchWeatherData(location, selectedModel, startDate);
		} catch (err) {
			console.error(err);
			error = 'Failed to fetch weather data. Please try again.';
		}
	}

	onMount(() => {
		updateWeather().then(() => {
			isUpdating = false;
		});
	});
</script>

<div class="min-h-screen bg-gray-100 p-6">
	<div class="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-md">
		<h1 class="mb-6 text-center text-2xl font-bold">Icon Wind Chart</h1>

		<!-- Error Message -->
		{#if error}
			<div
				class="mb-6 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
				role="alert"
			>
				<span class="block sm:inline">{error}</span>
			</div>
		{/if}

		<!-- Input Form -->
		<div class="space-y-6">
			<!-- Location Inputs -->
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="latitude" class="block text-sm font-medium text-gray-700">Latitude</label>
					<input
						id="latitude"
						type="number"
						bind:value={location.latitude}
						placeholder="e.g., 44.52"
						step="0.01"
						class="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				<div>
					<label for="longitude" class="block text-sm font-medium text-gray-700">Longitude</label>
					<input
						id="longitude"
						type="number"
						bind:value={location.longitude}
						placeholder="e.g., 9.41"
						step="0.01"
						class="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
			</div>

			<!-- Model Selection -->
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="model" class="block text-sm font-medium text-gray-700">Weather Model</label>
					<select
						id="model"
						bind:value={selectedModel}
						class="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
					>
						<option value="icon_seamless">ICON Seamless</option>
						<option value="icon_d2">ICON D2</option>
						<option value="icon_eu">ICON EU</option>
						<option value="icon_global">ICON Global</option>
					</select>
				</div>

				<!-- Forecast Day Selection -->
				<div>
					<label for="forecast-day" class="block text-sm font-medium text-gray-700"
						>Forecast Day</label
					>
					<input
						id="forecast-day"
						type="number"
						bind:value={selectedDay}
						class="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
						max="16"
					/>
				</div>
			</div>
		</div>

		<!-- Location Map Display -->
		<div class="mt-4">
			<LocationMap bind:latitude={location.latitude} bind:longitude={location.longitude} />
		</div>

		<!-- Wind Chart Display -->
		{#if weatherData}
			<div class="relative mt-8">
				<WindChart {weatherData} />
				<p class="mt-2 text-right text-sm text-gray-500">
					<a href="https://open-meteo.com/" target="_blank" class="underline"
						>Weather data by Open-Meteo.com</a
					>.
				</p>
				<!-- if isUpdating is true display a spinner on top of the current chart -->
				{#if isUpdating}
					<div
						class="pointer-events-none absolute inset-0 flex items-center justify-center bg-white bg-opacity-50"
					>
						<svg
							class="h-8 w-8 animate-spin text-gray-500"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 50 50"
						>
							<circle
								class="opacity-25"
								cx="25"
								cy="25"
								r="20"
								stroke="currentColor"
								stroke-width="5"
								fill="none"
							></circle>
							<circle
								class="opacity-75"
								cx="25"
								cy="25"
								r="20"
								stroke="currentColor"
								stroke-width="5"
								stroke-linecap="round"
								fill="none"
								stroke-dasharray="31.4 31.4"
								transform="rotate(-90 25 25)"
							></circle>
						</svg>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
