import { writable } from 'svelte/store';
import type { Location } from '#lib/api/types.js';
import { getCurrentLocation, GeolocationError } from '#lib/services/location/geolocation.js';

export interface LocationState {
  current: Location | null;
  isDetecting: boolean;
  accuracy: number | null;
  error: string | null;
}

const initialState: LocationState = {
  current: null,
  isDetecting: false,
  accuracy: null,
  error: null,
};

export const locationStore = writable<LocationState>(initialState);

export const locationActions = {
  async detectLocation(): Promise<Location> {
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
        isDetecting: false,
        error: null,
      }));
      return result.location;
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
};
