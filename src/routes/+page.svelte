<script lang="ts">
  import { buildVisitedURL, saveLastVisitedURL } from '#lib/services/storage.js';
  import { browser } from '$app/env';
  import { page } from '$app/state';
  import { afterNavigate, goto } from '$app/navigation';
  import { isMobile } from '#lib/stores/media.js';
  import WindComparisonGrid from '#lib/components/WindComparisonGrid.svelte';
  import BottomControls from '#lib/components/BottomControls.svelte';
  import ForecastError from '#lib/components/ForecastError.svelte';
  import { MODEL_FORECAST_DAYS, type CompassModel } from '#lib/api/models.js';
  import LocationMap from '#lib/components/LocationMap.svelte';
  import ChartContainer from '#lib/components/ChartContainer.svelte';
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '#lib/components/ui/resizable/index.js';
  import { getInitialParameters } from '#lib/services/defaults.js';
  import { type PageParameters, type ChartView } from '#lib/services/types.js';
  import {
    fetchSurfaceWindDay,
    type SurfaceWindDay,
    fetchWindChartData,
    fetchModelGridElevation,
    fetchSkewTData,
  } from '#lib/api/api.js';
  import type { Location, WindChartData, SkewTWeatherData } from '#lib/api/types.js';
  import { addDays } from '#lib/utils/dateExtensions.js';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { onDestroy, onMount, tick } from 'svelte';
  import { createLatestRequest, isAbortError, type RequestHandle } from '#lib/services/latestRequest.js';
  import { isWeatherCacheOutdatedMessage } from '#lib/services/weatherCache.js';
  import type { PaneAPI } from 'paneforge';

  let parameters: PageParameters = $state(
    getInitialParameters(browser ? page.url.searchParams : new URLSearchParams())
  );
  let showChart = $state(true);
  let routerReady = $state(false);
  let chartView: ChartView = $state(parameters.chartView ?? 'comparison');
  const comparing = $derived(chartView === 'comparison');
  let selectedHour = $state(parameters.hour ?? 0);
  let windChartData = $state.raw<WindChartData | null>(null);
  let skewTWeatherData = $state.raw<SkewTWeatherData | null>(null);
  let isWindChartLoading = $state(true);
  let isSkewTLoading = $state(false);
  let windOutdatedCachedAt: number | null = $state(null);
  let skewTOutdatedCachedAt: number | null = $state(null);

  let comparison = $state.raw<SurfaceWindDay | null>(null);
  let inspectedModels = $state<CompassModel[]>([]);
  let highlighted = $state<CompassModel | null>(null);
  let comparisonFailed = $state(false);
  let comparisonRetry = $state(0);
  let comparisonCachedAt = $state<number | null>(null);
  $effect(() => {
    void comparisonRetry;
    comparison = null;
    comparisonFailed = false;
    comparisonCachedAt = null;
    if (!comparing) return;
    const controller = new AbortController();
    void fetchSurfaceWindDay(
      { ...parameters.location },
      parameters.selectedDay - 1,
      parameters.cellSelection,
      controller.signal
    )
      .then((day) => {
        if (!controller.signal.aborted) comparison = day;
      })
      .catch(() => {
        if (!controller.signal.aborted) comparisonFailed = true;
      });
    return () => controller.abort();
  });
  const timeline = $derived(
    comparing
      ? (comparison?.time ?? [])
      : chartView === 'skewt' && !isSkewTLoading
        ? (skewTWeatherData?.hourly.time ?? [])
        : []
  );
  $effect(() => {
    if (timeline.length && selectedHour >= timeline.length) selectedHour = timeline.length - 1;
  });

  let updateTimer: ReturnType<typeof setTimeout> | null = null;
  let panelTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  let chartPane: PaneAPI | undefined;
  let renderChartPanel = $state(true);
  let chartPanelReady = $state(false);
  let chartContainer = $state<ChartContainer>();
  let pageElement: HTMLDivElement;
  let isChartPaneDragging = $state(false);
  let viewportHeight = $state(0);
  let chartContentHeight = $state(0);
  let cacheNoticeHeight = $state(0);
  let fitMobileChart = $state(true);
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
    referenceDate: Date;
    dayOffset: number;
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
  const startDate = $derived(
    addDays(new Date(), parameters.selectedDay - 1, comparison?.timezone ?? windChartData?.timezone)
  );
  const maxForecastDays = $derived(
    comparing ? MODEL_FORECAST_DAYS.gfs_seamless : MODEL_FORECAST_DAYS[parameters.selectedModel]
  );
  const mapForecastStatus = $derived(
    showChart
      ? null
      : comparing
        ? {
            loading: !comparison && !comparisonFailed,
            errorMessage: comparisonFailed ? 'Wind comparison could not load.' : null,
            retry: () => comparisonRetry++,
          }
        : {
            loading: isWindChartLoading && !windChartData,
            errorMessage: windFailure?.message ?? null,
            retry: retryWindChart,
          }
  );

  const mapControlsTopOffset = $derived(
    $isMobile
      ? mapForecastStatus?.errorMessage
        ? '7.5rem'
        : mapForecastStatus?.loading
          ? '3.75rem'
          : '0.75rem'
      : '0.75rem'
  );

  const outdatedCachedAt = $derived(
    chartView === 'comparison'
      ? comparisonCachedAt
      : chartView === 'wind'
        ? windOutdatedCachedAt
        : skewTOutdatedCachedAt
  );
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
    params.set('daylight', daylightOnly ? '1' : '0');
    return `?${params.toString()}`;
  });

  function saveCurrentURL() {
    saveLastVisitedURL(buildVisitedURL(window.location));
  }

  async function syncURL() {
    const search = urlSearch;
    const currentSearch = window.location.search;
    const newURL = buildVisitedURL({
      pathname: window.location.pathname,
      search,
      hash: window.location.hash,
    });
    saveLastVisitedURL(newURL);
    if (currentSearch === search) return;
    try {
      await goto(newURL, { shallow: true, replace: true, state: page.state });
    } catch (error) {
      console.error('Failed to synchronize forecast URL', error);
    }
  }

  afterNavigate(() => {
    routerReady = true;
    void syncURL();
  });

  $effect(() => {
    if (routerReady) void syncURL();
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
    fitMobileChart = true;
    chartPanelReady = false;

    await tick();
    chartContentHeight = chartContainer?.measureContentHeight() ?? 0;
    resizeChartPanel();
    await tick();
    showChart = true;
    chartPanelReady = true;
  }

  function resizeChartPanel() {
    let size = chartPaneSizes[paneDirection];
    if ($isMobile && fitMobileChart && chartContentHeight > 0 && viewportHeight > 0) {
      const noticeHeight = outdatedCachedAt !== null ? cacheNoticeHeight : 0;
      size = Math.min(size, ((chartContentHeight + noticeHeight + 1) / viewportHeight) * 100);
    }
    chartPane?.resize(size);
  }

  function closeChartPanel() {
    if (chartPane?.isExpanded() && !($isMobile && fitMobileChart)) {
      chartPaneSizes[paneDirection] = chartPane.getSize();
    }
    showChart = false;
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
      if (!comparing && !windChartData && !isWindChartLoading) {
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
      referenceDate: new Date(),
      dayOffset: parameters.selectedDay - 1,
      maxAltitude: parameters.maxAltitude,
      cellSelection: parameters.cellSelection,
    };
  }

  function scheduleWindChartUpdate(requestParameters: WeatherRequestParameters) {
    clearTimeout(updateTimer ?? undefined);
    const request = windRequest.start();
    skewTRequest.cancel();
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
    if (showChart && size > 0 && isChartPaneDragging) {
      chartPaneSizes[paneDirection] = size;
    }
  }

  function handleChartPaneDraggingChange(dragging: boolean) {
    if (dragging) fitMobileChart = false;
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
    if (!comparing && !windChartData && !isWindChartLoading) {
      scheduleWindChartUpdate(getWeatherRequestParameters());
    }
  }

  function handleChartPaneTransitionEnd(event: TransitionEvent) {
    if (event.propertyName === 'flex-grow' && !showChart) {
      finishClosingChartPanel();
    }
  }

  $effect(() => {
    const maxDay = maxForecastDays;
    if (parameters.selectedDay > maxDay) {
      parameters.selectedDay = maxDay;
      return;
    }
    if (comparing) {
      windRequest.cancel();
      clearTimeout(updateTimer ?? undefined);
      windChartData = null;
      isWindChartLoading = false;
      windFailure = null;
      return;
    }
    scheduleWindChartUpdate(getWeatherRequestParameters());
  });

  $effect(() => {
    if (showChart && chartPanelReady && chartPane && !isChartPaneDragging) {
      resizeChartPanel();
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
        requestParameters.referenceDate,
        1,
        requestParameters.maxAltitude,
        requestParameters.cellSelection,
        request.signal,
        requestParameters.dayOffset
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
    } catch (err) {
      if (!windRequest.isCurrent(request) || isAbortError(err)) return;
      console.error(err);
      windChartData = null;
      skewTWeatherData = null;
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
        requestParameters.referenceDate,
        requestParameters.maxAltitude,
        requestParameters.cellSelection,
        request.signal,
        requestParameters.dayOffset
      );
      if (!skewTRequest.isCurrent(request)) return;
      skewTWeatherData = result;
    } catch (err) {
      if (!skewTRequest.isCurrent(request) || isAbortError(err)) return;
      console.error(err);
      skewTWeatherData = null;
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
    viewportHeight = pageElement.clientHeight;
    chartContentHeight = chartContainer?.measureContentHeight() ?? 0;
    resizeChartPanel();
    chartPanelReady = true;

    if (!('serviceWorker' in navigator)) return;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (!isWeatherCacheOutdatedMessage(event.data)) return;
      if (event.data.dataset === 'wind') {
        windOutdatedCachedAt =
          windOutdatedCachedAt === null ? event.data.cachedAt : Math.min(windOutdatedCachedAt, event.data.cachedAt);
      } else if (event.data.dataset === 'comparison') {
        comparisonCachedAt = event.data.cachedAt;
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
  <link rel="canonical" href="https://meteo-fly.com/" />
  <meta
    name="description"
    content="Professional wind & weather forecast visualization for paragliding and hang gliding. Interactive wind charts for multiple meteorological models including ICON, ECMWF, GFS, UKMO, and MeteoFrance."
  />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content="Meteo-Fly - Wind & Weather Forecast for Paragliding & Hang Gliding" />
  <meta property="og:url" content="https://meteo-fly.com/" />
  <meta
    property="og:description"
    content="Professional wind & weather forecast visualization for paragliding and hang gliding. Interactive wind charts for multiple meteorological models including ICON, ECMWF, GFS, UKMO, and MeteoFrance."
  />

  <meta name="twitter:title" content="Meteo-Fly - Wind & Weather Forecast for Paragliding & Hang Gliding" />

  <meta
    name="twitter:description"
    content="Interactive multi-model wind and weather forecasts for paragliding and hang gliding."
  />
</svelte:head>

<div
  class="relative flex flex-col h-dvh w-full overflow-hidden bg-slate-100"
  style="--map-controls-top-offset: {mapControlsTopOffset};"
>
  {#if mapForecastStatus?.loading}
    <div
      class="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 flex justify-center"
      role="status"
    >
      <div class="rounded-md bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-md ring-1 ring-slate-200">
        Loading weather data…
      </div>
    </div>
  {:else if mapForecastStatus?.errorMessage}
    <div
      class="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 flex justify-center"
    >
      <ForecastError
        message={mapForecastStatus.errorMessage}
        retry={mapForecastStatus.retry}
        class="max-w-lg shadow-md"
      />
    </div>
  {/if}

  <div bind:this={pageElement} bind:clientHeight={viewportHeight} class="relative min-h-0 flex-1">
    <ResizablePaneGroup direction={paneDirection}>
      <ResizablePane
        defaultSize={50}
        minSize={$isMobile ? 10 : 30}
        class={isChartPaneDragging
          ? ''
          : 'transition-[flex-grow] duration-300 ease-in-out motion-reduce:transition-none'}
      >
        <div class="relative h-full w-full overflow-hidden bg-slate-200">
          <LocationMap
            {comparison}
            {comparing}
            {highlighted}
            onInspectModels={(models) => (inspectedModels = models)}
            selectedTime={timeline[selectedHour]}
            latitude={parameters.location.latitude}
            longitude={parameters.location.longitude}
            bind:chartOpen={showChart}
            bind:model={parameters.selectedModel}
            bind:cellSelection={parameters.cellSelection}
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
        defaultSize={50}
        minSize={$isMobile ? 10 : 30}
        collapsedSize={0}
        collapsible
        onCollapse={handleChartPaneCollapse}
        onExpand={handleChartPaneExpand}
        onResize={handleChartPaneResize}
        ontransitionend={handleChartPaneTransitionEnd}
        class={isChartPaneDragging
          ? ''
          : 'transition-[flex-grow] duration-300 ease-in-out motion-reduce:transition-none'}
      >
        {#if renderChartPanel}
          <div
            class="relative flex h-full min-h-0 flex-col overflow-hidden bg-white p-0 transition-opacity duration-200 motion-reduce:transition-none sm:p-0 {showChart &&
            chartPanelReady
              ? 'opacity-100'
              : 'pointer-events-none opacity-0'}"
            aria-hidden={!showChart}
            inert={!showChart}
          >
            {#if outdatedCachedAt !== null}
              <div bind:offsetHeight={cacheNoticeHeight} class="shrink-0 px-3 pt-3">
                <div class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
                  Showing cached weather data last fetched {outdatedCachedAtLabel}. The latest forecast could not be
                  loaded.
                </div>
              </div>
            {/if}
            <ChartContainer
              bind:this={chartContainer}
              onContentHeightChange={(height) => (chartContentHeight = height)}
              {windChartData}
              {skewTWeatherData}
              {isWindChartLoading}
              {isSkewTLoading}
              skewTError={skewTFailure?.message ?? null}
              onRetrySkewT={retrySkewT}
              bind:maxAltitude={parameters.maxAltitude}
              bind:model={parameters.selectedModel}
              bind:chartView
              selectedTime={timeline[selectedHour]}
              bind:daylightOnly={parameters.daylightOnly}
              onClose={closeChartPanel}
            >
              {#snippet timestepControls()}
                <BottomControls
                  bind:selectedDay={parameters.selectedDay}
                  {startDate}
                  bind:hour={selectedHour}
                  traceHours={timeline}
                  timezone={comparing
                    ? comparison?.timezone
                    : chartView === 'skewt'
                      ? skewTWeatherData?.timezone
                      : windChartData?.timezone}
                  {maxForecastDays}
                  keyboardNavigationEnabled={showChart}
                  dayNavigationOnly={chartView === 'wind'}
                />
              {/snippet}
              {#snippet comparisonGrid()}
                <WindComparisonGrid
                  bind:highlighted
                  {inspectedModels}
                  day={comparison}
                  failed={comparisonFailed}
                  retry={() => comparisonRetry++}
                  bind:hour={selectedHour}
                />
              {/snippet}
            </ChartContainer>
            {#if windFailure && chartView !== 'comparison'}
              <div class="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
                <ForecastError
                  message={windFailure.message}
                  retry={retryWindChart}
                  class="max-w-md flex-col text-center"
                />
              </div>
            {/if}
          </div>
        {/if}
      </ResizablePane>
    </ResizablePaneGroup>
  </div>
  {#if !showChart && comparing && comparisonCachedAt !== null}
    <p class="text-center text-xs text-amber-800">
      Showing cached wind forecast from {new Date(comparisonCachedAt).toLocaleString()}.
    </p>
  {/if}
</div>
