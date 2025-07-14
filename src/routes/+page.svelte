<script lang="ts">
  import { onMount } from 'svelte';
  import { saveLastVisitedURL } from '$lib/services/storage';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import LocationMap from '$lib/components/LocationMap.svelte';

  import WindChart from '$lib/components/WindChart.svelte';
  import { type WeatherModel, type WeatherDataType } from '$lib/api/types';
  import '../utils/dateExtensions';
  import { getInitialParameters } from '$lib/services/defaults';
  import { type PageParameters } from '$lib/services/types';
  import { fetchWeatherData } from '$lib/api/api';
  import { addDays } from '../utils/dateExtensions';

  const models: { id: WeatherModel; name: string }[] = [
    { id: 'icon_seamless', name: 'ICON Seamless' },
    { id: 'icon_d2', name: 'ICON D2' },
    { id: 'icon_eu', name: 'ICON EU' },
    { id: 'icon_global', name: 'ICON Global' },
    { id: 'gfs_seamless', name: 'GFS Seamless' },
    { id: 'meteofrance_seamless', name: 'MeteoFrance' },
    { id: 'ukmo_seamless', name: 'UKMO' },
    { id: 'gem_seamless', name: 'GEM' },
    { id: 'cma_grapes_global', name: 'CMA GRAPES' },
  ];

  const parameters = getInitialParameters($page.url.searchParams);

  $: startDate = addDays(new Date(), parameters.selectedDay - 1);

  let weatherData: WeatherDataType | null = null;
  let error: string | null = null;

  // Timer for debouncing
  let updateTimer: number;

  // URL parameter handling
  function updateURLParams(pageParams: PageParameters) {
    if (!browser) return;

    const params = new URLSearchParams({
      lat: pageParams.location.latitude.toString(),
      lon: pageParams.location.longitude.toString(),
      day: pageParams.selectedDay.toString(),
      model: pageParams.selectedModel,
    });

    const newURL = `?${params.toString()}`;
    // Save the current URL to localStorage
    saveLastVisitedURL(newURL);
    goto(newURL, {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
  }

  onMount(() => {
    // Get data for correct location
    updateWeather();
  });

  // Watch for parameter changes and update URL
  $: {
    // Make sure this page is already mounted, otherwise we will have racy behaviour between
    // the URL parameters and the initial fetch
    updateURLParams(parameters);

    // load updated forecast data
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateWeather();
    }, 5);
  }

  async function updateWeather() {
    try {
      error = null;
      weatherData = await fetchWeatherData(parameters.location, parameters.selectedModel, startDate);
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

<div class="bg-white p-2 sm:p-4">
  <div class="p-2 sm:p-4">
    <h1 class="mb-6 text-center text-2xl font-bold">Meteo-Fly Wind Chart</h1>

    <!-- Error Message -->
    {#if error}
      <div class="mb-4 bg-red-50 px-4 py-3 text-red-700" role="alert">
        <span class="block sm:inline">{error}</span>
      </div>
    {/if}

    <!-- Input Form -->
    <div class="mb-4">
      <!-- Compact Controls -->
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <!-- Location Display -->
        <div class="flex items-center text-sm text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" class="mr-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clip-rule="evenodd"
            />
          </svg>
          <span>{parameters.location.latitude.toFixed(4)}°, {parameters.location.longitude.toFixed(4)}°</span>
        </div>

        <!-- Model and Day Selection -->
        <div class="flex flex-wrap items-center gap-3">
          <!-- Model Selection -->
          <div class="flex items-center">
            <label for="model" class="mr-2 text-sm font-medium whitespace-nowrap text-gray-700">Model:</label>
            <select
              id="model"
              bind:value={parameters.selectedModel}
              class="rounded-sm bg-white px-2 py-1 text-sm focus:outline-indigo-500"
            >
              {#each models as model (model.id)}
                <option value={model.id}>{model.name}</option>
              {/each}
            </select>
          </div>

          <!-- Forecast Day Selection -->
          <div class="flex items-center">
            <label for="forecast-day" class="mr-2 text-sm font-medium whitespace-nowrap text-gray-700">Day:</label>
            <input
              id="forecast-day"
              type="number"
              bind:value={parameters.selectedDay}
              class="w-16 rounded-sm px-2 py-1 text-sm focus:outline-indigo-500"
              max="7"
              min="-14"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Location Map Display -->
    <div>
      <LocationMap bind:latitude={parameters.location.latitude} bind:longitude={parameters.location.longitude} />
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
            day: 'numeric',
          })}
        </div>

        <!-- Chart container with navigation buttons -->
        <div class="relative flex flex-col sm:block">
          <div class="mb-3 flex justify-between gap-4 sm:hidden">
            <button
              on:click={handlePreviousDay}
              disabled={parameters.selectedDay <= -14}
              class="flex-1 rounded bg-indigo-500 p-2 text-sm text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300"
              aria-label="Previous Day"
            >
              ← Previous Day
            </button>

            <button
              on:click={handleNextDay}
              disabled={parameters.selectedDay >= 7}
              class="flex-1 rounded bg-indigo-500 p-2 text-sm text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300"
              aria-label="Next Day"
            >
              Next Day →
            </button>
          </div>

          <!-- Desktop navigation buttons -->
          <button
            on:click={handlePreviousDay}
            disabled={parameters.selectedDay <= -14}
            class="absolute top-1/2 left-0 hidden -translate-x-8 -translate-y-1/2 rounded bg-indigo-500 p-2 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300 sm:block"
            aria-label="Previous Day"
          >
            ←
          </button>

          <WindChart {weatherData} />

          <button
            on:click={handleNextDay}
            disabled={parameters.selectedDay >= 7}
            class="absolute top-1/2 right-0 hidden translate-x-8 -translate-y-1/2 rounded bg-indigo-500 p-2 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300 sm:block"
            aria-label="Next Day"
          >
            →
          </button>
        </div>

        <p class="mt-2 text-right text-sm text-gray-500">
          <a href="https://open-meteo.com/" target="_blank" class="underline">Weather data by Open-Meteo.com</a>
        </p>
      </div>
    {:else}
      <div class="my-10 flex flex-col items-center justify-center text-center text-gray-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mb-4 h-16 w-16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1"
            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
          />
        </svg>
        <p>Select a location on the map to view weather data</p>
      </div>
    {/if}
  </div>
</div>
