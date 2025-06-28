import { fetchWeatherApi } from 'openmeteo';
import type { VariablesWithTime } from '@openmeteo/sdk/variables-with-time';
import {
  type VerticalProfile,
  type WeatherModel,
  type Location,
  isFlat,
  isProfile,
  type ProfileVariables,
  type FlatVariable,
  type HourlyData,
  type WeatherDataType,
} from './types';
import { getVariablesForModel } from './variables';

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
    const values = variable.apiNames.map((apiName) => {
      const position = hourlyParams.findIndex((v) => v === apiName);
      return hourlyResponse.variables(position)!.valuesArray()!;
    });
    return {
      _1000hPa: values[0],
      _975hPa: values[1],
      _950hPa: values[2],
      _925hPa: values[3],
      _900hPa: values[4],
      _850hPa: values[5],
      _800hPa: values[6],
      _700hPa: values[7],
      _600hPa: values[8],
    };
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
  // Month is 0-indexed, so add 1 and pad with '0' if less than 10
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  // Day of the month, pad with '0' if less than 10
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createQueryParams(
  location: Location,
  hourlyParams: HourlyParams,
  model: WeatherModel,
  start: Date,
  numberOfDays: number
) {
  // Get the user's local timezone from the browser
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log('Using local timezone:', localTimezone);

  const endDate = new Date(start.getTime() + (numberOfDays - 1) * 24 * 60 * 60 * 1000);

  return {
    ...hourlyParams,
    daily: ['sunrise', 'sunset'],
    latitude: location.latitude,
    longitude: location.longitude,
    start_date: formatDateToYYYYMMDD(start),
    end_date: formatDateToYYYYMMDD(endDate),
    models: model,
    timezone: localTimezone,
  };
}

export async function fetchWeatherData(
  location: Location,
  model: WeatherModel = 'icon_d2',
  start: Date,
  numberOfDays: number = 1
): Promise<WeatherDataType> {
  const modelVariables = getVariablesForModel(model);
  const hourlyParams = createHourlyParams(modelVariables);
  const params = createQueryParams(location, hourlyParams, model, start, numberOfDays);

  const responses = await fetchWeatherApi(url, params);
  // Process first location. Add a for-loop for multiple locations or weather models
  const response = responses[0];

  // Attributes for timezone and location
  // const utcOffsetSeconds = response.utcOffsetSeconds();
  const timezone = response.timezoneAbbreviation() ?? 'UTC';

  const sunriseInt: number = Number(response.daily()!.variables(0)?.valuesInt64(0));
  const sunsetInt: number = Number(response.daily()!.variables(1)?.valuesInt64(0));
  const sunrise = new Date(sunriseInt * 1000);
  const sunset = new Date(sunsetInt * 1000);

  // const latitude = response.latitude();
  // const longitude = response.longitude();
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
  };

  return weatherData;
}
