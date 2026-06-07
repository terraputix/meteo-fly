import { getCloudCoverData } from '$lib/charts/clouds';
import { getWindFieldAllLevels } from '$lib/charts/wind';
import { calculateLclWeather } from '$lib/meteo/lcl';

import type { WindChartData, VerticalProfile } from '$lib/api/types';
import type {
  ChartWorkerInput,
  ChartWorkerSuccessOutput,
  ChartWorkerErrorOutput,
  TemperatureChartData,
  RainCloudChartData,
} from './chartWorker.types';
import { addSeconds } from '$lib/utils/dateExtensions';

function filterDaylightHours(data: WindChartData): WindChartData {
  const sunriseMs = data.sunrise.getTime() - 3600_000;
  const sunsetMs = data.sunset.getTime() + 3600_000;

  const indices: number[] = [];
  for (let i = 0; i < data.hourly.time.length; i++) {
    const t = data.hourly.time[i].getTime();
    if (t >= sunriseMs && t <= sunsetMs) {
      indices.push(i);
    }
  }

  function pickArray(arr: Float32Array): Float32Array {
    return new Float32Array(indices.map((i) => arr[i]));
  }

  function pickDates(arr: Date[]): Date[] {
    return indices.map((i) => arr[i]);
  }

  function pickProfile(profile: VerticalProfile): VerticalProfile {
    return Object.fromEntries(
      Object.entries(profile).map(([key, arr]) => [key, pickArray(arr as Float32Array)])
    ) as VerticalProfile;
  }

  return {
    ...data,
    hourly: {
      time: pickDates(data.hourly.time),
      cloudCoverProfile: pickProfile(data.hourly.cloudCoverProfile),
      windSpeedProfile: pickProfile(data.hourly.windSpeedProfile),
      windDirectionProfile: pickProfile(data.hourly.windDirectionProfile),
      precipitation: pickArray(data.hourly.precipitation),
      temperature_2m: pickArray(data.hourly.temperature_2m),
      dewpoint_2m: pickArray(data.hourly.dewpoint_2m),
      relativeHumidity_2m: pickArray(data.hourly.relativeHumidity_2m),
      cloudCoverLow: pickArray(data.hourly.cloudCoverLow),
      cloudCoverMid: pickArray(data.hourly.cloudCoverMid),
      cloudCoverHigh: pickArray(data.hourly.cloudCoverHigh),
    },
  };
}

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

function calculateDomains(
  windData: Array<{ time: Date }>,
  sunrise?: Date,
  sunset?: Date,
  daylightOnly?: boolean
): [Date, Date] {
  if (daylightOnly && sunrise && sunset) {
    return [addSeconds(sunrise, -3600), addSeconds(sunset, 3600)];
  }
  const times = windData.map((d) => d.time.getTime());
  const xMin = addSeconds(new Date(Math.min(...times)), -1800);
  const xMax = addSeconds(new Date(Math.max(...times)), 1800);
  return [xMin, xMax];
}

self.onmessage = function (e: MessageEvent<ChartWorkerInput>) {
  const { windChartData, maxAltitude, model, daylightOnly } = e.data;

  try {
    const data = daylightOnly ? filterDaylightHours(windChartData) : windChartData;

    const cloudData = getCloudCoverData(data, model, maxAltitude);
    const windData = getWindFieldAllLevels(data, model, maxAltitude);
    const lcl = calculateLclWeather(data);

    const xDomain = calculateDomains(windData, windChartData.sunrise, windChartData.sunset, daylightOnly);

    const temperatureChartData = prepareTemperatureData(data);
    const rainCloudChartData = prepareRainAndCloudData(data);

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
