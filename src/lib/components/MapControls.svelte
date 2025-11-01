<script lang="ts">
  import { domainOptions, type Domain } from '@openmeteo/mapbox-layer';
  import {
    weatherMapVariables,
    pressureLevels,
    surfaceLevels,
    cloudLevels,
    convectiveCloudLevels,
  } from '$lib/services/weatherMap/manager'; // Constants are now in manager.ts
  import type { DomainInfo } from '$lib/services/weatherMap/om_url';

  interface Props {
    currentDomain: Domain;
    currentBaseVariable: string;
    currentLevel: string | null;
    domainInfo: DomainInfo | null;
    availableLevels: { label: string; value: string }[];
    onDomainChange: (domainValue: string) => void; // Changed to void as manager handles async
    onBaseVariableChange: (baseVariable: string) => void;
    onLevelChange: (level: string) => void;
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

<div class="map-controls">
  <div class="control-group">
    <label for="domain-select">Domain</label>
    <select id="domain-select" onchange={handleDomainChange} value={currentDomain.value}>
      {#each domainOptions as domainOption (domainOption.value)}
        <option value={domainOption.value}>{domainOption.label}</option>
      {/each}
    </select>
  </div>

  <div class="control-group">
    <label for="variable-select">Variable</label>
    <select id="variable-select" onchange={handleBaseVariableChange} value={currentBaseVariable}>
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
      <select id="level-select" onchange={handleLevelChange} value={currentLevel}>
        {#each availableLevels as levelOption (levelOption.value)}
          <option value={levelOption.value}>{levelOption.label}</option>
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
</style>
