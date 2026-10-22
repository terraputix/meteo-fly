import { fetchWeatherApi } from 'openmeteo';
import { fromDate, toCalendarDate, toZoned } from '@internationalized/date';
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
import { FORECAST_URL, resolveLocationTimezone } from '#lib/api/timezone.js';
import type { MaxAltitude } from '#lib/meteo/types.js';

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

function getDailyTime(
  daily: VariablesWithTime,
  position: number,
  name: string,
  date: string,
  timezone: string
): { time: Date | null; polarDaylight?: WindChartData['polarDaylight'] } {
  const values = daily.variables(position);
  let absentEvent = false;
  let polarDaylight: WindChartData['polarDaylight'];
  for (let i = 0; i < (values?.valuesInt64Length() ?? 0); i++) {
    const seconds = values?.valuesInt64(i);
    if (seconds == null) continue;
    const sunrise = daily.variables(0)?.valuesInt64(i);
    const sunset = daily.variables(1)?.valuesInt64(i);
    // Polar responses also use equal midnights or a full UTC day as placeholders.
    const polarDay = sunrise != null && sunset != null && sunset - sunrise === 86400n;
    if (seconds === 0n || sunrise === sunset || polarDay) {
      absentEvent = true;
      if (polarDay) polarDaylight = 'day';
      else if (seconds !== 0n && sunrise === sunset) polarDaylight = 'night';
      continue;
    }
    const time = new Date(Number(seconds) * 1000);
    if (Number.isFinite(+time) && formatDateToYYYYMMDD(time, timezone) === date) return { time };
  }
  if (absentEvent) return { time: null, polarDaylight };
  throw new Error(`Open-Meteo wind chart response is missing ${name} data for ${date}`);
}

// Helper function to form time ranges
const range = (start: number, stop: number, step: number) =>
  Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

function formatDateToYYYYMMDD(date: Date, timeZone: string): string {
  return toCalendarDate(fromDate(date, timeZone)).toString();
}

export function createQueryParams(
  location: Location,
  hourlyParams: HourlyParams,
  model: WeatherModel,
  cellSelection: CellSelection,
  referenceDate: Date,
  numberOfDays: number,
  timezone: string,
  dayOffset: number = 0
) {
  const date = toCalendarDate(fromDate(referenceDate, timezone)).add({ days: dayOffset });
  const start = toZoned(date, timezone).toDate();
  const end = new Date(+toZoned(date.add({ days: numberOfDays }), timezone).toDate() - 3600000);

  return {
    ...hourlyParams,
    daily: ['sunrise', 'sunset'],
    latitude: location.latitude,
    longitude: location.longitude,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    start_hour: start.toISOString().slice(0, 16),
    end_hour: end.toISOString().slice(0, 16),
    models: model,
    cell_selection: cellSelection,
    timezone: 'GMT',
  };
}

async function fetchResponse(
  params: Parameters<typeof fetchWeatherApi>[1],
  requestName: string,
  signal?: AbortSignal
): Promise<WeatherApiResponse> {
  return getFirstResponse(
    await fetchWeatherApi(FORECAST_URL, params, undefined, undefined, undefined, signal ? { signal } : undefined),
    requestName
  );
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
    timezone: 'auto',
    elevation: 'nan',
  };

  const responses = await fetchWeatherApi(
    FORECAST_URL,
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
  referenceDate: Date,
  numberOfDays: number = 1,
  maxAltitude: MaxAltitude = 4000,
  cellSelection: CellSelection = 'nearest',
  signal?: AbortSignal,
  dayOffset: number = 0
): Promise<WindChartData> {
  const modelVariables = getVariablesForModel(model, maxAltitude);
  const hourlyParams = createHourlyParams(modelVariables);
  const timezone = await resolveLocationTimezone(location, signal);
  const params = createQueryParams(
    location,
    hourlyParams,
    model,
    cellSelection,
    referenceDate,
    numberOfDays,
    timezone,
    dayOffset
  );
  const response = await fetchResponse(params, 'wind chart', signal);
  const date = formatDateToYYYYMMDD(new Date(`${params.start_hour}Z`), timezone);
  const selectedGridCell: Location = {
    latitude: response.latitude(),
    longitude: response.longitude(),
  };

  const daily = response.daily();
  if (!daily) {
    throw new Error('Open-Meteo wind chart response is missing daily data');
  }
  const sunrise = getDailyTime(daily, 0, 'sunrise', date, timezone);
  const sunset = getDailyTime(daily, 1, 'sunset', date, timezone);

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
    timezone,
    sunrise: sunrise.time,
    sunset: sunset.time,
    polarDaylight: !sunrise.time && !sunset.time ? (sunrise.polarDaylight ?? sunset.polarDaylight) : undefined,
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
  referenceDate: Date,
  maxAltitude: MaxAltitude = 4000,
  cellSelection: CellSelection = 'nearest',
  signal?: AbortSignal,
  dayOffset: number = 0
): Promise<SkewTWeatherData> {
  const variables = getSkewTVariablesForModel(model, maxAltitude);
  const timezone = await resolveLocationTimezone(location, signal);
  const hourlyParams = [...variables.flatMap((v) => v.apiNames), 'temperature_2m', 'dew_point_2m'];
  const params = createQueryParams(
    location,
    { hourly: hourlyParams },
    model,
    cellSelection,
    referenceDate,
    1,
    timezone,
    dayOffset
  );
  const response = await fetchResponse({ ...params, daily: undefined }, 'Skew-T', signal);
  const elevation = response.elevation();
  const hourly = getHourlySection(response, 'Skew-T');
  const times = createHourlyTimes(hourly, 'Skew-T');

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
    timezone,
  };
}
