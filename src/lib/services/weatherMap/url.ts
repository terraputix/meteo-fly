import { domainOptions } from '@openmeteo/mapbox-layer';
import type { WeatherMapState } from './store';

export function getInitialWeatherMapState(searchParams: URLSearchParams): Partial<WeatherMapState> {
  const domain = searchParams.get('map_domain');
  const baseVariable = searchParams.get('map_variable');
  const level = searchParams.get('map_level');
  const datetime = searchParams.get('map_datetime');

  const state: Partial<WeatherMapState> = {};

  const domainOption = domainOptions.find((d) => d.value === domain);
  if (domainOption) {
    state.domain = domainOption;
  }

  if (baseVariable) {
    state.baseVariable = baseVariable;
    state.level = level;
    state.variable = level ? `${baseVariable}${level}` : baseVariable;
  }

  if (datetime) {
    state.datetime = datetime;
  }

  return state;
}
