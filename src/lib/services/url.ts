import type { PageParameters, ChartView } from './types';
import { defaultCellSelection, defaultDay, defaultLocation, defaultWeatherModel } from './defaults';
import type { CellSelection, WeatherModel, Location } from '$lib/api/types';
import type { MaxAltitude } from '$lib/meteo/types';

export function readURLParams(params: URLSearchParams): PageParameters | null {
  const lat = params.get('lat');
  const lon = params.get('lon');
  const day = params.get('day');
  const model = params.get('model');
  const maxAlt = params.get('maxAlt');
  const cellSelection = params.get('cellSelection');
  const chartView = params.get('chartView');
  const traceIndex = params.get('traceIndex');

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
  const selectedCellSelection: CellSelection =
    cellSelection === 'nearest' || cellSelection === 'land' ? cellSelection : defaultCellSelection;
  const selectedChartView: ChartView = chartView === 'skewt' ? 'skewt' : 'wind';
  const selectedTraceIndex = traceIndex ? Math.max(0, Math.min(Number(traceIndex), 23)) : 0;

  return {
    location,
    selectedDay,
    selectedModel,
    maxAltitude,
    cellSelection: selectedCellSelection,
    chartView: selectedChartView,
    selectedTraceIndex: selectedTraceIndex,
  };
}
