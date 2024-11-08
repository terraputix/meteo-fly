<script lang="ts">
	import { onMount } from 'svelte';
	import { loadStoredParameters, saveParameters } from '$lib/services/storage';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import LocationMap from '$lib/components/LocationMap.svelte';

	import WindChart from './WindChart.svelte';
	import {
		fetchWeatherData,
		type Location,
		type WeatherDataType,
		type WeatherModel
	} from '$lib/api';
	import '../utils/dateExtensions';

	const models: { id: WeatherModel; name: string }[] = [
		{ id: 'icon_seamless', name: 'ICON Seamless' },
		{ id: 'icon_d2', name: 'ICON D2' },
		{ id: 'icon_eu', name: 'ICON EU' },
		{ id: 'icon_global', name: 'ICON Global' },
		{ id: 'gfs_seamless', name: 'GFS Seamless' },
		{ id: 'meteofrance_seamless', name: 'MeteoFrance' },
		{ id: 'ukmo_seamless', name: 'UKMO' },
		{ id: 'gem_seamless', name: 'GEM' },
		{ id: 'cma_grapes_global', name: 'CMA GRAPES' }
	];

	const initialParameters = loadStoredParameters();

	let location: Location = initialParameters?.location ?? { latitude: 44.52, longitude: 9.41 };
	let selectedModel: WeatherModel = initialParameters?.selectedModel ?? 'icon_seamless';
	let selectedDay: number = initialParameters?.selectedDay ?? 1;

	$: startDate = new Date().addDays(selectedDay - 1);

	let weatherData: WeatherDataType | null = null;
	let error: string | null = null;

	// Timer for debouncing
	let updateTimer: number;
	let isUpdating: boolean = false;

	// URL parameter handling
	function updateURLParams() {
		if (!browser) return;

		const params = new URLSearchParams({
			lat: location.latitude.toString(),
			lon: location.longitude.toString(),
			day: selectedDay.toString(),
			model: selectedModel
		});

		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	function readURLParams() {
		if (!browser) return;

		const params = $page.url.searchParams;

		location = {
			latitude: Number(params.get('lat')) || location.latitude,
			longitude: Number(params.get('lon')) || location.longitude
		};
		selectedDay = Number(params.get('day')) || selectedDay;
		selectedModel = (params.get('model') as WeatherModel) || selectedModel;
	}

	onMount(() => {
		// Initialize from URL parameters or stored parameters
		const stored = loadStoredParameters();
		if (stored) {
			location = stored.location;
			selectedModel = stored.selectedModel;
			selectedDay = stored.selectedDay;
		} else {
			readURLParams();
		}

		// Get data for correct location
		updateWeather().then(() => {
			isUpdating = false;
		});
	});

	// Watch for parameter changes and update URL and storage
	$: {
		// store in local storage
		saveParameters({
			location,
			selectedDay,
			selectedModel,
			lastUpdated: new Date().toISOString()
		});

		// also update URL parameters
		updateURLParams();

		// load updated forecast data
		isUpdating = true;
		clearTimeout(updateTimer);
		updateTimer = setTimeout(() => {
			updateWeather().then(() => {
				isUpdating = false;
			});
		}, 5);
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

	function nextDay() {
		selectedDay += 1;
	}

	function previousDay() {
		if (selectedDay > -14) {
			selectedDay -= 1;
		}
	}
</script>

<div class="min-h-screen bg-gray-100 p-6">
	<div class="mx-auto max-w-5xl rounded-lg bg-white p-20 shadow-md">
		<h1 class="mb-6 text-center text-2xl font-bold">Wind Chart</h1>

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
						{#each models as model}
							<option value={model.id}>{model.name}</option>
						{/each}
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
						max="7"
						min="-14"
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
				<!-- Date display above chart -->
				<div class="mb-4 text-center font-semibold text-gray-700">
					{startDate.toLocaleDateString('en-US', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric'
					})}
				</div>

				<!-- Chart container with navigation buttons -->
				<div class="relative">
					<button
						on:click={previousDay}
						disabled={selectedDay <= -14}
						class="absolute left-0 top-1/2 -translate-x-12 -translate-y-1/2 rounded bg-indigo-400 p-3 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-400"
						aria-label="Previous Day"
					>
						←
					</button>

					<WindChart {weatherData} />

					<button
						on:click={nextDay}
						disabled={selectedDay >= 7}
						class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 rounded bg-indigo-400 p-3 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-400"
						aria-label="Next Day"
					>
						→
					</button>
				</div>

				<p class="mt-2 text-right text-sm text-gray-500">
					<a href="https://open-meteo.com/" target="_blank" class="underline"
						>Weather data by Open-Meteo.com</a
					>.
				</p>

				<!-- Loading spinner overlay -->
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
