import type { FlatVariable, ProfileVariables, VariableConfig, WeatherModel } from './types';

// All pressure level definitions aligned with pressureLevels.ts
const pressureLevelDefs: { hPa: number; heightMeters: number }[] = [
  { hPa: 1000, heightMeters: 110 },
  { hPa: 975, heightMeters: 320 },
  { hPa: 950, heightMeters: 540 },
  { hPa: 925, heightMeters: 770 },
  { hPa: 900, heightMeters: 1000 },
  { hPa: 850, heightMeters: 1500 },
  { hPa: 800, heightMeters: 2000 },
  { hPa: 700, heightMeters: 3000 },
  { hPa: 600, heightMeters: 4200 },
  { hPa: 500, heightMeters: 5600 },
  { hPa: 400, heightMeters: 7200 },
];

function makeProfileVar(key: string, prefix: string, maxAltitude: number): ProfileVariables {
  const levels = pressureLevelDefs.filter((l) => l.heightMeters <= maxAltitude);
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
