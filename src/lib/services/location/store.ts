import { writable, derived } from 'svelte/store';
import type { Location } from '$lib/api/types';
import {
  getCurrentLocation,
  watchLocation,
  isGeolocationSupported,
  type GeolocationResult,
  GeolocationError,
} from './geolocation';

export interface LocationState {
  current: Location | null;
  isDetecting: boolean;
  isWatching: boolean;
  accuracy: number | null;
  lastUpdated: number | null;
  error: string | null;
  isSupported: boolean;
}

const initialState: LocationState = {
  current: null,
  isDetecting: false,
  isWatching: false,
  accuracy: null,
  lastUpdated: null,
  error: null,
  isSupported: isGeolocationSupported(),
};

export const locationStore = writable<LocationState>(initialState);

let watchCleanup: (() => void) | null = null;

export const locationActions = {
  async detectLocation(): Promise<void> {
    locationStore.update((state) => ({
      ...state,
      isDetecting: true,
      error: null,
    }));

    try {
      const result = await getCurrentLocation();
      locationStore.update((state) => ({
        ...state,
        current: result.location,
        accuracy: result.accuracy,
        lastUpdated: result.timestamp,
        isDetecting: false,
        error: null,
      }));
    } catch (error) {
      const errorMessage = error instanceof GeolocationError ? error.message : 'Failed to get location';
      locationStore.update((state) => ({
        ...state,
        isDetecting: false,
        error: errorMessage,
      }));
      throw error;
    }
  },

  startWatching(): void {
    if (watchCleanup) {
      watchCleanup();
    }

    locationStore.update((state) => ({
      ...state,
      isWatching: true,
      error: null,
    }));

    watchCleanup = watchLocation(
      (result: GeolocationResult) => {
        locationStore.update((state) => ({
          ...state,
          current: result.location,
          accuracy: result.accuracy,
          lastUpdated: result.timestamp,
          error: null,
        }));
      },
      (error: GeolocationError) => {
        locationStore.update((state) => ({
          ...state,
          isWatching: false,
          error: error.message,
        }));
      }
    );
  },

  stopWatching(): void {
    if (watchCleanup) {
      watchCleanup();
      watchCleanup = null;
    }

    locationStore.update((state) => ({
      ...state,
      isWatching: false,
    }));
  },

  clearError(): void {
    locationStore.update((state) => ({
      ...state,
      error: null,
    }));
  },

  setLocation(location: Location): void {
    locationStore.update((state) => ({
      ...state,
      current: location,
      accuracy: null,
      lastUpdated: Date.now(),
      error: null,
    }));
  },
};

export const isLocationAvailable = derived(locationStore, ($locationStore) => $locationStore.current !== null);

export const locationError = derived(locationStore, ($locationStore) => $locationStore.error);

export const isLocationLoading = derived(
  locationStore,
  ($locationStore) => $locationStore.isDetecting || $locationStore.isWatching
);
