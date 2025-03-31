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

export function createParams(variables: (ProfileVariables | FlatVariable)[]) {
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

export async function fetchWeatherData(
  location: Location,
  model: WeatherModel = 'icon_d2',
  start: Date,
  numberOfDays: number = 1
): Promise<WeatherDataType> {
  const modelVariables = getVariablesForModel(model);
  const hourlyParams = createParams(modelVariables);
  const params = {
    ...hourlyParams,
    latitude: location.latitude,
    longitude: location.longitude,
    start_date: start.toISOString().split('T')[0],
    end_date: new Date(start.getTime() + (numberOfDays - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    models: model,
  };

  const responses = await fetchWeatherApi(url, params);
  // Process first location. Add a for-loop for multiple locations or weather models
  const response = responses[0];

  // Attributes for timezone and location
  const utcOffsetSeconds = response.utcOffsetSeconds();
  // const timezone = response.timezone();
  // const timezoneAbbreviation = response.timezoneAbbreviation();
  // const latitude = response.latitude();
  // const longitude = response.longitude();
  const elevation = response.elevation();

  const hourly = response.hourly()!;
  const weatherData: WeatherDataType = {
    elevation: elevation,
    hourly: {
      time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
        (t) => new Date((t + utcOffsetSeconds) * 1000)
      ),
      ...modelVariables.reduce((acc, v) => {
        const key = v.key as keyof HourlyData;
        const value = getVariableFromHourly(hourlyParams.hourly, hourly, v)!;
        acc[key] = value as Date[] & VerticalProfile & Float32Array;
        return acc;
      }, {} as Partial<HourlyData>),
    } as HourlyData,
  };

  return weatherData;
}
