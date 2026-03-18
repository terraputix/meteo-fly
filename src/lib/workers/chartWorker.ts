import { getCloudCoverData } from '$lib/charts/clouds';
import { getWindFieldAllLevels } from '$lib/charts/wind';
import { calculateCloudBaseWeather } from '$lib/meteo/cloudBase';

import { min as d3Min, max as d3Max } from 'd3-array';
import type { WeatherDataType } from '$lib/api/types';
import type {
  ChartWorkerInput,
  ChartWorkerSuccessOutput,
  ChartWorkerErrorOutput,
  TemperatureChartData,
  RainCloudChartData,
  WindChartData,
} from './chartWorker.types';
import { addSeconds } from '$lib/utils/dateExtensions';

function prepareTemperatureData(data: WeatherDataType): TemperatureChartData {
  return {
    temperatureData: data.hourly.time.map((time, i) => ({
      time,
      value: data.hourly.temperature_2m[i],
    })),
    dewpointData: data.hourly.time.map((time, i) => ({
      time,
      value: data.hourly.dewpoint_2m[i],
    })),
    humidityData: data.hourly.time.map((time, i) => ({
      time,
      value: data.hourly.relativeHumidity_2m[i],
    })),
    sunrise: data.sunrise,
    sunset: data.sunset,
  };
}

function prepareRainAndCloudData(data: WeatherDataType): RainCloudChartData {
  return {
    cloudRects: data.hourly.time.flatMap((time, i) => [
      {
        x1: addSeconds(time, -1800),
        x2: addSeconds(time, 1800),
        y1: 0,
        y2: 1 / 3,
        cloudCover: data.hourly.cloudCoverLow[i],
      },
      {
        x1: addSeconds(time, -1800),
        x2: addSeconds(time, 1800),
        y1: 1 / 3,
        y2: 2 / 3,
        cloudCover: data.hourly.cloudCoverMid[i],
      },
      {
        x1: addSeconds(time, -1800),
        x2: addSeconds(time, 1800),
        y1: 2 / 3,
        y2: 1,
        cloudCover: data.hourly.cloudCoverHigh[i],
      },
    ]),
    rainDots: data.hourly.time
      .map((time, i) => ({
        time,
        rain: data.hourly.precipitation[i],
      }))
      .filter((d) => d.rain > 0),
  };
}

function prepareWindChartData(data: WeatherDataType): WindChartData {
  return {
    elevation: data.elevation,
    timezoneAbbr: data.timezoneAbbr,
  };
}

function calculateDomains(windData: Array<{ time: Date }>): [Date, Date] {
  const xMin = addSeconds(d3Min(windData, (d) => d.time) as Date, -1800);
  const xMax = addSeconds(d3Max(windData, (d) => d.time) as Date, 1800);
  return [xMin, xMax];
}

self.onmessage = function (e: MessageEvent<ChartWorkerInput>) {
  const { weatherData } = e.data;

  try {
    const cloudData = getCloudCoverData(weatherData);
    const windData = getWindFieldAllLevels(weatherData);
    const cloudBase = calculateCloudBaseWeather(weatherData);

    const xDomain = calculateDomains(windData);

    const temperatureChartData = prepareTemperatureData(weatherData);
    const rainCloudChartData = prepareRainAndCloudData(weatherData);
    const windChartData = prepareWindChartData(weatherData);

    const successResponse: ChartWorkerSuccessOutput = {
      success: true,
      data: {
        cloudData,
        windData,
        cloudBase,
        temperatureChartData,
        rainCloudChartData,
        windChartData,
        xDomain,
      },
    };

    self.postMessage(successResponse);
  } catch (error) {
    const errorResponse: ChartWorkerErrorOutput = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    self.postMessage(errorResponse);
  }
};
