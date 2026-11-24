import type { CellSelection, Location, WeatherModel } from '#lib/api/types.js';
import type { WindComparisonLevel } from '#lib/api/forecastFields.js';
import type { MaxAltitude } from '#lib/meteo/types.js';

export type ChartView = 'wind' | 'skewt' | 'comparison';

export interface PageParameters {
  location: Location;
  selectedDay: number;
  selectedModel: WeatherModel;
  maxAltitude: MaxAltitude;
  cellSelection: CellSelection;
  chartView?: ChartView;
  comparisonLevel: WindComparisonLevel;
  hour?: number;
  daylightOnly?: boolean;
}
