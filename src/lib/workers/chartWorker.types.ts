import type { WindChartData, WeatherModel } from '$lib/api/types';
import type { MaxAltitude } from '$lib/meteo/types';
import type { CloudCoverData } from '$lib/charts/clouds';
import type { WindFieldLevel } from '$lib/charts/wind';

export interface ChartWorkerInput {
  windChartData: WindChartData;
  maxAltitude: MaxAltitude;
  model: WeatherModel;
  daylightOnly?: boolean;
}

export interface TemperatureChartData {
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
    rain: number;
  }>;
}

export interface ChartWorkerSuccessOutput {
  success: true;
  data: {
    cloudData: CloudCoverData[];
    windData: WindFieldLevel[];
    lcl: Array<{ time: Date; value: number }>;
    elevation: number;
    modelGridElevation: number | undefined;
    timezoneAbbr: string;
    temperatureChartData: TemperatureChartData;
    rainCloudChartData: RainCloudChartData;
    xDomain: [Date, Date];
  };
}

export interface ChartWorkerErrorOutput {
  success: false;
  error: string;
}

export type ChartWorkerOutput = ChartWorkerSuccessOutput | ChartWorkerErrorOutput;
