import { domainOptions, type Domain } from '@openmeteo/mapbox-layer';
import { writable, derived, get } from 'svelte/store';
import type maplibregl from 'maplibre-gl';
import type { DomainInfo } from './om_url';
import { fetchDomainInfo } from './url';

export interface WeatherMapState {
  bounds: maplibregl.LngLatBounds | null;
  paddedBounds: maplibregl.LngLatBounds | null;
  domain: Domain;
  variable: string;
  baseVariable: string;
  level: string | null;
  datetime: string;
  domainInfo: DomainInfo | null;
}

function getCurrentDatetime(): string {
  const now = new Date();
  // Round down to the nearest hour
  now.setMinutes(0, 0, 0);
  return now.toISOString().slice(0, 16); // Returns YYYY-MM-DDTHH:MM format
}

// Initial values
const initialDomain = domainOptions.find((option) => option.value === 'dwd_icon')!;
const initialVariable = 'temperature_2m';
const initialBaseVariable = 'temperature';
const initialLevel = '_2m';
const initialDatetime = getCurrentDatetime();

// Separate stores for different concerns
export const domain = writable<Domain>(initialDomain);
export const variableStore = writable<string>(initialVariable);
export const baseVariable = writable<string>(initialBaseVariable);
export const level = writable<string | null>(initialLevel);
export const datetime = writable<string>(initialDatetime);

// Map-related stores (separate from weather data)
export const bounds = writable<maplibregl.LngLatBounds | null>(null);
export const paddedBounds = writable<maplibregl.LngLatBounds | null>(null);

// Domain info store (only updates when domain changes)
export const domainInfo = writable<DomainInfo | null>(null);

// Derived store for weather config changes
export const weatherConfig = derived([domain, variableStore, datetime], ([$domain, $variableStore, $datetime]) => ({
  domain: $domain,
  variable: $variableStore,
  datetime: $datetime,
}));

// Combined store for URL building
export const weatherMapStore = derived(
  [domain, variableStore, baseVariable, level, datetime, bounds, paddedBounds, domainInfo],
  ([$domain, $variableStore, $baseVariable, $level, $datetime, $bounds, $paddedBounds, $domainInfo]) => ({
    domain: $domain,
    variable: $variableStore,
    baseVariable: $baseVariable,
    level: $level,
    datetime: $datetime,
    bounds: $bounds,
    paddedBounds: $paddedBounds,
    domainInfo: $domainInfo,
  })
);

// Derived store for available levels
export const availableLevels = derived([baseVariable, domainInfo], ([$baseVariable, $domainInfo]) => {
  if (!$domainInfo) return [];

  let levels: { label: string; value: string }[] = [];

  if ($baseVariable === 'cloud_cover') {
    levels = cloudLevels;
  } else if ($baseVariable === 'convective_cloud') {
    levels = convectiveCloudLevels;
  } else {
    levels = [...surfaceLevels, ...pressureLevels];
  }

  return levels.filter((level) => $domainInfo.variables.includes(`${$baseVariable}${level.value}`));
});

export const weatherMapVariables = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'relative_humidity', label: 'Relative Humidity' },
  { value: 'wind_u_component', label: 'Wind' },
  { value: 'cape', label: 'CAPE' },
  { value: 'precipitation', label: 'Precipitation' },
  { value: 'cloud_cover', label: 'Cloud Cover' },
  { value: 'convective_cloud', label: 'Convective Cloud' },
  { value: 'freezing_level_height', label: 'Freezing Level' },
];

export const pressureLevels: { label: string; value: string }[] = [
  { label: '1000hPa', value: '_1000hPa' },
  { label: '950hPa', value: '_950hPa' },
  { label: '925hPa', value: '_925hPa' },
  { label: '900hPa', value: '_900hPa' },
  { label: '850hPa', value: '_850hPa' },
  { label: '800hPa', value: '_800hPa' },
  { label: '700hPa', value: '_700hPa' },
  { label: '600hPa', value: '_600hPa' },
  { label: '500hPa', value: '_500hPa' },
  { label: '400hPa', value: '_400hPa' },
  { label: '300hPa', value: '_300hPa' },
  { label: '250hPa', value: '_250hPa' },
  { label: '200hPa', value: '_200hPa' },
  { label: '150hPa', value: '_150hPa' },
  { label: '100hPa', value: '_100hPa' },
  { label: '70hPa', value: '_70hPa' },
  { label: '50hPa', value: '_50hPa' },
  { label: '30hPa', value: '_30hPa' },
];

export const surfaceLevels: { label: string; value: string }[] = [
  { label: '2m', value: '_2m' },
  { label: '10m', value: '_10m' },
];

export const cloudLevels: { label: string; value: string }[] = [
  { label: 'Total', value: '' },
  { label: 'Low', value: '_low' },
  { label: 'Mid', value: '_mid' },
  { label: 'High', value: '_high' },
];

export const convectiveCloudLevels: { label: string; value: string }[] = [
  { label: 'Base', value: '_base' },
  { label: 'Top', value: '_top' },
];

// Utility functions
const constructVariableName = (baseVariable: string, level: string | null): string => {
  if (level) {
    return `${baseVariable}${level}`;
  }
  return baseVariable;
};

const findDefaultLevel = (baseVariable: string, availableVariables: string[]): string | null => {
  if (baseVariable === 'cloud_cover') {
    for (const level of cloudLevels) {
      if (availableVariables.includes(`${baseVariable}${level.value}`)) {
        return level.value;
      }
    }
  } else if (baseVariable === 'convective_cloud') {
    for (const level of convectiveCloudLevels) {
      if (availableVariables.includes(`${baseVariable}${level.value}`)) {
        return level.value;
      }
    }
  } else {
    const preferredLevels = [...surfaceLevels, ...pressureLevels];
    for (const level of preferredLevels) {
      if (availableVariables.includes(`${baseVariable}${level.value}`)) {
        return level.value;
      }
    }
  }

  if (availableVariables.includes(baseVariable)) {
    return null;
  }

  return null;
};

// Pure functions for business logic
export const setBaseVariableLogic = (
  newBaseVariable: string,
  currentLevel: string | null,
  currentDomainInfo: DomainInfo | null
) => {
  let finalLevel = currentLevel;
  if (currentDomainInfo) {
    const availableVariables = currentDomainInfo.variables;
    const currentVariable = constructVariableName(newBaseVariable, currentLevel);
    if (!availableVariables.includes(currentVariable)) {
      finalLevel = findDefaultLevel(newBaseVariable, availableVariables);
    }
  }

  const finalVariable = constructVariableName(newBaseVariable, finalLevel);

  return {
    baseVariable: newBaseVariable,
    level: finalLevel,
    variable: finalVariable,
  };
};

export const setLevelLogic = (newLevel: string | null, currentBaseVariable: string) => {
  const finalVariable = constructVariableName(currentBaseVariable, newLevel);

  return {
    level: newLevel,
    variable: finalVariable,
  };
};

// Store update functions
export const updateBaseVariable = (newBaseVariable: string) => {
  const currentLevel = get(level);
  const currentDomainInfo = get(domainInfo);

  const result = setBaseVariableLogic(newBaseVariable, currentLevel, currentDomainInfo);

  baseVariable.set(result.baseVariable);
  level.set(result.level);
  variableStore.set(result.variable);
};

export const updateLevel = (newLevel: string | null) => {
  const currentBaseVariable = get(baseVariable);

  const result = setLevelLogic(newLevel, currentBaseVariable);

  level.set(result.level);
  variableStore.set(result.variable);
};

export const updateDomain = async (newDomain: Domain) => {
  const domInfo = await fetchDomainInfo(newDomain);
  domainInfo.set(domInfo);
  domain.set(newDomain);

  // Validate and potentially update the current variable
  const currentVariable = get(variableStore);
  const currentBaseVariable = get(baseVariable);
  const currentLevel = get(level);

  if (!domInfo.variables.includes(currentVariable)) {
    const result = setBaseVariableLogic(currentBaseVariable, currentLevel, domInfo);
    baseVariable.set(result.baseVariable);
    level.set(result.level);
    variableStore.set(result.variable);
  }
};

export const assertVariableExistsOrDefault = (variableName: string) => {
  const currentDomainInfo = get(domainInfo);
  if (!currentDomainInfo) {
    throw new Error('No domain info available');
  }

  const availableVariables = currentDomainInfo.variables;
  if (availableVariables.includes(variableName)) {
    return variableName;
  }
  // else parse the weatherMapVariables and return the first matching variable
  for (const variable of weatherMapVariables) {
    if (variableName.startsWith(variable.value)) {
      // find default value for this variable
      const defaultValue = findDefaultLevel(variable.value, availableVariables);
      return defaultValue;
    }
  }
};

export const setLevel = (newLevel: string | null) => {
  const currentBaseVariable = get(baseVariable);
  const finalVariable = constructVariableName(currentBaseVariable, newLevel);

  level.set(newLevel);
  variableStore.set(finalVariable);
};

// Store actions
export const weatherMapActions = {
  setBounds: (newBounds: maplibregl.LngLatBounds) => {
    bounds.set(newBounds);
  },

  setPaddedBounds: (newPaddedBounds: maplibregl.LngLatBounds) => {
    paddedBounds.set(newPaddedBounds);
  },

  setDatetime: (newDatetime: string) => {
    datetime.set(newDatetime);
  },

  reset: () => {
    domain.set(initialDomain);
    variableStore.set(initialVariable);
    baseVariable.set(initialBaseVariable);
    level.set(initialLevel);
    datetime.set(initialDatetime);
    bounds.set(null);
    paddedBounds.set(null);
    domainInfo.set(null);
  },
};
