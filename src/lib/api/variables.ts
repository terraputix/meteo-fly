import type { FlatVariable, ProfileVariables, WeatherModel } from './types';
import { getModelPressureLevelsForAltitude } from '$lib/charts/pressureLevels';

function makeProfileVar(key: string, prefix: string, maxAltitude: number): ProfileVariables {
  const levels = getModelPressureLevelsForAltitude(maxAltitude);
  return {
    key,
    type: 'Profile',
    apiNames: levels.map((l) => `${prefix}_${l.hPa}hPa`),
  };
}

export function getVariablesForModel(
  model: WeatherModel,
  maxAltitude: number = 4500
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
    makeProfileVar('cloudCoverProfile', 'cloud_cover', maxAltitude),
    makeProfileVar('windSpeedProfile', 'wind_speed', maxAltitude),
    makeProfileVar('windDirectionProfile', 'wind_direction', maxAltitude),
  ];

  const modelSpecificVars: (ProfileVariables | FlatVariable)[] = (() => {
    if (model === 'gfs_seamless') {
      return [makeProfileVar('verticalVelocityProfile', 'vertical_velocity', maxAltitude)];
    }
    return [];
  })();

  return [...flatVars, ...profileVars, ...modelSpecificVars];
}
