export interface Location {
  latitude: number;
  longitude: number;
}

export type WeatherModel =
  | 'icon_d2'
  | 'icon_seamless'
  | 'icon_eu'
  | 'icon_global'
  | 'meteofrance_seamless'
  | 'gfs_seamless'
  | 'ukmo_seamless'
  | 'cma_grapes_global'
  | 'gem_seamless'
  | 'ecmwf_ifs025'
  | 'ecmwf_aifs025_single';

export type CellSelection = 'land' | 'nearest';

export type VerticalProfileKey = `_${number}hPa`;
export type VerticalProfile = Partial<Record<VerticalProfileKey, Float32Array>>;

export function getAtLevel(data: VerticalProfile, pressure: number): Float32Array | undefined {
  return data[`_${pressure}hPa` as VerticalProfileKey];
}

export interface WeatherDataType {
  hourly: HourlyData;
  elevation: number;
  modelGridElevation?: number;
  timezoneAbbr: string;
  sunrise: Date;
  sunset: Date;
  selectedGridCell: Location | null;
}

export interface HourlyData {
  time: Date[];
  cloudCoverProfile: VerticalProfile;
  windSpeedProfile: VerticalProfile;
  windDirectionProfile: VerticalProfile;
  verticalVelocityProfile: VerticalProfile | undefined;
  precipitation: Float32Array;
  temperature_2m: Float32Array;
  dewpoint_2m: Float32Array;
  relativeHumidity_2m: Float32Array;
  cloudCoverLow: Float32Array;
  cloudCoverMid: Float32Array;
  cloudCoverHigh: Float32Array;
  // windSpeed10m: Float32Array;
  // windSpeed80m: Float32Array;
  // windSpeed120m: Float32Array;
  // windSpeed180m: Float32Array;
  // windDirection10m: Float32Array;
  // windDirection80m: Float32Array;
  // windDirection120m: Float32Array;
  // windDirection180m: Float32Array;
}

export type HourlyKeys = keyof HourlyData;

export type ProfileVariables = { key: string; type: string; apiNames: string[] };
export const isProfile = (variable: ProfileVariables | FlatVariable): variable is ProfileVariables => {
  return variable.type === 'Profile';
};
export type FlatVariable = { apiName: string; type: string; key: string };
export const isFlat = (variable: ProfileVariables | FlatVariable): variable is FlatVariable => {
  return variable.type === 'Flat';
};
