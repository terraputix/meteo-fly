import type { CellSelection, Location, WeatherModel } from '$lib/api/types';
import type { MaxAltitude } from '$lib/meteo/types';

export interface PageParameters {
  location: Location;
  selectedDay: number;
  selectedModel: WeatherModel;
  maxAltitude: MaxAltitude;
  cellSelection: CellSelection;
}
