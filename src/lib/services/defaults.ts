import type { CellSelection, Location, WeatherModel } from '#lib/api/types.js';
import { DEFAULT_WIND_COMPARISON_LEVEL, type WindComparisonLevel } from '#lib/api/forecastFields.js';
import type { PageParameters } from './types';
import { readURLParams } from './url';

export const defaultLocation: Location = { latitude: 46.41526, longitude: 8.10828 };
export const defaultWeatherModel: WeatherModel = 'icon_seamless';
export const defaultCellSelection: CellSelection = 'nearest';
export const defaultDay = 1;

export function getInitialParameters(
  urlParams: Pick<URLSearchParams, 'get'>,
  savedComparisonLevel?: WindComparisonLevel
): PageParameters {
  const parsedUrlParams = readURLParams(urlParams);
  const comparisonLevel = parsedUrlParams?.comparisonLevel ?? savedComparisonLevel ?? DEFAULT_WIND_COMPARISON_LEVEL;
  if (parsedUrlParams) {
    return { ...parsedUrlParams, comparisonLevel };
  }

  return {
    location: defaultLocation,
    selectedModel: defaultWeatherModel,
    selectedDay: defaultDay,
    maxAltitude: 4000,
    cellSelection: defaultCellSelection,
    comparisonLevel,
    daylightOnly: true,
  };
}
