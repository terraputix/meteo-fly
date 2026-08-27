import type { WindChartData, WeatherModel } from '$lib/api/types';
import type { MaxAltitude } from '$lib/meteo/types';
import type { CloudCoverData } from '$lib/charts/clouds';
import type { WindFieldLevel } from '$lib/charts/wind';
import type { LclPoint } from '$lib/meteo/lcl';

export interface ChartWorkerInput {
  windChartData: WindChartData;
  maxAltitude: MaxAltitude;
  model: WeatherModel;
  daylightOnly?: boolean;
}

export interface ChartWorkerRequest {
  requestId: number;
  input: ChartWorkerInput;
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

export interface RainSpotGlyph {
  time: Date;
  x1: Date;
  x2: Date;
  precipitation: Float32Array;
  maximum: number;
  wetCellCount: number;
}

export interface RainSpotChartData {
  glyphs: RainSpotGlyph[];
  gridSize: number;
  radiusKm: number;
}

export interface ChartWorkerSuccessOutput {
  requestId: number;
  success: true;
  data: {
    cloudData: CloudCoverData[];
    windData: WindFieldLevel[];
    lcl: LclPoint[];
    elevation: number;
    modelGridElevation: number | undefined;
    timezone: string;
    timezoneAbbr: string;
    temperatureChartData: TemperatureChartData;
    rainCloudChartData: RainCloudChartData;
    rainSpotChartData: RainSpotChartData;
    xDomain: [Date, Date];
  };
}

export interface ChartWorkerErrorOutput {
  requestId: number;
  success: false;
  error: string;
}

export type ChartWorkerOutput = ChartWorkerSuccessOutput | ChartWorkerErrorOutput;
