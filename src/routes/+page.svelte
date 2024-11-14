<script lang="ts">
	import { onMount } from 'svelte';
	import { saveLastVisitedURL } from '$lib/services/storage';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import LocationMap from '$lib/components/LocationMap.svelte';

	import WindChart from './WindChart.svelte';
	import { fetchWeatherData, type WeatherDataType } from '$lib/api/api';
	import { type WeatherModel } from '$lib/api/types';
	import '../utils/dateExtensions';
	import { getInitialParameters } from '$lib/services/defaults';
	import { type PageParameters } from '$lib/services/types';

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

	const parameters = getInitialParameters($page.url.searchParams);

	// let location: Location = initialParameters.location;
	// let selectedModel: WeatherModel = initialParameters.selectedModel;
	// let selectedDay: number = initialParameters.selectedDay;

	$: startDate = new Date().addDays(parameters.selectedDay - 1);

	let weatherData: WeatherDataType | null = null;
	let error: string | null = null;

	// Timer for debouncing
	let updateTimer: number;
	let isUpdating: boolean = false;

	// URL parameter handling
	function updateURLParams(pageParams: PageParameters) {
		if (!browser) return;

		const params = new URLSearchParams({
			lat: pageParams.location.latitude.toString(),
			lon: pageParams.location.longitude.toString(),
			day: pageParams.selectedDay.toString(),
			model: pageParams.selectedModel
		});

		const newURL = `?${params.toString()}`;
		// Save the current URL to localStorage
		saveLastVisitedURL(newURL);
		goto(newURL, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	onMount(() => {
		// Get data for correct location
		updateWeather().then(() => {
			isUpdating = false;
		});
	});

	// Watch for parameter changes and update URL
	$: {
		// Make sure this page is already mounted, otherwise we will have racy behaviour between
		// the URL parameters and the initial fetch
		updateURLParams(parameters);

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
			weatherData = await fetchWeatherData(
				parameters.location,
				parameters.selectedModel,
				startDate
			);
		} catch (err) {
			console.error(err);
			error = 'Failed to fetch weather data. Please try again.';
		}
	}

	function handleNextDay(e: MouseEvent) {
		e.preventDefault();
		parameters.selectedDay += 1;
	}

	function handlePreviousDay(e: MouseEvent) {
		e.preventDefault();
		if (parameters.selectedDay > -14) {
			parameters.selectedDay -= 1;
		}
	}
</script>

<div class="min-h-screen bg-gray-100 p-2 sm:p-6">
	<div class="mx-auto max-w-5xl rounded-lg bg-white p-4 shadow-md sm:p-20">
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
						bind:value={parameters.location.latitude}
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
						bind:value={parameters.location.longitude}
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
						bind:value={parameters.selectedModel}
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
						bind:value={parameters.selectedDay}
						class="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
						max="7"
						min="-14"
					/>
				</div>
			</div>
		</div>

		<!-- Location Map Display -->
		<div class="mt-4">
			<LocationMap
				bind:latitude={parameters.location.latitude}
				bind:longitude={parameters.location.longitude}
			/>
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
				<div class="relative flex flex-col sm:block">
					<div class="mb-4 flex justify-between gap-20 sm:hidden">
						<button
							on:click={handlePreviousDay}
							disabled={parameters.selectedDay <= -14}
							class="flex-1 rounded bg-indigo-400 p-3 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-400"
							aria-label="Previous Day"
						>
							← Previous Day
						</button>

						<button
							on:click={handleNextDay}
							disabled={parameters.selectedDay >= 7}
							class="flex-1 rounded bg-indigo-400 p-3 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-400"
							aria-label="Next Day"
						>
							Next Day →
						</button>
					</div>

					<!-- Desktop navigation buttons -->
					<button
						on:click={handlePreviousDay}
						disabled={parameters.selectedDay <= -14}
						class="absolute left-0 top-1/2 hidden -translate-x-12 -translate-y-1/2 rounded bg-indigo-400 p-3 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-400 sm:block"
						aria-label="Previous Day"
					>
						←
					</button>

					<WindChart {weatherData} />

					<button
						on:click={handleNextDay}
						disabled={parameters.selectedDay >= 7}
						class="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-12 rounded bg-indigo-400 p-3 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-400 sm:block"
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
