import { getCloudCoverData } from '$lib/charts/clouds';
import { getWindFieldAllLevels } from '$lib/charts/wind';
import { calculateCloudBaseWeather } from '$lib/meteo/cloudBase';
import { pressureLevels, getAtLevel } from '$lib/charts/pressureLevels';

import { min as d3Min, max as d3Max } from 'd3-array';
import { ticks as d3Ticks } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import type { WeatherDataType } from '$lib/api/types';
import type {
  ChartWorkerInput,
  ChartWorkerSuccessOutput,
  ChartWorkerErrorOutput,
  TemperatureChartData,
  RainCloudChartData,
  WindChartData,
  WindCloudColumn,
} from './chartWorker.types';
import { addSeconds } from '../../utils/dateExtensions';

function prepareTemperatureData(data: WeatherDataType): TemperatureChartData {
  const tempAxisMin = Math.floor((d3Min(data.hourly.dewpoint_2m) ?? 0) - 5);
  const tempAxisMax = Math.ceil((d3Max(data.hourly.temperature_2m) ?? 0) + 5);
  const humidityScale = scaleLinear([0, 100], [tempAxisMin, tempAxisMax]);

  return {
    tempAxisMin,
    tempAxisMax,
    humidityScale: {
      domain: [0, 100] as [number, number],
      range: [tempAxisMin, tempAxisMax] as [number, number],
      ticks: humidityScale.ticks(4),
    },
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

function prepareRainAndCloudData(data: WeatherDataType, xMin: Date, xMax: Date): RainCloudChartData {
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
        y: 0.2,
        rain: data.hourly.precipitation[i],
      }))
      .filter((d) => d.rain > 0),
    xMin,
    xMax,
  };
}

function prepareWindChartData(data: WeatherDataType): WindChartData {
  const yDomain: [number, number] = [0, 4350];

  return {
    yDomain,
    elevation: data.elevation,
    timezoneAbbr: data.timezoneAbbr,
    tickValues: d3Ticks(0, 4500, 9),
  };
}

/**
 * Build one WindCloudColumn per hourly timestamp.
 * Each column is centred at the timestamp (±30 min) so it aligns with
 * the wind arrows which are also plotted at the exact hourly timestamp.
 * Levels are ordered bottom-to-top (ascending heightMeters).
 */
function buildWindCloudColumns(data: WeatherDataType): WindCloudColumn[] {
  const HALF_WIDTH = 1_800_000; // 30 minutes in ms
  const times = data.hourly.time;

  // Collect the cloud cover value at each pressure level for every hour
  const levelData = pressureLevels.map((level) => ({
    heightMeters: level.heightMeters,
    values: getAtLevel(data.hourly.cloudCoverProfile, level.hPa),
  }));

  // yMin is just below the lowest pressure level so the column starts at the ground
  const yMin = pressureLevels[0].heightMeters - 250;
  const yMax = pressureLevels[pressureLevels.length - 1].heightMeters + 500;

  return times.map((time, i) => {
    const x = time.getTime();
    const levels = levelData.map((ld) => ({
      heightMeters: ld.heightMeters,
      cloudCover: parseFloat((ld.values[i] ?? 0).toFixed(1)),
    }));

    return { x, halfWidth: HALF_WIDTH, yMin, yMax, levels };
  });
}

function calculateDomains(windData: Array<{ time: Date }>): [Date, Date] {
  const xMin = addSeconds(d3Min(windData, (d) => d.time) as Date, -1800);
  const xMax = addSeconds(d3Max(windData, (d) => d.time) as Date, 1800);
  return [xMin, xMax];
}

self.onmessage = function (e: MessageEvent<ChartWorkerInput>) {
  const { weatherData } = e.data;

  try {
    // Heavy data processing
    const cloudData = getCloudCoverData(weatherData);
    const windCloudColumns = buildWindCloudColumns(weatherData);
    const windData = getWindFieldAllLevels(weatherData);
    const cloudBase = calculateCloudBaseWeather(weatherData);

    // Calculate domains
    const xDomain = calculateDomains(windData);

    // Prepare all chart data
    const temperatureChartData = prepareTemperatureData(weatherData);
    const rainCloudChartData = prepareRainAndCloudData(weatherData, xDomain[0], xDomain[1]);
    const windChartData = prepareWindChartData(weatherData);

    const successResponse: ChartWorkerSuccessOutput = {
      success: true,
      data: {
        cloudData,
        windCloudColumns,
        windData,
        cloudBase,
        weatherData,
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
