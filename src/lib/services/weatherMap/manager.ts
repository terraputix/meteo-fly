import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { domainOptions, type Domain } from '@openmeteo/mapbox-layer';
import type maplibregl from 'maplibre-gl';
import { fetchDomainInfo } from './url';
import type { DomainInfo } from './om_url';

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
}

// Helper to get initial state
function getInitialState(): WeatherMapState {
  const initialDomain = domainOptions.find((option) => option.value === 'dwd_icon')!;
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const initialDatetime = now.toISOString().slice(0, 16);

  return {
    domain: initialDomain,
    variable: 'temperature_2m',
    baseVariable: 'temperature',
    level: '_2m',
    datetime: initialDatetime,
    domainInfo: null,
    paddedBounds: null,
    availableLevels: [],
  };
}

class WeatherMapManager {
  private readonly store: Writable<WeatherMapState>;
  public readonly subscribe;

  constructor() {
    this.store = writable(getInitialState());
    this.subscribe = this.store.subscribe;
    this.initialize();
  }

  async initialize() {
    const initialDomain = get(this.store).domain;
    await this.setDomain(initialDomain);
  }

  // --- Private helpers for state transition logic ---

  private _constructVariableName(baseVariable: string, level: string | null): string {
    if (level) {
      return `${baseVariable}${level}`;
    }
    return baseVariable;
  }

  private _findDefaultLevel(baseVariable: string, availableVariables: string[]): string | null {
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

  private _getAvailableLevels(baseVariable: string, domainInfo: DomainInfo | null): { label: string; value: string }[] {
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

      const currentVariable = this._constructVariableName(currentBaseVariable, newLevel);
      if (domInfo && !domInfo.variables.includes(currentVariable)) {
        newLevel = this._findDefaultLevel(currentBaseVariable, domInfo.variables);
      }
      const newVariable = this._constructVariableName(currentBaseVariable, newLevel);

      return {
        ...state,
        domain: newDomain,
        domainInfo: domInfo,
        level: newLevel,
        variable: newVariable,
        availableLevels: this._getAvailableLevels(currentBaseVariable, domInfo),
      };
    });
  }

  setBaseVariable(newBaseVariable: string) {
    this.store.update((state) => {
      const { domainInfo } = state;
      let newLevel = state.level;

      const currentVariable = this._constructVariableName(newBaseVariable, newLevel);
      if (domainInfo && !domainInfo.variables.includes(currentVariable)) {
        newLevel = this._findDefaultLevel(newBaseVariable, domainInfo.variables);
      }
      const newVariable = this._constructVariableName(newBaseVariable, newLevel);

      return {
        ...state,
        baseVariable: newBaseVariable,
        level: newLevel,
        variable: newVariable,
        availableLevels: this._getAvailableLevels(newBaseVariable, domainInfo),
      };
    });
  }

  setLevel(newLevel: string | null) {
    this.store.update((state) => {
      const newVariable = this._constructVariableName(state.baseVariable, newLevel);
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
}

export const weatherMapManager = new WeatherMapManager();
