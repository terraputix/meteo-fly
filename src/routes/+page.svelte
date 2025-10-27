<script lang="ts">
  import { onMount } from 'svelte';
  import { saveLastVisitedURL } from '$lib/services/storage';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import LocationMap from '$lib/components/LocationMap.svelte';
  import Controls from '$lib/components/Controls.svelte';

  import ChartContainer from '../lib/components/ChartContainer.svelte';
  import { getInitialParameters } from '$lib/services/defaults';
  import { addDays } from '../utils/dateExtensions';
  import type { WeatherDataType } from '$lib/api/types';
  import { type PageParameters } from '$lib/services/types';
  import { fetchWeatherData } from '$lib/api/api';

  let parameters = getInitialParameters($page.url.searchParams);

  $: startDate = addDays(new Date(), parameters.selectedDay - 1);

  let showChart = false;
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
    history.replaceState({}, '', newURL);
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
    handleOpenChart();
  }

  function handleClose() {
    showChart = false;
  }

  function handleOpenChart() {
    showChart = true;
  }
</script>

<div class="flex h-screen flex-col-reverse sm:grid {showChart ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}">
  <!-- Map container -->
  <div class="relative h-full w-full">
    <LocationMap bind:latitude={parameters.location.latitude} bind:longitude={parameters.location.longitude} />

    <!-- Controls overlay for desktop -->
    <div class="absolute top-0 right-0 left-0 hidden bg-white/80 p-4 sm:block">
      <Controls bind:parameters on:openChart={() => handleOpenChart()} />
    </div>
  </div>

  <!-- Chart and controls container -->
  {#if showChart && weatherData}
    <div class="flex flex-col sm:overflow-y-auto">
      <div class="flex-grow bg-white p-2 sm:p-4">
        {#if error}
          <div class="mb-4 bg-red-50 px-4 py-3 text-red-700" role="alert">
            <span class="block sm:inline">{error}</span>
          </div>
        {/if}

        <ChartContainer {weatherData} {startDate} bind:selectedDay={parameters.selectedDay} on:close={handleClose} />
      </div>
    </div>
  {/if}
  <!-- Controls above chart for mobile -->
  <div class="z-10 block w-full bg-white/80 p-4 sm:hidden">
    <Controls bind:parameters on:openChart={() => handleOpenChart()} />
  </div>
</div>
