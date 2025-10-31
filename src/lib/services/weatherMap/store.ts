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
  datetime: getCurrentDatetime(),
  domainInfo: null,
};

export const weatherMapVariables = [
  { value: 'temperature_2m', label: 'Temperature (2m)' },
  { value: 'relative_humidity_2m', label: 'Relative Humidity (2m)' },
  { value: 'precipitation', label: 'Precipitation' },
  { value: 'cloud_cover', label: 'Cloud Cover' },
  { value: 'convective_cloud_base', label: 'Convective Cloud Base' },
  { value: 'convective_cloud_top', label: 'Convective Cloud Top' },
  { value: 'wind_u_component_10m', label: 'Wind Speed (10m)' },
];

function createWeatherMapStore() {
  const { subscribe, set, update } = writable<WeatherMapState>(initialState);

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
