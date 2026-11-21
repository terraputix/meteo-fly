import type { WeatherModel } from '#lib/api/types.js';

export interface ModelOption {
  id: WeatherModel;
  name: string;
  regional?: boolean;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'icon_seamless', name: 'ICON Seamless' },
  { id: 'icon_d2', name: 'ICON D2', regional: true },
  { id: 'icon_eu', name: 'ICON EU', regional: true },
  { id: 'icon_global', name: 'ICON Global' },
  { id: 'gfs_seamless', name: 'GFS Seamless' },
  { id: 'meteofrance_seamless', name: 'MeteoFrance' },
  { id: 'ecmwf_ifs025', name: 'ECMWF IFS 0.25°' },
  { id: 'ecmwf_aifs025_single', name: 'ECMWF AIFS 0.25°' },
  { id: 'ukmo_seamless', name: 'UKMO' },
  { id: 'gem_seamless', name: 'GEM' },
  { id: 'cma_grapes_global', name: 'CMA GRAPES' },
];

export const MODEL_FORECAST_DAYS: Record<WeatherModel, number> = {
  icon_d2: 2,
  icon_seamless: 8,
  icon_eu: 5,
  icon_global: 8,
  meteofrance_seamless: 5,
  gfs_seamless: 16,
  ukmo_seamless: 8,
  cma_grapes_global: 5,
  gem_seamless: 10,
  ecmwf_ifs025: 15,
  ecmwf_aifs025_single: 15,
};

const comparisonOnlyModels = [
  { id: 'meteoswiss_icon_ch1', name: 'ICON CH1', regional: true },
  { id: 'meteoswiss_icon_ch2', name: 'ICON CH2', regional: true },
  { id: 'gfs_global', name: 'GFS Global', regional: false },
  { id: 'ecmwf_ifs', name: 'ECMWF IFS', regional: false },
] as const;

export const COMPASS_MODELS = [
  ...MODEL_OPTIONS.filter(({ id }) => id !== 'icon_seamless' && id !== 'gfs_seamless'),
  ...comparisonOnlyModels,
].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));

export type CompassModel = (typeof COMPASS_MODELS)[number]['id'];
