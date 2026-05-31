import { fetchWeatherApi } from 'openmeteo';
import type { VariablesWithTime } from '@openmeteo/sdk/variables-with-time';
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
  type WeatherDataType,
} from './types';
import { getVariablesForModel } from './variables';
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
  variable: ProfileVariables | FlatVariable
): Float32Array | VerticalProfile {
  if (isFlat(variable)) {
    const position = hourlyParams.findIndex((v) => v === variable.apiName);
    return hourlyResponse.variables(position)!.valuesArray()!;
  } else if (isProfile(variable)) {
    // Dynamically map each apiName to its hPa key – no hardcoded indices.
    const result: Partial<VerticalProfile> = {};
    variable.apiNames.forEach((apiName) => {
      const position = hourlyParams.findIndex((v) => v === apiName);
      const values = hourlyResponse.variables(position)!.valuesArray()!;
      // Extract the hPa suffix: e.g. "wind_speed_1000hPa" → key "_1000hPa"
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
  cellSelection: CellSelection
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

  const responses = await fetchWeatherApi(url, params);
  const response = responses[0];
  return response.elevation();
}

export async function fetchWeatherData(
  location: Location,
  model: WeatherModel = 'icon_d2',
  start: Date,
  numberOfDays: number = 1,
  maxAltitude: MaxAltitude = 4000,
  cellSelection: CellSelection = 'nearest'
): Promise<WeatherDataType> {
  const modelVariables = getVariablesForModel(model, maxAltitude);
  const hourlyParams = createHourlyParams(modelVariables);
  const params = createQueryParams(location, hourlyParams, model, cellSelection, start, numberOfDays);

  const responses = await fetchWeatherApi(url, params);
  const response = responses[0];

  const timezone = response.timezoneAbbreviation() ?? 'UTC';
  const selectedGridCell: Location = {
    latitude: response.latitude(),
    longitude: response.longitude(),
  };

  const sunriseInt: number = Number(response.daily()!.variables(0)?.valuesInt64(0));
  const sunsetInt: number = Number(response.daily()!.variables(1)?.valuesInt64(0));
  const sunrise = new Date(sunriseInt * 1000);
  const sunset = new Date(sunsetInt * 1000);

  const elevation = response.elevation();

  const hourly = response.hourly()!;
  const weatherData: WeatherDataType = {
    elevation: elevation,
    hourly: {
      time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map((t) => new Date(t * 1000)),
      ...modelVariables.reduce((acc, v) => {
        const key = v.key as keyof HourlyData;
        const value = getVariableFromHourly(hourlyParams.hourly, hourly, v)!;
        acc[key] = value as Date[] & VerticalProfile & Float32Array;
        return acc;
      }, {} as Partial<HourlyData>),
    } as HourlyData,
    timezoneAbbr: timezone,
    sunrise: sunrise,
    sunset: sunset,
    selectedGridCell,
  };

  return weatherData;
}
