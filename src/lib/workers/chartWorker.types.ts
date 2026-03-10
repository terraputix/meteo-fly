import type { WeatherDataType } from '$lib/api/types';
import type { CloudCoverData } from '$lib/charts/clouds';
import type { WindFieldLevel } from '$lib/charts/wind';

/**
 * One time-column of cloud cover data for the wind chart.
 * x is the timestamp in ms, centred (±30 min) so it aligns with wind arrows.
 * levels are sorted bottom-to-top (ascending heightMeters).
 */
export interface WindCloudColumn {
  /** Centre timestamp in milliseconds */
  x: number;
  /** Half-width of the column in ms (always 1800000 = 30 min) */
  halfWidth: number;
  /** Bottom of the lowest band in metres */
  yMin: number;
  /** Top of the highest band in metres */
  yMax: number;
  /** Gradient stops from bottom to top, each 0-100 */
  levels: Array<{ heightMeters: number; cloudCover: number }>;
}

export interface ChartWorkerInput {
  weatherData: WeatherDataType;
}

export interface TemperatureChartData {
  tempAxisMin: number;
  tempAxisMax: number;
  humidityScale: {
    domain: [number, number];
    range: [number, number];
    ticks: number[];
  };
  temperatureData: Array<{ time: Date; value: number }>;
  dewpointData: Array<{ time: Date; value: number }>;
  humidityData: Array<{ time: Date; value: number }>;
  sunrise: Date;
  sunset: Date;
}

export interface RainCloudChartData {
  cloudRects: Array<{
    x1: Date;
    x2: Date;
    y1: number;
    y2: number;
    cloudCover: number;
  }>;
  rainDots: Array<{
    time: Date;
    y: number;
    rain: number;
  }>;
  xMin: Date;
  xMax: Date;
}

export interface WindChartData {
  yDomain: [number, number];
  elevation: number;
  timezoneAbbr: string;
  tickValues: number[];
}

export interface ChartWorkerSuccessOutput {
  success: true;
  data: {
    cloudData: CloudCoverData[];
    windCloudColumns: WindCloudColumn[];
    windData: WindFieldLevel[];
    cloudBase: Array<{ x: Date; y: number }>;
    weatherData: WeatherDataType;
    temperatureChartData: TemperatureChartData;
    rainCloudChartData: RainCloudChartData;
    windChartData: WindChartData;
    xDomain: [Date, Date];
  };
}

export interface ChartWorkerErrorOutput {
  success: false;
  error: string;
}

export type ChartWorkerOutput = ChartWorkerSuccessOutput | ChartWorkerErrorOutput;
