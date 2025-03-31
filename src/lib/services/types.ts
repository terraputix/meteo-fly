import type { Location, WeatherModel } from '$lib/api/types';

export interface PageParameters {
  location: Location;
  selectedDay: number;
  selectedModel: WeatherModel;
  // lastUpdated: string;
}
