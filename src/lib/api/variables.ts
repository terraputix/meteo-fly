import type { FlatVariable, ProfileVariables, WeatherModel } from './types';
import { getNativeLevelsForFetch } from '$lib/meteo/pressureLevels';
import type { MaxAltitude } from '$lib/meteo/types';

export function makeProfileVar(
  key: string,
  prefix: string,
  model: WeatherModel,
  maxAltitude: number
): ProfileVariables {
  const levels = getNativeLevelsForFetch(model, maxAltitude);
  return {
    key,
    type: 'Profile',
    apiNames: levels.map((l) => `${prefix}_${l.hPa}hPa`),
  };
}

export function getVariablesForModel(
  model: WeatherModel,
  maxAltitude: MaxAltitude = 4000
): (ProfileVariables | FlatVariable)[] {
  const flatVars: FlatVariable[] = [
    { apiName: 'precipitation', type: 'Flat', key: 'precipitation' },
    { apiName: 'temperature_2m', type: 'Flat', key: 'temperature_2m' },
    { apiName: 'dew_point_2m', type: 'Flat', key: 'dewpoint_2m' },
    { apiName: 'relative_humidity_2m', type: 'Flat', key: 'relativeHumidity_2m' },
    { apiName: 'cloud_cover_low', type: 'Flat', key: 'cloudCoverLow' },
    { apiName: 'cloud_cover_mid', type: 'Flat', key: 'cloudCoverMid' },
    { apiName: 'cloud_cover_high', type: 'Flat', key: 'cloudCoverHigh' },
  ];

  const profileVars: ProfileVariables[] = [
    makeProfileVar('cloudCoverProfile', 'cloud_cover', model, maxAltitude),
    makeProfileVar('windSpeedProfile', 'wind_speed', model, maxAltitude),
    makeProfileVar('windDirectionProfile', 'wind_direction', model, maxAltitude),
  ];

  const modelSpecificVars: (ProfileVariables | FlatVariable)[] = (() => {
    return [];
  })();

  return [...flatVars, ...profileVars, ...modelSpecificVars];
}
