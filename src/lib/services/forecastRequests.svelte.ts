import { onMount } from 'svelte';
import { SvelteDate } from 'svelte/reactivity';
import {
  FORECAST_API_MAX_DAYS,
  fetchModelGridElevation,
  fetchSkewTData,
  fetchWindComparisonDay,
  fetchWindChartData,
  forecastDayStart,
  lastCompleteForecastDay,
  type WindComparisonDay,
} from '#lib/api/api.js';
import type { WindComparisonLevel } from '#lib/api/forecastFields.js';
import { MODEL_FORECAST_DAYS } from '#lib/api/models.js';
import { resolveLocationTimezone } from '#lib/api/timezone.js';
import { describeForecastFailure, type ForecastFailure } from '#lib/api/forecastFailure.js';
import type { SkewTWeatherData, WindChartData } from '#lib/api/types.js';
import { createLatestRequest, type RequestHandle } from '#lib/services/latestRequest.js';
import type { ChartView, PageParameters } from '#lib/services/types.js';
import { isWeatherCacheOutdatedMessage } from '#lib/services/weatherCache.js';

type ForecastSelection = Pick<PageParameters, 'location' | 'selectedDay' | 'cellSelection'> &
  (
    | { view: 'comparison'; level: WindComparisonLevel }
    | ({ view: 'wind' | 'skewt' } & Pick<PageParameters, 'selectedModel' | 'maxAltitude'>)
  );

export type ForecastData =
  | { view: 'wind'; weather: WindChartData }
  | { view: 'skewt'; weather: SkewTWeatherData }
  | { view: 'comparison'; weather: WindComparisonDay };

const loadErrors: Record<ChartView, string> = {
  wind: 'The wind forecast could not load.',
  skewt: 'The sounding forecast could not load.',
  comparison: 'Wind comparison could not load.',
};

export function createForecastRequest(
  getSelection: () => ForecastSelection,
  resolveHour: (day: number, times: Date[]) => void
) {
  const selection = $derived(getSelection());
  const locationKey = $derived(`${selection.location.latitude},${selection.location.longitude}`);
  const day = $derived(selection.selectedDay);
  const referenceDate = $derived.by(() => {
    void locationKey;
    void day;
    return new SvelteDate();
  });
  let resolvedTimezone = $state.raw<{ key: string; value: string }>();
  const timezone = $derived(resolvedTimezone?.key === locationKey ? resolvedTimezone.value : undefined);
  const modelDays = $derived(
    selection.view === 'comparison' ? FORECAST_API_MAX_DAYS : MODEL_FORECAST_DAYS[selection.selectedModel]
  );
  const maxDays = $derived(timezone ? lastCompleteForecastDay(referenceDate, timezone, modelDays) : modelDays);
  const date = $derived(timezone ? forecastDayStart(referenceDate, timezone, day) : undefined);

  let data = $state.raw<ForecastData | null>(null);
  let loading = $state(true);
  let error = $state<ForecastFailure | null>(null);
  let cachedAt = $state<number | null>(null);
  let retries = $state(0);
  const latest = createLatestRequest();

  $effect(() => {
    void retries;
    data = null;
    error = null;
    cachedAt = null;
    loading = true;
    void load(selection, locationKey, referenceDate, latest.start());
    return latest.cancel;
  });

  async function load(input: ForecastSelection, key: string, reference: Date, handle: RequestHandle) {
    const { location, selectedDay, cellSelection, view } = input;
    const { signal } = handle;
    let errorMessage = 'Could not determine the forecast location’s time zone.';

    try {
      const zone = await resolveLocationTimezone(location, signal);
      if (!latest.isCurrent(handle)) return;
      resolvedTimezone = { key, value: zone };
      if (selectedDay > maxDays) return;

      errorMessage = loadErrors[view];
      const offset = selectedDay - 1;
      if (input.view === 'comparison') {
        const weather = await fetchWindComparisonDay(
          location,
          zone,
          offset,
          input.level,
          cellSelection,
          signal,
          reference
        );
        if (!latest.isCurrent(handle)) return;
        data = { view: 'comparison', weather };
        resolveHour(selectedDay, weather.time);
        return;
      }

      const { selectedModel: model, maxAltitude } = input;
      if (input.view === 'wind') {
        const weather = await fetchWindChartData(
          location,
          model,
          reference,
          zone,
          1,
          maxAltitude,
          cellSelection,
          signal,
          offset
        );
        if (!latest.isCurrent(handle)) return;
        data = { view: 'wind', weather };
      } else {
        const weather = await fetchSkewTData(
          location,
          model,
          reference,
          zone,
          maxAltitude,
          cellSelection,
          signal,
          offset
        );
        if (!latest.isCurrent(handle)) return;
        data = { view: 'skewt', weather };
        resolveHour(selectedDay, weather.hourly.time);
      }

      loading = false;
      const forecast = data;
      if (!forecast.weather.selectedGridCell) return;
      const modelGridElevation = await fetchModelGridElevation(
        forecast.weather.selectedGridCell,
        model,
        cellSelection,
        signal
      ).catch(() => undefined);
      if (latest.isCurrent(handle) && modelGridElevation !== undefined) {
        if (forecast.view === 'wind') data = { view: 'wind', weather: { ...forecast.weather, modelGridElevation } };
        else data = { view: 'skewt', weather: { ...forecast.weather, modelGridElevation } };
      }
    } catch (cause) {
      if (!latest.isCurrent(handle)) return;
      console.error(cause);
      data = null;
      error = describeForecastFailure(cause, errorMessage, navigator.onLine);
    } finally {
      if (latest.finish(handle)) loading = false;
    }
  }

  onMount(() => {
    const worker = navigator.serviceWorker;
    if (!worker) return;
    const handleCacheNotice = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (!isWeatherCacheOutdatedMessage(message) || message.dataset !== selection.view) return;
      cachedAt = cachedAt === null ? message.cachedAt : Math.min(cachedAt, message.cachedAt);
    };
    worker.addEventListener('message', handleCacheNotice);
    return () => worker.removeEventListener('message', handleCacheNotice);
  });

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
    get timezone() {
      return timezone;
    },
    get date() {
      return date;
    },
    get maxDays() {
      return maxDays;
    },
    retry() {
      retries++;
    },
  };
}
