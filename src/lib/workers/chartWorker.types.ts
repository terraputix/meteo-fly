import type { WeatherDataType } from '$lib/api/types';
import type { CloudCoverData } from '$lib/charts/clouds';
import type { WindFieldLevel } from '$lib/charts/wind';

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
