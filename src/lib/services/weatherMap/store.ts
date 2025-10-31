import { domainOptions, type Domain } from '@openmeteo/mapbox-layer';
import { writable } from 'svelte/store';

export interface DomainInfo {
  variables: string[];
  valid_times: string[];
  reference_time: string;
}

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

const initialState: WeatherMapState = {
  bounds: null,
  paddedBounds: null,
  domain: domainOptions.find((option) => option.value === 'dwd_icon')!,
  variable: 'temperature_2m',
  baseVariable: 'temperature',
  level: '_2m',
  datetime: getCurrentDatetime(),
  domainInfo: null,
};

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

function createWeatherMapStore() {
  const { subscribe, set, update } = writable<WeatherMapState>(initialState);

  function constructVariableName(baseVariable: string, level: string | null): string {
    if (level) {
      return `${baseVariable}${level}`;
    }
    return baseVariable;
  }

  function findDefaultLevel(baseVariable: string, availableVariables: string[]): string | null {
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
  }

  async function fetchDomainInfo(domain: Domain) {
    try {
      const response = await fetch(`https://openmeteo.s3.amazonaws.com/data_spatial/${domain.value}/latest.json`);
      if (!response.ok) {
        throw new Error('Failed to fetch domain info');
      }
      const data = await response.json();
      update((state) => ({
        ...state,
        domainInfo: {
          variables: data.variables.map((v: string) => v),
          valid_times: data.valid_times,
          reference_time: data.reference_time,
        },
      }));
    } catch (error) {
      console.error('Error fetching domain info:', error);
      update((state) => ({ ...state, domainInfo: null }));
    }
  }

  return {
    subscribe,
    setBounds: (bounds: maplibregl.LngLatBounds) => update((state) => ({ ...state, bounds })),
    setPaddedBounds: (paddedBounds: maplibregl.LngLatBounds) => update((state) => ({ ...state, paddedBounds })),
    setDomain: (domain: Domain) => {
      update((state) => ({ ...state, domain }));
      fetchDomainInfo(domain);
    },
    setVariable: (variable: string) => update((state) => ({ ...state, variable })),
    setDatetime: (datetime: string) => update((state) => ({ ...state, datetime })),
    setBaseVariable: (baseVariable: string) =>
      update((state) => {
        let level = state.level;
        if (state.domainInfo) {
          const availableVariables = state.domainInfo.variables;
          const currentVariable = constructVariableName(baseVariable, level);
          if (!availableVariables.includes(currentVariable)) {
            level = findDefaultLevel(baseVariable, availableVariables);
          }
        }
        const variable = constructVariableName(baseVariable, level);
        return { ...state, baseVariable, level, variable };
      }),
    setLevel: (level: string | null) =>
      update((state) => {
        const variable = constructVariableName(state.baseVariable, level);
        return { ...state, level, variable };
      }),
    setInitialState: (initialState: Partial<WeatherMapState>) =>
      update((state) => ({ ...state, ...initialState })),
    reset: () => set(initialState),
    fetchDomainInfo,
  };
}

export const weatherMapStore = createWeatherMapStore();

// Helper function to build the Open-Meteo URL
export function buildOpenMeteoUrl(state: WeatherMapState): string {
  const { paddedBounds, domain, variable, datetime, domainInfo } = state;

  // Parse the reference time from domain info
  const referenceTimeObj = new Date(domainInfo!.reference_time);
  const refYear = referenceTimeObj.getUTCFullYear();
  const refMonth = String(referenceTimeObj.getUTCMonth() + 1).padStart(2, '0');
  const refDay = String(referenceTimeObj.getUTCDate()).padStart(2, '0');
  const refHour = String(referenceTimeObj.getUTCHours()).padStart(2, '0');
  const refMinute = String(referenceTimeObj.getUTCMinutes()).padStart(2, '0');

  // Format reference time for URL path (HHMMZ)
  const formattedReferenceTime = `${refYear}/${refMonth}/${refDay}/${refHour}${refMinute}Z`;

  // Parse the valid time (datetime from store)
  const validTimeObj = new Date(datetime);
  const validYear = validTimeObj.getUTCFullYear();
  const validMonth = String(validTimeObj.getUTCMonth() + 1).padStart(2, '0');
  const validDay = String(validTimeObj.getUTCDate()).padStart(2, '0');
  const validHour = String(validTimeObj.getUTCHours()).padStart(2, '0');
  const validMinute = String(validTimeObj.getUTCMinutes()).padStart(2, '0');
  // Format valid time for the filename (YYYY-MM-DDTHHMM)
  const formattedValidTime = `${validYear}-${validMonth}-${validDay}T${validHour}${validMinute}`;

  if (!paddedBounds) {
    return `https://map-tiles.open-meteo.com/data_spatial/${domain.value}/${formattedReferenceTime}/${formattedValidTime}.om?variable=${variable}`;
  } else {
    return `https://map-tiles.open-meteo.com/data_spatial/${domain.value}/${formattedReferenceTime}/${formattedValidTime}.om?variable=${variable}&bounds=${paddedBounds.getSouth()},${paddedBounds.getWest()},${paddedBounds.getNorth()},${paddedBounds.getEast()}&partial=true`;
  }
}
