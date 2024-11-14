export interface Location {
    latitude: number;
    longitude: number;
}

export type WeatherModel =
    'icon_d2' |
    'icon_seamless' |
    'icon_eu' |
    'icon_global' |
    'meteofrance_seamless' |
    'gfs_seamless' |
    'ukmo_seamless' |
    'cma_grapes_global' |
    'gem_seamless';

export interface VerticalProfile {
    _1000hPa: Float32Array;
    _975hPa: Float32Array;
    _950hPa: Float32Array;
    _925hPa: Float32Array;
    _900hPa: Float32Array;
    _850hPa: Float32Array;
    _800hPa: Float32Array;
    _700hPa: Float32Array;
    _600hPa: Float32Array;
}

export interface WeatherDataType {
    hourly: HourlyData;
    elevation: number;
}

export interface HourlyData {
    time: Date[];
    cloudCoverProfile: VerticalProfile;
    windSpeedProfile: VerticalProfile;
    windDirectionProfile: VerticalProfile;
    precipitation: Float32Array;
    temperature_2m: Float32Array;
    dewpoint_2m: Float32Array;
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
type VerticalProfileKeys = keyof VerticalProfile;
export type VerticalProfileKey = Extract<VerticalProfileKeys, `_${number}hPa`>;

export type ProfileVariables = { key: string, type: string, apiNames: string[] };
export const isProfile = (variable: ProfileVariables | FlatVariable): variable is ProfileVariables => {
    return variable.type === 'Profile';
}
export type FlatVariable = { apiName: string, type: string, key: string };
export const isFlat = (variable: ProfileVariables | FlatVariable): variable is FlatVariable => {
    return variable.type === 'Flat';
}
