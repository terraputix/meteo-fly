import { fetchWeatherApi } from 'openmeteo';
import type { VariablesWithTime } from '@openmeteo/sdk/variables-with-time';
import type { WeatherApiResponse } from '@openmeteo/sdk/weather-api-response';
import {
  type VerticalProfile,
  type WeatherModel,
  type CellSelection,
  type Location,
  isFlat,
  isProfile,
  type ProfileVariables,
  type FlatVariable,
  type HourlyData,
  type WindChartData,
  type SkewTWeatherData,
} from './types';
import { getVariablesForModel, makeProfileVar } from './variables';
import type { MaxAltitude } from '$lib/meteo/types';

export interface HourlyParams {
  hourly: string[];
}

export function createHourlyParams(variables: (ProfileVariables | FlatVariable)[]): HourlyParams {
  return {
    hourly: variables.flatMap((v) => {
      if (isFlat(v)) {
        return v.apiName;
      } else if (isProfile(v)) {
        return v.apiNames;
      } else {
        throw new Error('Unknown variable type');
      }
    }),
  };
}

function getVariableFromHourly(
  hourlyParams: string[],
  hourlyResponse: VariablesWithTime,
  variable: ProfileVariables | FlatVariable,
  expectedLength: number
): Float32Array | VerticalProfile {
  if (isFlat(variable)) {
    const values = getHourlyValues(hourlyParams, hourlyResponse, variable.apiName, expectedLength);
    return values ?? createMissingValues(expectedLength);
  } else if (isProfile(variable)) {
    const result: Partial<VerticalProfile> = {};
    variable.apiNames.forEach((apiName) => {
      const values = getHourlyValues(hourlyParams, hourlyResponse, apiName, expectedLength);
      if (!values) return;
      const match = apiName.match(/_(\d+hPa)$/);
      if (match) {
        const key = `_${match[1]}` as keyof VerticalProfile;
        (result as Record<string, Float32Array>)[key] = values;
      }
    });
    return result as VerticalProfile;
  } else {
    throw new Error('Unknown variable type');
  }
}

function createMissingValues(length: number): Float32Array {
  const result = new Float32Array(length);
  result.fill(NaN);
  return result;
}

function normalizeValues(values: Float32Array, expectedLength: number): Float32Array {
  if (values.length === expectedLength) return values;
  const result = createMissingValues(expectedLength);
  result.set(values.subarray(0, expectedLength));
  return result;
}

function getHourlyValues(
  hourlyParams: string[],
  hourlyResponse: VariablesWithTime,
  apiName: string,
  expectedLength: number
): Float32Array | null {
  const position = hourlyParams.findIndex((v) => v === apiName);
  if (position < 0) {
    throw new Error(`Requested hourly variable "${apiName}" is not configured`);
  }
  if (position >= hourlyResponse.variablesLength()) return null;
  const values = hourlyResponse.variables(position)?.valuesArray();
  return values ? normalizeValues(values, expectedLength) : null;
}

function getFirstResponse(responses: WeatherApiResponse[], requestName: string): WeatherApiResponse {
  const response = responses[0];
  if (!response) {
    throw new Error(`Open-Meteo returned no ${requestName} response`);
  }
  return response;
}

function getHourlySection(response: WeatherApiResponse, requestName: string): VariablesWithTime {
  const hourly = response.hourly();
  if (!hourly) {
    throw new Error(`Open-Meteo ${requestName} response is missing hourly data`);
  }
  return hourly;
}

function createHourlyTimes(hourly: VariablesWithTime, requestName: string): Date[] {
  const start = Number(hourly.time());
  const end = Number(hourly.timeEnd());
  const interval = hourly.interval();
  const length = (end - start) / interval;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(interval) ||
    interval <= 0 ||
    end <= start ||
    !Number.isInteger(length) ||
    length <= 0
  ) {
    throw new Error(`Open-Meteo ${requestName} response has an invalid hourly timeline`);
  }

  return range(start, end, interval).map((t) => new Date(t * 1000));
}

function getDailyTime(daily: VariablesWithTime, position: number, name: string): Date {
  const secondsValue = daily.variables(position)?.valuesInt64(0);
  if (secondsValue == null) {
    throw new Error(`Open-Meteo wind chart response is missing ${name} data`);
  }
  const seconds = Number(secondsValue);
  if (!Number.isFinite(seconds)) {
    throw new Error(`Open-Meteo wind chart response has invalid ${name} data`);
  }
  return new Date(seconds * 1000);
}

const url = 'https://api.open-meteo.com/v1/forecast';

// Helper function to form time ranges
const range = (start: number, stop: number, step: number) =>
  Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createQueryParams(
  location: Location,
  hourlyParams: HourlyParams,
  model: WeatherModel,
  cellSelection: CellSelection,
  start: Date,
  numberOfDays: number
) {
  const endDate = new Date(start.getTime() + (numberOfDays - 1) * 24 * 60 * 60 * 1000);

  return {
    ...hourlyParams,
    daily: ['sunrise', 'sunset'],
    latitude: location.latitude,
    longitude: location.longitude,
    start_date: formatDateToYYYYMMDD(start),
    end_date: formatDateToYYYYMMDD(endDate),
    models: model,
    cell_selection: cellSelection,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export async function fetchModelGridElevation(
  location: Location,
  model: WeatherModel,
  cellSelection: CellSelection,
  signal?: AbortSignal
): Promise<number> {
  const params = {
    latitude: location.latitude,
    longitude: location.longitude,
    models: model,
    cell_selection: cellSelection,
    forecast_days: 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    elevation: 'nan',
  };

  const responses = await fetchWeatherApi(
    url,
    params,
    undefined,
    undefined,
    undefined,
    signal ? { signal } : undefined
  );
  const response = responses[0];
  return response.elevation();
}

export async function fetchWindChartData(
  location: Location,
  model: WeatherModel = 'icon_seamless',
  start: Date,
  numberOfDays: number = 1,
  maxAltitude: MaxAltitude = 4000,
  cellSelection: CellSelection = 'nearest',
  signal?: AbortSignal
): Promise<WindChartData> {
  const modelVariables = getVariablesForModel(model, maxAltitude);
  const hourlyParams = createHourlyParams(modelVariables);
  const params = createQueryParams(location, hourlyParams, model, cellSelection, start, numberOfDays);

  const responses = await fetchWeatherApi(
    url,
    params,
    undefined,
    undefined,
    undefined,
    signal ? { signal } : undefined
  );
  const response = getFirstResponse(responses, 'wind chart');

  const timezone = response.timezoneAbbreviation() ?? 'UTC';
  const selectedGridCell: Location = {
    latitude: response.latitude(),
    longitude: response.longitude(),
  };

  const daily = response.daily();
  if (!daily) {
    throw new Error('Open-Meteo wind chart response is missing daily data');
  }
  const sunrise = getDailyTime(daily, 0, 'sunrise');
  const sunset = getDailyTime(daily, 1, 'sunset');

  const elevation = response.elevation();

  const hourly = getHourlySection(response, 'wind chart');
  const times = createHourlyTimes(hourly, 'wind chart');
  const windChartData: WindChartData = {
    elevation: elevation,
    hourly: {
      time: times,
      ...modelVariables.reduce((acc, v) => {
        const key = v.key as keyof HourlyData;
        const value = getVariableFromHourly(hourlyParams.hourly, hourly, v, times.length);
        acc[key] = value as Date[] & VerticalProfile & Float32Array;
        return acc;
      }, {} as Partial<HourlyData>),
    } as HourlyData,
    timezoneAbbr: timezone,
    sunrise: sunrise,
    sunset: sunset,
    selectedGridCell,
  };

  return windChartData;
}

// ─── Skew-T data fetching ────────────────────────────────────────────────────

function getSkewTVariablesForModel(model: WeatherModel, maxAltitude: MaxAltitude): ProfileVariables[] {
  return [
    makeProfileVar('temperatureProfile', 'temperature', model, maxAltitude),
    makeProfileVar('dewpointProfile', 'dew_point', model, maxAltitude),
    makeProfileVar('windSpeedProfile', 'wind_speed', model, maxAltitude),
    makeProfileVar('windDirectionProfile', 'wind_direction', model, maxAltitude),
    makeProfileVar('cloudCoverProfile', 'cloud_cover', model, maxAltitude),
    makeProfileVar('geopotentialHeightProfile', 'geopotential_height', model, maxAltitude),
  ];
}

export async function fetchSkewTData(
  location: Location,
  model: WeatherModel = 'icon_seamless',
  start: Date,
  maxAltitude: MaxAltitude = 4000,
  cellSelection: CellSelection = 'nearest',
  signal?: AbortSignal
): Promise<SkewTWeatherData> {
  const variables = getSkewTVariablesForModel(model, maxAltitude);
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const params = {
    hourly: [...variables.flatMap((v) => v.apiNames), 'temperature_2m', 'dew_point_2m'],
    latitude: location.latitude,
    longitude: location.longitude,
    start_date: formatDateToYYYYMMDD(start),
    end_date: formatDateToYYYYMMDD(start),
    models: model,
    cell_selection: cellSelection,
    timezone: localTimezone,
  };

  const responses = await fetchWeatherApi(
    url,
    params,
    undefined,
    undefined,
    undefined,
    signal ? { signal } : undefined
  );
  const response = getFirstResponse(responses, 'Skew-T');

  const timezone = response.timezoneAbbreviation() ?? 'UTC';
  const elevation = response.elevation();

  const hourly = getHourlySection(response, 'Skew-T');
  const times = createHourlyTimes(hourly, 'Skew-T');

  const hourlyParams = params.hourly as string[];

  const result: SkewTWeatherData['hourly'] = {
    time: times,
    temperatureProfile: {},
    dewpointProfile: {},
    windSpeedProfile: {},
    windDirectionProfile: {},
    cloudCoverProfile: {},
    geopotentialHeightProfile: {},
    temperature_2m: createMissingValues(times.length),
    dewpoint_2m: createMissingValues(times.length),
  };

  variables.forEach((v) => {
    v.apiNames.forEach((apiName) => {
      const values = getHourlyValues(hourlyParams, hourly, apiName, times.length);
      if (!values) return;
      const match = apiName.match(/_(\d+hPa)$/);
      if (!match) return;
      const levelKey = `_${match[1]}`;
      (result as unknown as Record<string, Record<string, Float32Array>>)[v.key][levelKey] = values;
    });
  });

  const temperature2m = getHourlyValues(hourlyParams, hourly, 'temperature_2m', times.length);
  const dewpoint2m = getHourlyValues(hourlyParams, hourly, 'dew_point_2m', times.length);
  if (temperature2m) {
    result.temperature_2m = temperature2m;
  }
  if (dewpoint2m) {
    result.dewpoint_2m = dewpoint2m;
  }

  return {
    hourly: result,
    elevation,
    timezoneAbbr: timezone,
  };
}
