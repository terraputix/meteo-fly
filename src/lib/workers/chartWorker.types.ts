import type { WeatherDataType } from '$lib/api/types';
import type { CloudCoverData } from '$lib/charts/clouds';
import type { WindFieldLevel } from '$lib/charts/wind';

export interface ChartWorkerInput {
  weatherData: WeatherDataType;
}

export interface ChartWorkerSuccessOutput {
  success: true;
  data: {
    cloudData: CloudCoverData[];
    windData: WindFieldLevel[];
    weatherData: WeatherDataType;
  };
}

export interface ChartWorkerErrorOutput {
  success: false;
  error: string;
}

export type ChartWorkerOutput = ChartWorkerSuccessOutput | ChartWorkerErrorOutput;
