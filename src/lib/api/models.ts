import type { WeatherModel } from './types';

export interface ModelOption {
  id: WeatherModel;
  name: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'icon_seamless', name: 'ICON Seamless' },
  { id: 'icon_d2', name: 'ICON D2' },
  { id: 'icon_eu', name: 'ICON EU' },
  { id: 'icon_global', name: 'ICON Global' },
  { id: 'gfs_seamless', name: 'GFS Seamless' },
  { id: 'meteofrance_seamless', name: 'MeteoFrance' },
  { id: 'ecmwf_ifs025', name: 'ECMWF IFS 0.25°' },
  { id: 'ecmwf_aifs025_single', name: 'ECMWF AIFS 0.25°' },
  { id: 'ukmo_seamless', name: 'UKMO' },
  { id: 'gem_seamless', name: 'GEM' },
  { id: 'cma_grapes_global', name: 'CMA GRAPES' },
];
