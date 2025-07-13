import { getCloudCoverData } from '$lib/charts/clouds';
import { getWindFieldAllLevels } from '$lib/charts/wind';
import type { ChartWorkerInput, ChartWorkerSuccessOutput, ChartWorkerErrorOutput } from './chartWorker.types';

// Type the worker's global context
declare const self: DedicatedWorkerGlobalScope;

self.onmessage = function (e: MessageEvent<ChartWorkerInput>) {
  const { weatherData } = e.data;

  try {
    // Heavy data processing happens here (off main thread)
    const cloudData = getCloudCoverData(weatherData);
    const windData = getWindFieldAllLevels(weatherData);

    // Send processed data back to main thread
    const successResponse: ChartWorkerSuccessOutput = {
      success: true,
      data: {
        cloudData,
        windData,
        weatherData,
      },
    };

    self.postMessage(successResponse);
  } catch (error) {
    const errorResponse: ChartWorkerErrorOutput = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    self.postMessage(errorResponse);
  }
};
