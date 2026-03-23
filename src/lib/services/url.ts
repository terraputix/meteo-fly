import type { PageParameters } from './types';
import { defaultDay, defaultLocation, defaultWeatherModel } from './defaults';
import type { WeatherModel, Location } from '$lib/api/types';
import type { MaxAltitude } from '$lib/meteo/types';

export function readURLParams(params: URLSearchParams): PageParameters | null {
  const lat = params.get('lat');
  const lon = params.get('lon');
  const day = params.get('day');
  const model = params.get('model');
  const maxAlt = params.get('maxAlt');

  if (!(lat && lon && day && model)) {
    return null;
  }

  let location: Location;
  if (lat && lon) {
    location = { latitude: Number(lat), longitude: Number(lon) };
  } else {
    location = defaultLocation;
  }

  const selectedDay = day ? Number(day) : defaultDay;
  const selectedModel = model ? (model as WeatherModel) : defaultWeatherModel;
  const maxAltitude: MaxAltitude = maxAlt ? (Number(maxAlt) as MaxAltitude) : 4000;

  return { location, selectedDay, selectedModel, maxAltitude };
}
