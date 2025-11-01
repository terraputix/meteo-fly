import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { domainOptions, type Domain } from '@openmeteo/mapbox-layer';
import maplibregl from 'maplibre-gl';
import { fetchDomainInfo } from './url';
import type { DomainInfo } from './om_url';
import type { Location, WeatherModel } from '$lib/api/types';

// --- Constants ---
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

export const defaultLocation: Location = { latitude: 46.41526, longitude: 8.10828 };
export const defaultWeatherModel: WeatherModel = 'icon_seamless';
export const defaultDay = 1;

// --- URL Parsing ---
function readURLParams(urlParams: URLSearchParams): Partial<WeatherMapState> | null {
  const lat = urlParams.get('lat');
  const lon = urlParams.get('lon');
  const day = urlParams.get('day');
  const model = urlParams.get('model');

  const mapDomainValue = urlParams.get('map_domain');
  const mapVariable = urlParams.get('map_variable');
  const mapLevel = urlParams.get('map_level');
  const mapDatetime = urlParams.get('map_datetime');

  const result: Partial<WeatherMapState> = {};

  if (lat && lon) {
    result.location = { latitude: parseFloat(lat), longitude: parseFloat(lon) };
  }
  if (day) {
    result.selectedDay = parseInt(day, 10);
  }
  if (model) {
    result.selectedModel = model as WeatherModel;
  }

  if (mapDomainValue) {
    const domainOption = domainOptions.find((d) => d.value === mapDomainValue);
    if (domainOption) {
      result.domain = domainOption;
    }
  }
  if (mapVariable) {
    result.variable = mapVariable;
    // Assuming base variable is before first underscore, or is the variable itself
    result.baseVariable = mapVariable.includes('_') ? mapVariable.split('_')[0] : mapVariable;
  }
  if (mapLevel) {
    result.level = mapLevel;
  }
  if (mapDatetime) {
    result.datetime = mapDatetime;
  }

  if (Object.keys(result).length > 0) {
    return result;
  }
  return null;
}

// --- State Interface ---
export interface WeatherMapState {
  domain: Domain;
  variable: string;
  baseVariable: string;
  level: string | null;
  datetime: string;
  domainInfo: DomainInfo | null;
  paddedBounds: maplibregl.LngLatBounds | null;
  availableLevels: { label: string; value: string }[];
  location: Location;
  selectedDay: number;
  selectedModel: WeatherModel;
}

// Helper to get initial state
function getInitialState(urlParams: URLSearchParams): WeatherMapState {
  const defaultMapState: WeatherMapState = {
    domain: domainOptions.find((option) => option.value === 'dwd_icon')!,
    variable: 'temperature_2m',
    baseVariable: 'temperature',
    level: '_2m',
    datetime: new Date(new Date().setMinutes(0, 0, 0)).toISOString().slice(0, 16),
    domainInfo: null,
    paddedBounds: null,
    availableLevels: [],
    location: defaultLocation,
    selectedDay: defaultDay,
    selectedModel: defaultWeatherModel,
  };

  const parsedURLState = readURLParams(urlParams);

  const initialState = {
    ...defaultMapState,
    ...parsedURLState,
  };

  console.log(initialState);
  return initialState;
}

export class WeatherMapManager {
  private readonly store: Writable<WeatherMapState>;
  public readonly subscribe;

  constructor(urlParams: URLSearchParams) {
    console.log('Constructing WeatherMapManager...');
    // Don't initialize state here - just create an empty store
    this.store = writable(getInitialState(urlParams));
    this.subscribe = this.store.subscribe;
    this.initializeDomainInfo();
  }

  private async initializeDomainInfo() {
    const currentDomain = get(this.store).domain;
    await this.setDomain(currentDomain);
  }

  // --- Private helpers for state transition logic ---

  private constructVariableName(baseVariable: string, level: string | null): string {
    if (level) {
      return `${baseVariable}${level}`;
    }
    return baseVariable;
  }

  private findDefaultLevel(baseVariable: string, availableVariables: string[]): string | null {
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

  private getAvailableLevels(baseVariable: string, domainInfo: DomainInfo | null): { label: string; value: string }[] {
    if (!domainInfo) return [];

    let levels: { label: string; value: string }[] = [];

    if (baseVariable === 'cloud_cover') {
      levels = cloudLevels;
    } else if (baseVariable === 'convective_cloud') {
      levels = convectiveCloudLevels;
    } else {
      levels = [...surfaceLevels, ...pressureLevels];
    }

    return levels.filter((level) => domainInfo.variables.includes(`${baseVariable}${level.value}`));
  }

  // --- Public methods to update state ---

  async setDomain(newDomain: Domain) {
    const domInfo = await fetchDomainInfo(newDomain);

    this.store.update((state) => {
      const currentBaseVariable = state.baseVariable;
      let newLevel = state.level;

      const currentVariable = this.constructVariableName(currentBaseVariable, newLevel);
      if (domInfo && !domInfo.variables.includes(currentVariable)) {
        newLevel = this.findDefaultLevel(currentBaseVariable, domInfo.variables);
      }
      const newVariable = this.constructVariableName(currentBaseVariable, newLevel);

      return {
        ...state,
        domain: newDomain,
        domainInfo: domInfo,
        level: newLevel,
        variable: newVariable,
        availableLevels: this.getAvailableLevels(currentBaseVariable, domInfo),
      };
    });
  }

  setBaseVariable(newBaseVariable: string) {
    this.store.update((state) => {
      const { domainInfo } = state;
      let newLevel = state.level;

      const currentVariable = this.constructVariableName(newBaseVariable, newLevel);
      if (domainInfo && !domainInfo.variables.includes(currentVariable)) {
        newLevel = this.findDefaultLevel(newBaseVariable, domainInfo.variables);
      }
      const newVariable = this.constructVariableName(newBaseVariable, newLevel);

      return {
        ...state,
        baseVariable: newBaseVariable,
        level: newLevel,
        variable: newVariable,
        availableLevels: this.getAvailableLevels(newBaseVariable, domainInfo),
      };
    });
  }

  setLevel(newLevel: string | null) {
    this.store.update((state) => {
      const newVariable = this.constructVariableName(state.baseVariable, newLevel);
      return {
        ...state,
        level: newLevel,
        variable: newVariable,
      };
    });
  }

  setDatetime(newDatetime: string) {
    this.store.update((state) => ({ ...state, datetime: newDatetime }));
  }

  setPaddedBounds(newPaddedBounds: maplibregl.LngLatBounds) {
    this.store.update((state) => ({ ...state, paddedBounds: newPaddedBounds }));
  }

  setLocation(location: Location) {
    this.store.update((state) => ({ ...state, location }));
  }

  setSelectedDay(day: number) {
    this.store.update((state) => ({ ...state, selectedDay: day }));
  }

  setSelectedModel(model: WeatherModel) {
    this.store.update((state) => ({ ...state, selectedModel: model }));
  }

  jumpToNextDay() {
    this.store.update((state) => {
      if (!state.domainInfo) return state;

      const currentDatetime = new Date(state.datetime);
      const nextDay = new Date(currentDatetime);
      nextDay.setDate(currentDatetime.getDate() + 1);

      let closestValidTime = state.datetime;
      let minDiff = Infinity;

      for (const validTimeStr of state.domainInfo.valid_times) {
        const validTime = new Date(validTimeStr);
        if (
          validTime.getDate() === nextDay.getDate() &&
          validTime.getMonth() === nextDay.getMonth() &&
          validTime.getFullYear() === nextDay.getFullYear()
        ) {
          const diff = Math.abs(validTime.getTime() - nextDay.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestValidTime = validTimeStr;
          }
        }
      }
      return { ...state, datetime: closestValidTime };
    });
  }

  jumpToPreviousDay() {
    this.store.update((state) => {
      if (!state.domainInfo) return state;

      const currentDatetime = new Date(state.datetime);
      const previousDay = new Date(currentDatetime);
      previousDay.setDate(currentDatetime.getDate() - 1);

      let closestValidTime = state.datetime;
      let minDiff = Infinity;

      for (const validTimeStr of state.domainInfo.valid_times) {
        const validTime = new Date(validTimeStr);
        if (
          validTime.getDate() === previousDay.getDate() &&
          validTime.getMonth() === previousDay.getMonth() &&
          validTime.getFullYear() === previousDay.getFullYear()
        ) {
          const diff = Math.abs(validTime.getTime() - previousDay.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestValidTime = validTimeStr;
          }
        }
      }
      return { ...state, datetime: closestValidTime };
    });
  }
}
