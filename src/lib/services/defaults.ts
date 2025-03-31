import type { Location, WeatherModel } from '$lib/api/api';
import type { PageParameters } from './types';
import { readURLParams } from './url';

export const defaultLocation: Location = { latitude: 46.41526, longitude: 8.10828 };
export const defaultWeatherModel: WeatherModel = 'icon_seamless';
export const defaultDay = 1;

/// Initial parameters will be first read from the URL, then from local storage.
/// If neither are present, defaults will be used.
export function getInitialParameters(urlParams: URLSearchParams): PageParameters {
  const parsedUrlParams = readURLParams(urlParams);
  if (parsedUrlParams) {
    return parsedUrlParams;
  }

  return {
    location: defaultLocation,
    selectedModel: defaultWeatherModel,
    selectedDay: defaultDay,
  };
}
