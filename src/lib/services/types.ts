import type { CellSelection, Location, WeatherModel } from '#lib/api/types.js';
import type { MaxAltitude } from '#lib/meteo/types.js';

export type ChartView = 'wind' | 'skewt';

export interface PageParameters {
  location: Location;
  selectedDay: number;
  selectedModel: WeatherModel;
  maxAltitude: MaxAltitude;
  cellSelection: CellSelection;
  chartView?: ChartView;
  hour?: number;
  daylightOnly?: boolean;
}
