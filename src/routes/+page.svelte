<script lang="ts">
  import { saveLastVisitedURL } from '$lib/services/storage';
  import { page } from '$app/stores';
  import { afterNavigate, replaceState } from '$app/navigation';
  import { isMobile } from '$lib/stores/media';
  import LocationMap from '$lib/components/LocationMap.svelte';
  import ChartContainer from '$lib/components/ChartContainer.svelte';
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '$lib/components/ui/resizable';
  import { getInitialParameters } from '$lib/services/defaults';
  import { type PageParameters } from '$lib/services/types';
  import { fetchWindChartData, fetchModelGridElevation, fetchSkewTData } from '$lib/api/api';
  import type { Location, WindChartData, SkewTWeatherData } from '$lib/api/types';
  import { addDays } from '$lib/utils/dateExtensions';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { onDestroy, onMount } from 'svelte';
  import { createLatestRequest, isAbortError, type RequestHandle } from '$lib/services/latestRequest';
  import { isWeatherCacheOutdatedMessage } from '$lib/services/weatherCache';

  let parameters: PageParameters = $state(getInitialParameters($page.url.searchParams));
  let showChart = $state(false);
  let chartView: 'wind' | 'skewt' = $state(parameters.chartView ?? 'wind');
  let selectedHour = $state(parameters.hour ?? 0);
  let windChartData = $state.raw<WindChartData | null>(null);
  let skewTWeatherData = $state.raw<SkewTWeatherData | null>(null);
  let isWindChartLoading = $state(false);
  let isSkewTLoading = $state(false);
  let error: string | null = $state(null);
  let windOutdatedCachedAt: number | null = $state(null);
  let skewTOutdatedCachedAt: number | null = $state(null);

  let updateTimer: ReturnType<typeof setTimeout> | null = null;
  const windRequest = createLatestRequest();
  const skewTRequest = createLatestRequest();

  type WeatherRequestParameters = {
    location: Location;
    model: PageParameters['selectedModel'];
    startDate: Date;
    maxAltitude: PageParameters['maxAltitude'];
    cellSelection: PageParameters['cellSelection'];
  };

  const startDate = $derived(addDays(new Date(), parameters.selectedDay - 1));
  const outdatedCachedAt = $derived(chartView === 'wind' ? windOutdatedCachedAt : skewTOutdatedCachedAt);
  const outdatedCachedAtLabel = $derived(
    outdatedCachedAt === null
      ? ''
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(outdatedCachedAt))
  );

  const urlSearch = $derived.by(() => {
    const { location, selectedDay, selectedModel, maxAltitude, cellSelection, daylightOnly } = parameters;
    const params = new SvelteURLSearchParams({
      lat: location.latitude.toString(),
      lon: location.longitude.toString(),
      day: selectedDay.toString(),
      model: selectedModel,
      maxAlt: maxAltitude.toString(),
      cellSelection,
      view: chartView,
    });
    params.set('hour', selectedHour.toString());
    if (daylightOnly) params.set('daylight', '1');
    return `?${params.toString()}`;
  });
  function syncURL() {
    const search = urlSearch;
    const currentSearch = window.location.search;
    if (currentSearch === search) return;
    const newURL = `${window.location.pathname}${search}`;
    saveLastVisitedURL(newURL);
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    replaceState(newURL, window.history.state);
  }

  afterNavigate(syncURL);

  $effect(() => {
    void urlSearch;
    try {
      syncURL();
    } catch {
      // Router not ready yet on initial mount; afterNavigate handles it
    }
  });

  function closeChartPanel() {
    showChart = false;
    clearTimeout(updateTimer ?? undefined);
    updateTimer = null;
    windRequest.cancel();
    skewTRequest.cancel();
    isWindChartLoading = false;
    isSkewTLoading = false;
  }

  function toggleChartPanel() {
    if (showChart) {
      closeChartPanel();
    } else {
      showChart = true;
      if (!windChartData && !isWindChartLoading) {
        scheduleWindChartUpdate(getWeatherRequestParameters());
      }
    }
  }

  function updateLocation(location: Location) {
    parameters.location = location;

    if (windChartData) {
      windChartData = {
        ...windChartData,
        selectedGridCell: null,
      };
    }
  }

  function getWeatherRequestParameters(): WeatherRequestParameters {
    return {
      location: {
        latitude: parameters.location.latitude,
        longitude: parameters.location.longitude,
      },
      model: parameters.selectedModel,
      startDate: new Date(startDate),
      maxAltitude: parameters.maxAltitude,
      cellSelection: parameters.cellSelection,
    };
  }

  function scheduleWindChartUpdate(requestParameters: WeatherRequestParameters) {
    clearTimeout(updateTimer ?? undefined);
    const request = windRequest.start();
    isWindChartLoading = true;
    error = null;
    windOutdatedCachedAt = null;
    updateTimer = setTimeout(() => {
      updateTimer = null;
      void updateWindChart(requestParameters, request);
    }, 5);
  }

  $effect(() => {
    scheduleWindChartUpdate(getWeatherRequestParameters());
  });

  $effect(() => {
    if (!showChart || chartView !== 'skewt') {
      skewTRequest.cancel();
      isSkewTLoading = false;
      return;
    }

    const requestParameters = getWeatherRequestParameters();
    const request = skewTRequest.start();
    isSkewTLoading = true;
    skewTOutdatedCachedAt = null;
    void updateSkewTData(requestParameters, request);
  });

  async function updateWindChart(requestParameters: WeatherRequestParameters, request: RequestHandle) {
    try {
      const result = await fetchWindChartData(
        requestParameters.location,
        requestParameters.model,
        requestParameters.startDate,
        1,
        requestParameters.maxAltitude,
        requestParameters.cellSelection,
        request.signal
      );
      if (!windRequest.isCurrent(request)) return;

      const modelGridElevation = result.selectedGridCell
        ? await fetchModelGridElevation(
            result.selectedGridCell,
            requestParameters.model,
            requestParameters.cellSelection,
            request.signal
          ).catch((err: unknown) => {
            if (isAbortError(err)) throw err;
            return undefined;
          })
        : undefined;
      if (!windRequest.isCurrent(request)) return;

      windChartData = { ...result, modelGridElevation };
      showChart = true;
    } catch (err) {
      if (!windRequest.isCurrent(request) || isAbortError(err)) return;
      console.error(err);
      error = 'Failed to fetch weather data. Please try again.';
    } finally {
      if (windRequest.isCurrent(request)) {
        isWindChartLoading = false;
        windRequest.finish(request);
      }
    }
  }

  async function updateSkewTData(requestParameters: WeatherRequestParameters, request: RequestHandle) {
    try {
      const result = await fetchSkewTData(
        requestParameters.location,
        requestParameters.model,
        requestParameters.startDate,
        requestParameters.maxAltitude,
        requestParameters.cellSelection,
        request.signal
      );
      if (!skewTRequest.isCurrent(request)) return;
      skewTWeatherData = result;
    } catch (err) {
      if (!skewTRequest.isCurrent(request) || isAbortError(err)) return;
      console.error(err);
    } finally {
      if (skewTRequest.isCurrent(request)) {
        isSkewTLoading = false;
        skewTRequest.finish(request);
      }
    }
  }

  onMount(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (!isWeatherCacheOutdatedMessage(event.data)) return;
      if (event.data.dataset === 'wind') {
        windOutdatedCachedAt =
          windOutdatedCachedAt === null ? event.data.cachedAt : Math.min(windOutdatedCachedAt, event.data.cachedAt);
      } else {
        skewTOutdatedCachedAt =
          skewTOutdatedCachedAt === null ? event.data.cachedAt : Math.min(skewTOutdatedCachedAt, event.data.cachedAt);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  });

  onDestroy(() => {
    clearTimeout(updateTimer ?? undefined);
    windRequest.cancel();
    skewTRequest.cancel();
  });
</script>

<svelte:head>
  <title>Meteo-Fly - Wind & Weather Forecast for Paragliding & Hang Gliding</title>
  <meta
    name="description"
    content="Professional wind & weather forecast visualization for paragliding and hang gliding. Interactive wind charts for multiple meteorological models including ICON, ECMWF, GFS, UKMO, and MeteoFrance."
  />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content="Meteo-Fly - Wind & Weather Forecast for Paragliding & Hang Gliding" />
  <meta
    property="og:description"
    content="Professional wind & weather forecast visualization for paragliding and hang gliding. Interactive wind charts for multiple meteorological models including ICON, ECMWF, GFS, UKMO, and MeteoFrance."
  />
</svelte:head>

<div class="h-screen w-full overflow-hidden bg-slate-100">
  <ResizablePaneGroup direction={$isMobile ? 'vertical' : 'horizontal'}>
    <ResizablePane defaultSize={showChart ? ($isMobile ? 15 : 50) : 100} minSize={$isMobile ? 10 : 30}>
      <div class="relative h-full w-full overflow-hidden bg-slate-200">
        <LocationMap
          latitude={parameters.location.latitude}
          longitude={parameters.location.longitude}
          bind:chartOpen={showChart}
          bind:model={parameters.selectedModel}
          bind:maxAltitude={parameters.maxAltitude}
          bind:cellSelection={parameters.cellSelection}
          bind:daylightOnly={parameters.daylightOnly}
          selectedGridCell={windChartData?.selectedGridCell ?? null}
          gridCellElevation={windChartData?.elevation}
          modelGridElevation={windChartData?.modelGridElevation}
          onToggleChart={toggleChartPanel}
          onLocationChange={updateLocation}
        />
      </div>
    </ResizablePane>

    {#if showChart && windChartData}
      <ResizableHandle withHandle />
      <ResizablePane defaultSize={50} minSize={$isMobile ? 10 : 30}>
        <div class="h-full overflow-y-auto bg-white p-0 sm:p-0">
          {#if outdatedCachedAt !== null}
            <div class="mx-3 mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
              Showing cached weather data last fetched {outdatedCachedAtLabel}. The latest forecast could not be loaded.
            </div>
          {/if}
          {#if error}
            <div class="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          {/if}
          <ChartContainer
            {windChartData}
            {skewTWeatherData}
            {startDate}
            {isWindChartLoading}
            {isSkewTLoading}
            bind:selectedDay={parameters.selectedDay}
            bind:maxAltitude={parameters.maxAltitude}
            bind:model={parameters.selectedModel}
            bind:cellSelection={parameters.cellSelection}
            bind:chartView
            bind:hour={selectedHour}
            bind:daylightOnly={parameters.daylightOnly}
            onClose={closeChartPanel}
          />
        </div>
      </ResizablePane>
    {/if}
  </ResizablePaneGroup>
</div>
