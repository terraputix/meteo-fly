<svelte:options customElement="wind-chart-plugin" />

<script lang="ts">
  import WindChart from './WindChart.svelte';
  import { fetchWeatherData } from '$lib/api/api';
  import type { WeatherDataType, WeatherModel } from '$lib/api/types';
  import { addDays } from '$lib/utils/date';

  export let latitude: number;
  export let longitude: number;
  export let model: WeatherModel;
  export let day: number = 1;

  let weatherData: WeatherDataType | null = null;
  let loading = false;

  $: startDate = addDays(new Date(), day - 1);

  async function updateWeather() {
    loading = true;
    try {
      weatherData = await fetchWeatherData({ latitude, longitude }, model, startDate);
    } catch {
      weatherData = null;
    } finally {
      loading = false;
    }
  }

  // Fetch on mount and whenever inputs change
  $: if (latitude != null && longitude != null && model && day != null) {
    updateWeather();
  }
</script>

<div>
  {#if weatherData}
    <WindChart {weatherData} />
  {:else}
    <div>No data available.</div>
  {/if}

  <p class="mt-2 text-right text-sm text-gray-500">
    <a href="https://open-meteo.com/" target="_blank" class="underline">Weather data by Open-Meteo.com</a>.
  </p>

  <!-- Loading spinner overlay -->
  {#if loading}
    <div class="bg-opacity-50 pointer-events-none absolute inset-0 flex items-center justify-center bg-white">
      <svg class="h-8 w-8 animate-spin text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
        <circle class="opacity-25" cx="25" cy="25" r="20" stroke="currentColor" stroke-width="5" fill="none"></circle>
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
