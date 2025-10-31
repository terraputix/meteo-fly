<script lang="ts">
  import { onMount } from 'svelte';
  import { domainOptions } from '@openmeteo/mapbox-layer';
  import { weatherMapStore, weatherMapVariables } from '$lib/services/weatherMap/store';

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

  function handleVariableChange(event: Event) {
    const selectedVariable = (event.target as HTMLSelectElement).value;
    weatherMapStore.setVariable(selectedVariable);
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
    <select id="variable-select" on:change={handleVariableChange} value={weatherMapState.variable}>
      {#each weatherMapVariables as variable (variable.value)}
        <option value={variable.value} disabled={!weatherMapState.domainInfo?.variables.includes(variable.value)}>
          {variable.label}
        </option>
      {/each}
    </select>
  </div>
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
