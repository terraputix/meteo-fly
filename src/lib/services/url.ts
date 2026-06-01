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
  const terrainParam = params.get('terrain');
  const modelTerrainParam = params.get('modelTerrain');
  const view = params.get('view');
  const hourStr = params.get('hour');

  if (!(lat && lon && day && model)) {
    return null;
  }

  const location: Location = { latitude: Number(lat), longitude: Number(lon) };
  const selectedDay = Number(day) || defaultDay;
  const selectedModel = model ? (model as WeatherModel) : defaultWeatherModel;
  const maxAltitude: MaxAltitude = maxAlt ? (Number(maxAlt) as MaxAltitude) : 4000;
  const selectedCellSelection: CellSelection =
    cellSelection === 'nearest' || cellSelection === 'land' ? cellSelection : defaultCellSelection;
  const terrain = terrainParam !== null ? terrainParam === '1' : true;
  const modelTerrain = modelTerrainParam === '1';
  const chartView: ChartView | undefined = view === 'wind' || view === 'skewt' ? view : undefined;
  const hour = hourStr ? Number(hourStr) : undefined;

  return {
    location,
    selectedDay,
    selectedModel,
    maxAltitude,
    cellSelection: selectedCellSelection,
    terrain,
    modelTerrain,
    chartView,
    hour,
  };
}
