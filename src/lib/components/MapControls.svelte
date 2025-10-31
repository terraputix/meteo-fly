<script lang="ts">
  import { onMount } from 'svelte';
  import { domainOptions } from '@openmeteo/mapbox-layer';
  import {
    weatherMapStore,
    weatherMapVariables,
    pressureLevels,
    surfaceLevels,
    cloudLevels,
    convectiveCloudLevels,
  } from '$lib/services/weatherMap/store';

  let weatherMapState: import('$lib/services/weatherMap/store').WeatherMapState;
  weatherMapStore.subscribe((state) => {
    weatherMapState = state;
  });

  onMount(() => {
    // Fetch initial domain info
    weatherMapStore.fetchDomainInfo(weatherMapState.domain);
  });

  function handleDomainChange(event: Event) {
    const selectedDomainValue = (event.target as HTMLSelectElement).value;
    const selectedDomain = domainOptions.find((d) => d.value === selectedDomainValue);
    if (selectedDomain) {
      weatherMapStore.setDomain(selectedDomain);
    }
  }

  function handleBaseVariableChange(event: Event) {
    const selectedVariable = (event.target as HTMLSelectElement).value;
    weatherMapStore.setBaseVariable(selectedVariable);
  }

  function handleLevelChange(event: Event) {
    const selectedLevel = (event.target as HTMLSelectElement).value;
    weatherMapStore.setLevel(selectedLevel);
  }

  $: availableLevels = (() => {
    if (!weatherMapState.domainInfo) return [];
    const { baseVariable, domainInfo } = weatherMapState;
    let levels: { label: string; value: string }[] = [];

    if (baseVariable === 'cloud_cover') {
      levels = cloudLevels;
    } else if (baseVariable === 'convective_cloud') {
      levels = convectiveCloudLevels;
    } else {
      levels = [...surfaceLevels, ...pressureLevels];
    }

    return levels.filter((level) => domainInfo.variables.includes(`${baseVariable}${level.value}`));
  })();

  function isVariableAvailable(baseVar: string) {
    if (!weatherMapState.domainInfo) return false;
    const { domainInfo } = weatherMapState;

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

<div class="map-controls">
  <div class="control-group">
    <label for="domain-select">Domain</label>
    <select id="domain-select" on:change={handleDomainChange} value={weatherMapState.domain.value}>
      {#each domainOptions as domain (domain.value)}
        <option value={domain.value}>{domain.label}</option>
      {/each}
    </select>
  </div>

  <div class="control-group">
    <label for="variable-select">Variable</label>
    <select id="variable-select" on:change={handleBaseVariableChange} value={weatherMapState.baseVariable}>
      {#each weatherMapVariables as variable (variable.value)}
        <option value={variable.value} disabled={!isVariableAvailable(variable.value)}>
          {variable.label}
        </option>
      {/each}
    </select>
  </div>

  {#if availableLevels.length > 0}
    <div class="control-group">
      <label for="level-select">Level</label>
      <select id="level-select" on:change={handleLevelChange} value={weatherMapState.level}>
        {#each availableLevels as level (level.value)}
          <option value={level.value}>{level.label}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>

<style>
  .map-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  @media (min-width: 768px) {
    .map-controls {
      flex-direction: row;
      gap: 1rem;
    }
  }

  .control-group {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  @media (min-width: 768px) {
    .control-group {
      width: auto;
    }
  }

  .time-slider {
    flex-grow: 1;
  }
</style>
