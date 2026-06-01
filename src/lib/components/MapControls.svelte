<script lang="ts">
  import { domainOptions, type Domain } from '@openmeteo/weather-map-layer';
  import type { MaxAltitude } from '$lib/meteo/types';
  import {
    weatherMapVariables,
    pressureLevels,
    surfaceLevels,
    cloudLevels,
    convectiveCloudLevels,
  } from '$lib/services/weatherMap/manager';
  import type { DomainInfo } from '$lib/services/weatherMap/om_url';

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
    maxAltitude: MaxAltitude;
    onMaxAltitudeChange: (altitude: MaxAltitude) => void;
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
  }: Props = $props();

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
</div>
