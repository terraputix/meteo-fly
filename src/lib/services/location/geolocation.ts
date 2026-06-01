import type { Location } from '$lib/api/types';

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface GeolocationResult {
  location: Location;
  accuracy: number;
  timestamp: number;
}

export class GeolocationError extends Error {
  constructor(
    message: string,
    public code: number,
    public originalError?: GeolocationPositionError
  ) {
    super(message);
    this.name = 'GeolocationError';
  }
}

const DEFAULT_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 300000, // 5 minutes
};

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export async function getCurrentLocation(options: GeolocationOptions = {}): Promise<GeolocationResult> {
  if (!isGeolocationSupported()) {
    throw new GeolocationError('Geolocation is not supported by this browser', 0);
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const result: GeolocationResult = {
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        resolve(result);
      },
      (error) => {
        const errorMessages: Record<number, string> = {
          1: 'Location access denied by user',
          2: 'Location information unavailable',
          3: 'Location request timed out',
        };

        reject(new GeolocationError(errorMessages[error.code] || 'Unknown geolocation error', error.code, error));
      },
      opts
    );
  });
}

export function watchLocation(
  callback: (result: GeolocationResult) => void,
  errorCallback: (error: GeolocationError) => void,
  options: GeolocationOptions = {}
): () => void {
  if (!isGeolocationSupported()) {
    errorCallback(new GeolocationError('Geolocation is not supported by this browser', 0));
    return () => {};
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const result: GeolocationResult = {
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      callback(result);
    },
    (error) => {
      const errorMessages: Record<number, string> = {
        1: 'Location access denied by user',
        2: 'Location information unavailable',
        3: 'Location request timed out',
      };

      errorCallback(new GeolocationError(errorMessages[error.code] || 'Unknown geolocation error', error.code, error));
    },
    opts
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}
