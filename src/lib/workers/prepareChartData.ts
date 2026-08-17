import { getCloudCoverData } from '$lib/charts/clouds';
import { getWindFieldAllLevels } from '$lib/charts/wind';
import { calculateLclWeather } from '$lib/meteo/lcl';
import { addSeconds } from '$lib/utils/dateExtensions';

import { RAIN_SPOT_GRID_SIZE, RAIN_SPOT_RADIUS_KM, type WindChartData, type VerticalProfile } from '$lib/api/types';
import type {
  ChartWorkerInput,
  ChartWorkerSuccessOutput,
  TemperatureChartData,
  RainCloudChartData,
  RainSpotChartData,
} from './chartWorker.types';

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
      value: data.hourly.temperature_2m[i] ?? NaN,
    })),
    dewpointData: data.hourly.time.map((time, i) => ({
      time,
      value: data.hourly.dewpoint_2m[i] ?? NaN,
    })),
    humidityData: data.hourly.time.map((time, i) => ({
      time,
      value: data.hourly.relativeHumidity_2m[i] ?? NaN,
    })),
    sunrise: data.sunrise,
    sunset: data.sunset,
  };
}

function prepareRainAndCloudData(data: WindChartData): RainCloudChartData {
  const cloudRects: RainCloudChartData['cloudRects'] = [];

  data.hourly.time.forEach((time, i) => {
    const x1 = addSeconds(time, -1800);
    const x2 = addSeconds(time, 1800);
    const bands = [
      { y1: 0, y2: 1 / 3, cloudCover: data.hourly.cloudCoverLow[i] },
      { y1: 1 / 3, y2: 2 / 3, cloudCover: data.hourly.cloudCoverMid[i] },
      { y1: 2 / 3, y2: 1, cloudCover: data.hourly.cloudCoverHigh[i] },
    ];
    bands.forEach((band) => cloudRects.push({ x1, x2, ...band }));
  });

  return {
    cloudRects,
    rainDots: data.hourly.time.map((time, i) => ({
      time,
      rain: data.hourly.precipitation[i],
    })),
  };
}

function prepareRainSpotData(data: WindChartData): RainSpotChartData {
  const rainSpot = data.rainSpot;
  if (!rainSpot) return { glyphs: [], gridSize: RAIN_SPOT_GRID_SIZE, radiusKm: RAIN_SPOT_RADIUS_KM };

  const visibleTimes = new Set(data.hourly.time.map((time) => time.getTime()));
  const glyphs: RainSpotChartData['glyphs'] = [];

  for (let timeIndex = 0; timeIndex < rainSpot.time.length; timeIndex++) {
    const time = rainSpot.time[timeIndex];
    if (!visibleTimes.has(time.getTime())) continue;

    const precipitation = new Float32Array(rainSpot.gridSize * rainSpot.gridSize);
    precipitation.fill(NaN);

    for (const cell of rainSpot.cells) {
      const value = cell.precipitation[timeIndex];
      if (Number.isFinite(value)) precipitation[cell.row * rainSpot.gridSize + cell.column] = value;
    }

    const finiteValues = Array.from(precipitation).filter(Number.isFinite);
    if (finiteValues.length === 0) continue;
    glyphs.push({
      time,
      x1: addSeconds(time, -1800),
      x2: addSeconds(time, 1800),
      precipitation,
      maximum: Math.max(...finiteValues),
      wetCellCount: finiteValues.filter((value) => value >= 0.1).length,
    });
  }

  return {
    glyphs,
    gridSize: rainSpot.gridSize,
    radiusKm: rainSpot.radiusKm,
  };
}

function calculateDomains(times: Date[]): [Date, Date] {
  const timestamps = times.map((time) => time.getTime()).filter(Number.isFinite);
  if (timestamps.length === 0) {
    throw new Error('Cannot prepare chart without valid hourly timestamps');
  }

  const xMin = addSeconds(new Date(Math.min(...timestamps)), -1800);
  const xMax = addSeconds(new Date(Math.max(...timestamps)), 1800);
  return [xMin, xMax];
}

export function prepareChartData(input: ChartWorkerInput): ChartWorkerSuccessOutput['data'] {
  const { windChartData, maxAltitude, model, daylightOnly } = input;
  const data = daylightOnly ? filterDaylightHours(windChartData) : windChartData;

  return {
    cloudData: getCloudCoverData(data, model, maxAltitude),
    windData: getWindFieldAllLevels(data, model, maxAltitude),
    lcl: calculateLclWeather(data),
    elevation: windChartData.elevation,
    modelGridElevation: windChartData.modelGridElevation,
    timezoneAbbr: windChartData.timezoneAbbr,
    temperatureChartData: prepareTemperatureData(data),
    rainCloudChartData: prepareRainAndCloudData(data),
    rainSpotChartData: prepareRainSpotData(data),
    xDomain: calculateDomains(data.hourly.time),
  };
}
