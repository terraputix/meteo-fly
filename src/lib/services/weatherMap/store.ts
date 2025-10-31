import { domainOptions, type Domain } from '@openmeteo/mapbox-layer';
import { writable } from 'svelte/store';

export interface WeatherMapState {
  bounds: maplibregl.LngLatBounds | null;
  paddedBounds: maplibregl.LngLatBounds | null;
  domain: Domain;
  variable: string;
  datetime: string;
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
};

function createWeatherMapStore() {
  const { subscribe, set, update } = writable<WeatherMapState>(initialState);

  return {
    subscribe,
    setBounds: (bounds: maplibregl.LngLatBounds) => update((state) => ({ ...state, bounds })),
    setPaddedBounds: (paddedBounds: maplibregl.LngLatBounds) => update((state) => ({ ...state, paddedBounds })),
    setDomain: (domain: Domain) => update((state) => ({ ...state, domain })),
    setVariable: (variable: string) => update((state) => ({ ...state, variable })),
    setDatetime: (datetime: string) => update((state) => ({ ...state, datetime })),
    reset: () => set(initialState),
  };
}

export const weatherMapStore = createWeatherMapStore();

// Helper function to build the Open-Meteo URL
export function buildOpenMeteoUrl(state: WeatherMapState): string {
  const { paddedBounds, domain, variable, datetime } = state;
  const dateObj = new Date(datetime);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hour = String(dateObj.getHours()).padStart(2, '0');
  const minute = String(dateObj.getMinutes()).padStart(2, '0');

  // Format datetime for the URL (YYYY-MM-DDTHHMM)
  const formattedDatetime = `${year}-${month}-${day}T${hour}${minute}`;

  console.log(paddedBounds);

  if (!paddedBounds) {
    return `https://map-tiles.open-meteo.com/data_spatial/${domain.value}/${year}/${month}/${day}/0000Z/${formattedDatetime}.om?variable=${variable}`;
  } else {
    return `https://map-tiles.open-meteo.com/data_spatial/${domain.value}/${year}/${month}/${day}/0000Z/${formattedDatetime}.om?variable=${variable}&bounds=${paddedBounds.getSouth()},${paddedBounds.getWest()},${paddedBounds.getNorth()},${paddedBounds.getEast()}&partial=true`;
  }
}
