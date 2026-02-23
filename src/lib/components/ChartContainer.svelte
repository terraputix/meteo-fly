<script lang="ts">
  import type { WeatherDataType } from '$lib/api/types';
  import WindChart from './WindChart.svelte';
  import { createEventDispatcher } from 'svelte';
  import Footer from './Footer.svelte';

  export let weatherData: WeatherDataType;
  export let startDate: Date;
  export let selectedDay: number;
  export let onSelectedDayChange: (day: number) => void;

  const dispatch = createEventDispatcher();

  function handleNextDay(e: MouseEvent) {
    e.preventDefault();
    onSelectedDayChange(selectedDay + 1);
  }

  function handlePreviousDay(e: MouseEvent) {
    e.preventDefault();
    if (selectedDay > -14) {
      onSelectedDayChange(selectedDay - 1);
    }
  }

  function close() {
    dispatch('close');
  }
</script>

<div class="relative bg-white p-2 sm:overflow-y-auto sm:px-8 sm:py-4">
  <button
    on:click={close}
    class="absolute top-2 right-2 border-none bg-transparent text-gray-500 hover:text-gray-800"
    aria-label="Close chart"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>

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
  <div class="relative flex flex-col">
    <div class="mb-3 flex justify-between gap-4">
      <button
        on:click={handlePreviousDay}
        disabled={selectedDay <= -14}
        class="flex-1 rounded bg-indigo-500 p-2 text-sm text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300"
        aria-label="Previous Day"
      >
        &larr; Previous Day
      </button>

      <button
        on:click={handleNextDay}
        disabled={selectedDay >= 7}
        class="flex-1 rounded bg-indigo-500 p-2 text-sm text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300"
        aria-label="Next Day"
      >
        Next Day &rarr;
      </button>
    </div>

    <WindChart {weatherData} />
  </div>

  <p class="mt-2 text-right text-sm text-gray-500">
    <a href="https://open-meteo.com/" target="_blank" class="underline">Weather data by Open-Meteo.com</a>
  </p>

  <div class="mt-4">
    <Footer />
  </div>
</div>
