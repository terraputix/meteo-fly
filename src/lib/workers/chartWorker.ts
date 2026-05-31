import { getCloudCoverData } from '$lib/charts/clouds';
import { getWindFieldAllLevels } from '$lib/charts/wind';
import { calculateLclWeather } from '$lib/meteo/lcl';

import type { WindChartData } from '$lib/api/types';
import type {
  ChartWorkerInput,
  ChartWorkerSuccessOutput,
  ChartWorkerErrorOutput,
  TemperatureChartData,
  RainCloudChartData,
} from './chartWorker.types';
import { addSeconds } from '$lib/utils/dateExtensions';

function prepareTemperatureData(data: WindChartData): TemperatureChartData {
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

function prepareRainAndCloudData(data: WindChartData): RainCloudChartData {
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

function calculateDomains(windData: Array<{ time: Date }>): [Date, Date] {
  const times = windData.map((d) => d.time.getTime());
  const xMin = addSeconds(new Date(Math.min(...times)), -1800);
  const xMax = addSeconds(new Date(Math.max(...times)), 1800);
  return [xMin, xMax];
}

self.onmessage = function (e: MessageEvent<ChartWorkerInput>) {
  const { windChartData, maxAltitude, model } = e.data;

  try {
    const cloudData = getCloudCoverData(windChartData, model, maxAltitude);
    const windData = getWindFieldAllLevels(windChartData, model, maxAltitude);
    const lcl = calculateLclWeather(windChartData);

    const xDomain = calculateDomains(windData);

    const temperatureChartData = prepareTemperatureData(windChartData);
    const rainCloudChartData = prepareRainAndCloudData(windChartData);

    const successResponse: ChartWorkerSuccessOutput = {
      success: true,
      data: {
        cloudData,
        windData,
        lcl,
        elevation: windChartData.elevation,
        modelGridElevation: windChartData.modelGridElevation,
        timezoneAbbr: windChartData.timezoneAbbr,
        temperatureChartData,
        rainCloudChartData,
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
