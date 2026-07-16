<script lang="ts">
  import { buildVisitedURL, saveLastVisitedURL } from '$lib/services/storage';
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
  import { onDestroy, onMount, tick } from 'svelte';
  import { createLatestRequest, isAbortError, type RequestHandle } from '$lib/services/latestRequest';
  import { isWeatherCacheOutdatedMessage } from '$lib/services/weatherCache';
  import type { PaneAPI } from 'paneforge';

  let parameters: PageParameters = $state(getInitialParameters($page.url.searchParams));
  let showChart = $state(false);
  let chartView: 'wind' | 'skewt' = $state(parameters.chartView ?? 'wind');
  let selectedHour = $state(parameters.hour ?? 0);
  let windChartData = $state.raw<WindChartData | null>(null);
  let skewTWeatherData = $state.raw<SkewTWeatherData | null>(null);
  let isWindChartLoading = $state(false);
  let isSkewTLoading = $state(false);
  let windOutdatedCachedAt: number | null = $state(null);
  let skewTOutdatedCachedAt: number | null = $state(null);

  let updateTimer: ReturnType<typeof setTimeout> | null = null;
  let panelTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  let chartPane: PaneAPI | undefined;
  let renderChartPanel = $state(false);
  let isChartPaneDragging = $state(false);
  const windRequest = createLatestRequest();
  const skewTRequest = createLatestRequest();
  const PANEL_TRANSITION_MS = 300;
  const chartPaneSizes: Record<'horizontal' | 'vertical', number> = {
    horizontal: 50,
    vertical: 77,
  };

  type WeatherRequestParameters = {
    location: Location;
    model: PageParameters['selectedModel'];
    startDate: Date;
    maxAltitude: PageParameters['maxAltitude'];
    cellSelection: PageParameters['cellSelection'];
  };

  type WeatherRequestFailure = {
    message: string;
    requestParameters: WeatherRequestParameters;
  };

  let windFailure = $state.raw<WeatherRequestFailure | null>(null);
  let skewTFailure = $state.raw<WeatherRequestFailure | null>(null);

  const paneDirection = $derived<'horizontal' | 'vertical'>($isMobile ? 'vertical' : 'horizontal');
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

  function saveCurrentURL() {
    saveLastVisitedURL(buildVisitedURL(window.location));
  }

  function syncURL() {
    const search = urlSearch;
    const currentSearch = window.location.search;
    const newURL = buildVisitedURL({
      pathname: window.location.pathname,
      search,
      hash: window.location.hash,
    });
    saveLastVisitedURL(newURL);
    if (currentSearch === search) return;
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

  function clearPanelTransitionTimer() {
    clearTimeout(panelTransitionTimer ?? undefined);
    panelTransitionTimer = null;
  }

  function finishClosingChartPanel() {
    if (showChart) return;
    renderChartPanel = false;
    clearPanelTransitionTimer();
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async function openChartPanel() {
    clearPanelTransitionTimer();
    renderChartPanel = true;
    if (showChart) return;

    await tick();
    showChart = true;
    await tick();
    chartPane?.resize(chartPaneSizes[paneDirection]);
  }

  function closeChartPanel() {
    if (chartPane?.isExpanded()) {
      chartPaneSizes[paneDirection] = chartPane.getSize();
    }
    showChart = false;
    clearTimeout(updateTimer ?? undefined);
    updateTimer = null;
    windRequest.cancel();
    skewTRequest.cancel();
    isWindChartLoading = false;
    isSkewTLoading = false;
    chartPane?.collapse();

    if (!chartPane || prefersReducedMotion()) {
      finishClosingChartPanel();
      return;
    }

    clearPanelTransitionTimer();
    panelTransitionTimer = setTimeout(finishClosingChartPanel, PANEL_TRANSITION_MS + 50);
  }

  function toggleChartPanel() {
    if (showChart) {
      closeChartPanel();
    } else {
      void openChartPanel();
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
    skewTRequest.cancel();
    windChartData = null;
    skewTWeatherData = null;
    isWindChartLoading = true;
    isSkewTLoading = false;
    windFailure = null;
    skewTFailure = null;
    windOutdatedCachedAt = null;
    skewTOutdatedCachedAt = null;
    updateTimer = setTimeout(() => {
      updateTimer = null;
      void updateWindChart(requestParameters, request);
    }, 5);
  }

  function scheduleSkewTUpdate(requestParameters: WeatherRequestParameters) {
    const request = skewTRequest.start();
    skewTWeatherData = null;
    isSkewTLoading = true;
    skewTFailure = null;
    skewTOutdatedCachedAt = null;
    void updateSkewTData(requestParameters, request);
  }

  function retryWindChart() {
    if (windFailure) {
      scheduleWindChartUpdate(windFailure.requestParameters);
    }
  }

  function retrySkewT() {
    if (skewTFailure) {
      scheduleSkewTUpdate(skewTFailure.requestParameters);
    }
  }

  function handleChartPaneResize(size: number) {
    if (showChart && size > 0) {
      chartPaneSizes[paneDirection] = size;
    }
  }

  function handleChartPaneDraggingChange(dragging: boolean) {
    isChartPaneDragging = dragging;
  }

  function handleChartPaneCollapse() {
    if (showChart) {
      closeChartPanel();
    }
  }

  function handleChartPaneExpand() {
    if (!isChartPaneDragging || showChart) return;

    clearPanelTransitionTimer();
    renderChartPanel = true;
    showChart = true;
    if (!windChartData && !isWindChartLoading) {
      scheduleWindChartUpdate(getWeatherRequestParameters());
    }
  }

  function handleChartPaneTransitionEnd(event: TransitionEvent) {
    if (event.propertyName === 'flex-grow' && !showChart) {
      finishClosingChartPanel();
    }
  }

  $effect(() => {
    scheduleWindChartUpdate(getWeatherRequestParameters());
  });

  $effect(() => {
    if (showChart && chartPane && !isChartPaneDragging) {
      chartPane.resize(chartPaneSizes[paneDirection]);
    }
  });

  $effect(() => {
    if (!showChart || chartView !== 'skewt') {
      skewTRequest.cancel();
      isSkewTLoading = false;
      return;
    }

    scheduleSkewTUpdate(getWeatherRequestParameters());
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
      await openChartPanel();
    } catch (err) {
      if (!windRequest.isCurrent(request) || isAbortError(err)) return;
      console.error(err);
      windFailure = {
        message: 'Failed to fetch wind forecast. Check your connection and try again.',
        requestParameters,
      };
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
      skewTFailure = {
        message: 'Failed to fetch sounding data. Check your connection and try again.',
        requestParameters,
      };
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
    clearPanelTransitionTimer();
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

<div class="relative h-screen w-full overflow-hidden bg-slate-100">
  {#if !showChart && isWindChartLoading && !windChartData}
    <div class="pointer-events-none absolute inset-x-3 top-3 z-50 flex justify-center" role="status">
      <div class="rounded-md bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-md ring-1 ring-slate-200">
        Loading weather data…
      </div>
    </div>
  {:else if !showChart && windFailure}
    <div class="pointer-events-none absolute inset-x-3 top-3 z-50 flex justify-center">
      <div
        class="pointer-events-auto flex max-w-lg items-center gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md ring-1 ring-red-200"
        role="alert"
      >
        <span>{windFailure.message}</span>
        <button
          type="button"
          class="shrink-0 rounded-md bg-red-700 px-3 py-1.5 font-medium text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onclick={retryWindChart}
        >
          Retry
        </button>
      </div>
    </div>
  {/if}

  <ResizablePaneGroup direction={paneDirection}>
    <ResizablePane
      defaultSize={100}
      minSize={$isMobile ? 10 : 30}
      class={isChartPaneDragging ? '' : 'transition-[flex-grow] duration-300 ease-in-out motion-reduce:transition-none'}
    >
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
          onMapViewChange={saveCurrentURL}
        />
      </div>
    </ResizablePane>

    <ResizableHandle
      withHandle
      disabled={!showChart && !isChartPaneDragging}
      tabindex={showChart ? 0 : -1}
      onDraggingChange={handleChartPaneDraggingChange}
      class="transition-opacity duration-200 motion-reduce:transition-none {showChart
        ? 'opacity-100'
        : 'pointer-events-none opacity-0'}"
    />
    <ResizablePane
      bind:this={chartPane}
      defaultSize={0}
      minSize={$isMobile ? 10 : 30}
      collapsedSize={0}
      collapsible
      onCollapse={handleChartPaneCollapse}
      onExpand={handleChartPaneExpand}
      onResize={handleChartPaneResize}
      ontransitionend={handleChartPaneTransitionEnd}
      class={isChartPaneDragging ? '' : 'transition-[flex-grow] duration-300 ease-in-out motion-reduce:transition-none'}
    >
      {#if renderChartPanel}
        <div
          class="h-full overflow-y-auto bg-white p-0 transition-opacity duration-200 motion-reduce:transition-none sm:p-0 {showChart
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'}"
          aria-hidden={!showChart}
          inert={!showChart}
        >
          {#if windChartData}
            {#if outdatedCachedAt !== null}
              <div class="mx-3 mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
                Showing cached weather data last fetched {outdatedCachedAtLabel}. The latest forecast could not be
                loaded.
              </div>
            {/if}
            <ChartContainer
              {windChartData}
              {skewTWeatherData}
              {startDate}
              {isWindChartLoading}
              {isSkewTLoading}
              skewTError={skewTFailure?.message ?? null}
              onRetrySkewT={retrySkewT}
              bind:selectedDay={parameters.selectedDay}
              bind:maxAltitude={parameters.maxAltitude}
              bind:model={parameters.selectedModel}
              bind:cellSelection={parameters.cellSelection}
              bind:chartView
              bind:hour={selectedHour}
              bind:daylightOnly={parameters.daylightOnly}
              onClose={closeChartPanel}
            />
          {:else if isWindChartLoading}
            <div class="relative flex h-full min-h-64 items-center justify-center">
              <button
                type="button"
                class="absolute top-3 right-3 rounded-md px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                onclick={closeChartPanel}
              >
                Close
              </button>
              <div class="text-sm text-slate-500" role="status">Loading weather data…</div>
            </div>
          {:else if windFailure}
            <div class="relative flex h-full min-h-64 items-center justify-center px-4">
              <button
                type="button"
                class="absolute top-3 right-3 rounded-md px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                onclick={closeChartPanel}
              >
                Close
              </button>
              <div
                class="flex max-w-md flex-col items-center gap-3 rounded-md bg-red-50 px-4 py-3 text-center text-sm text-red-700 ring-1 ring-red-200"
                role="alert"
              >
                <span>{windFailure.message}</span>
                <button
                  type="button"
                  class="rounded-md bg-red-700 px-3 py-1.5 font-medium text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  onclick={retryWindChart}
                >
                  Retry
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </ResizablePane>
  </ResizablePaneGroup>
</div>
