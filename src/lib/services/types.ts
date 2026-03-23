import type { Location, WeatherModel } from '$lib/api/types';
import type { MaxAltitude } from '$lib/meteo/types';

export interface PageParameters {
  location: Location;
  selectedDay: number;
  selectedModel: WeatherModel;
  maxAltitude?: MaxAltitude;
  // lastUpdated: string;
}
