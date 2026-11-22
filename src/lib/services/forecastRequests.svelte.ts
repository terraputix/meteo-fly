import { fetchModelGridElevation, fetchSkewTData, fetchSurfaceWindDay, fetchWindChartData } from '#lib/api/api.js';
import type { Location } from '#lib/api/types.js';
import { createLatestRequest, isAbortError, type RequestHandle } from '#lib/services/latestRequest.js';
import type { PageParameters } from '#lib/services/types.js';

export type ForecastDayRequest = {
  location: Location;
  timezone: string;
  referenceDate: Date;
  dayOffset: number;
  cellSelection: PageParameters['cellSelection'];
};

export type ModelForecastRequest = ForecastDayRequest & {
  model: PageParameters['selectedModel'];
  maxAltitude: PageParameters['maxAltitude'];
};

type ResolveHour = (day: number, times: Date[]) => void;

function createForecastRequest<Request, Data>(
  getRequest: () => Request | null,
  load: (request: Request, signal: AbortSignal) => Promise<Data>,
  errorMessage: string,
  options: { retainData?: boolean; onLoaded?: (data: Data, request: Request) => void } = {}
) {
  let data = $state.raw<Data | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let cachedAt = $state<number | null>(null);
  let retries = $state(0);
  const latest = createLatestRequest();

  $effect(() => {
    const request = getRequest();
    void retries;
    error = null;
    cachedAt = null;
    if (!request || !options.retainData) data = null;
    loading = request !== null;
    if (!request) return;
    void update(request, latest.start());
    return latest.cancel;
  });

  async function update(request: Request, handle: RequestHandle) {
    try {
      const result = await load(request, handle.signal);
      if (!latest.isCurrent(handle)) return;
      data = result;
      options.onLoaded?.(result, request);
    } catch (cause) {
      if (!latest.isCurrent(handle) || isAbortError(cause)) return;
      console.error(cause);
      data = null;
      error = errorMessage;
    } finally {
      if (latest.finish(handle)) loading = false;
    }
  }

  return {
    get data() {
      return data;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get cachedAt() {
      return cachedAt;
    },
    retry() {
      retries++;
    },
    markCached(timestamp: number) {
      cachedAt = cachedAt === null ? timestamp : Math.min(cachedAt, timestamp);
    },
  };
}

export function createWindForecast(getRequest: () => ModelForecastRequest | null) {
  return createForecastRequest(
    getRequest,
    async ({ location, model, referenceDate, timezone, maxAltitude, cellSelection, dayOffset }, signal) => {
      const result = await fetchWindChartData(
        location,
        model,
        referenceDate,
        timezone,
        1,
        maxAltitude,
        cellSelection,
        signal,
        dayOffset
      );
      signal.throwIfAborted();

      const modelGridElevation = result.selectedGridCell
        ? await fetchModelGridElevation(result.selectedGridCell, model, cellSelection, signal).catch(
            (cause: unknown) => {
              if (isAbortError(cause)) throw cause;
              return undefined;
            }
          )
        : undefined;
      return { ...result, modelGridElevation };
    },
    'Failed to fetch wind forecast. Check your connection and try again.',
    { retainData: true }
  );
}

export function createSkewTForecast(getRequest: () => ModelForecastRequest | null, resolveHour: ResolveHour) {
  return createForecastRequest(
    getRequest,
    ({ location, model, referenceDate, timezone, maxAltitude, cellSelection, dayOffset }, signal) =>
      fetchSkewTData(location, model, referenceDate, timezone, maxAltitude, cellSelection, signal, dayOffset),
    'Failed to fetch sounding data. Check your connection and try again.',
    { onLoaded: (result, request) => resolveHour(request.dayOffset + 1, result.hourly.time) }
  );
}

export function createWindComparison(getRequest: () => ForecastDayRequest | null, resolveHour: ResolveHour) {
  return createForecastRequest(
    getRequest,
    ({ location, timezone, dayOffset, cellSelection, referenceDate }, signal) =>
      fetchSurfaceWindDay(location, timezone, dayOffset, cellSelection, signal, referenceDate),
    'Wind comparison could not load.',
    { onLoaded: (result, request) => resolveHour(request.dayOffset + 1, result.time) }
  );
}
