<script lang="ts">
  import type { WeatherModel } from '$lib/api/types';
  import type { PageParameters } from '$lib/services/types';
  import { createEventDispatcher } from 'svelte';

  export let parameters: PageParameters;

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

  const dispatch = createEventDispatcher();
  function openChart() {
    dispatch('openChart');
  }
</script>

<div class="flex flex-wrap items-center justify-between gap-2">
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
    <button
      class="mr-2 ml-2 rounded bg-indigo-500 px-4 py-2 text-sm text-white transition hover:bg-indigo-700"
      on:click={openChart}
      aria-label="Show chart for current location"
    >
      Show Chart
    </button>
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
