import type { ChartWorkerRequest, ChartWorkerSuccessOutput, ChartWorkerErrorOutput } from './chartWorker.types';
import { prepareChartData } from './prepareChartData';

self.onmessage = function (e: MessageEvent<ChartWorkerRequest>) {
  const { requestId, input } = e.data;

  try {
    const successResponse: ChartWorkerSuccessOutput = {
      requestId,
      success: true,
      data: prepareChartData(input),
    };

    self.postMessage(successResponse);
  } catch (error) {
    const errorResponse: ChartWorkerErrorOutput = {
      requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    self.postMessage(errorResponse);
  }
};
