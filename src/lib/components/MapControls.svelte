<script lang="ts">
  import { domainOptions, type Domain } from '@openmeteo/mapbox-layer';
  import {
    weatherMapVariables,
    pressureLevels,
    surfaceLevels,
    cloudLevels,
    convectiveCloudLevels,
  } from '$lib/services/weatherMap/manager';
  import type { DomainInfo } from '$lib/services/weatherMap/om_url';
  import type { Location, WeatherModel } from '$lib/api/types';

  interface Props {
    currentDomain: Domain;
    currentBaseVariable: string;
    currentLevel: string | null;
    domainInfo: DomainInfo | null;
    availableLevels: { label: string; value: string }[];
    onDomainChange: (domainValue: string) => void;
    onBaseVariableChange: (baseVariable: string) => void;
    onLevelChange: (level: string) => void;

    // New props from Controls.svelte
    latitude: number;
    longitude: number;
    selectedDay: number;
    selectedModel: WeatherModel;
    onLocationChange: (location: Location) => void;
    onSelectedDayChange: (day: number) => void;
    onSelectedModelChange: (model: WeatherModel) => void;
    onOpenChart: () => void;
  }

  let {
    currentDomain,
    currentBaseVariable,
    currentLevel,
    domainInfo,
    availableLevels,
    onDomainChange,
    onBaseVariableChange,
    onLevelChange,

    latitude,
    longitude,
    selectedDay,
    selectedModel,
    // onLocationChange,
    onSelectedDayChange,
    onSelectedModelChange,
    onOpenChart,
  }: Props = $props();

  // Models array from Controls.svelte
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

  function handleDomainChange(event: Event) {
    const selectedDomainValue = (event.target as HTMLSelectElement).value;
    onDomainChange(selectedDomainValue);
  }

  function handleBaseVariableChange(event: Event) {
    const selectedVariable = (event.target as HTMLSelectElement).value;
    onBaseVariableChange(selectedVariable);
  }

  function handleLevelChange(event: Event) {
    const selectedLevel = (event.target as HTMLSelectElement).value;
    onLevelChange(selectedLevel);
  }

  // New handlers for selectedModel and selectedDay
  function handleSelectedModelChange(event: Event) {
    const newModel = (event.target as HTMLSelectElement).value as WeatherModel;
    onSelectedModelChange(newModel);
  }

  function handleSelectedDayChange(event: Event) {
    const newDay = parseInt((event.target as HTMLInputElement).value, 10);
    onSelectedDayChange(newDay);
  }

  function isVariableAvailable(baseVar: string) {
    if (!domainInfo) return false;

    if (domainInfo.variables.includes(baseVar)) {
      return true;
    }

    let levels: { label: string; value: string }[] = [];

    if (baseVar === 'cloud_cover') {
      levels = cloudLevels;
    } else if (baseVar === 'convective_cloud') {
      levels = convectiveCloudLevels;
    } else {
      levels = [...surfaceLevels, ...pressureLevels];
    }

    return levels.some((level) => domainInfo.variables.includes(`${baseVar}${level.value}`));
  }
</script>

<div
  class="map-controls flex flex-wrap items-center gap-4 rounded-lg bg-white/80 p-2 shadow-lg backdrop-blur-sm dark:bg-gray-800/80"
>
  <div class="flex items-center gap-2">
    <label for="domain-select" class="text-sm font-medium text-gray-700 dark:text-gray-300">Domain</label>
    <select
      id="domain-select"
      onchange={handleDomainChange}
      value={currentDomain.value}
      class="rounded-md border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    >
      {#each domainOptions as domainOption (domainOption.value)}
        <option value={domainOption.value}>{domainOption.label}</option>
      {/each}
    </select>
  </div>

  <div class="flex items-center gap-2">
    <label for="variable-select" class="text-sm font-medium text-gray-700 dark:text-gray-300">Variable</label>
    <select
      id="variable-select"
      onchange={handleBaseVariableChange}
      value={currentBaseVariable}
      class="rounded-md border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    >
      {#each weatherMapVariables as variable (variable.value)}
        <option value={variable.value} disabled={!isVariableAvailable(variable.value)}>
          {variable.label}
        </option>
      {/each}
    </select>
  </div>

  {#if availableLevels.length > 0}
    <div class="flex items-center gap-2">
      <label for="level-select" class="text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
      <select
        id="level-select"
        onchange={handleLevelChange}
        value={currentLevel}
        class="rounded-md border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      >
        {#each availableLevels as levelOption (levelOption.value)}
          <option value={levelOption.value}>{levelOption.label}</option>
        {/each}
      </select>
    </div>
  {/if}

  <!-- Location and Chart Button -->
  <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
        clip-rule="evenodd"
      />
    </svg>
    <span>{latitude.toFixed(4)}°, {longitude.toFixed(4)}°</span>
    <button
      class="ml-2 rounded-md bg-indigo-600 px-3 py-1 text-sm text-white shadow-sm transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
      onclick={onOpenChart}
      aria-label="Show chart for current location"
    >
      Show Chart
    </button>
  </div>

  <!-- Model and Day Selection -->
  <div class="flex flex-wrap items-center gap-4">
    <div class="flex items-center gap-2">
      <label for="model" class="text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
      <select
        id="model"
        onchange={handleSelectedModelChange}
        value={selectedModel}
        class="rounded-md border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      >
        {#each models as model (model.id)}
          <option value={model.id}>{model.name}</option>
        {/each}
      </select>
    </div>

    <div class="flex items-center gap-2">
      <label for="forecast-day" class="text-sm font-medium text-gray-700 dark:text-gray-300">Day</label>
      <input
        id="forecast-day"
        type="number"
        onchange={handleSelectedDayChange}
        value={selectedDay}
        class="w-20 rounded-md border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        max="7"
        min="-14"
      />
    </div>
  </div>
</div>
