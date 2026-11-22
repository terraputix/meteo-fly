<script lang="ts">
  import { buildVisitedURL, saveLastVisitedURL } from '#lib/services/storage.js';
  import { browser } from '$app/env';
  import { page } from '$app/state';
  import { afterNavigate, goto } from '$app/navigation';
  import { isMobile } from '#lib/stores/media.js';
  import WindComparisonGrid from '#lib/components/WindComparisonGrid.svelte';
  import ForecastTimeSelector from '#lib/components/ForecastTimeSelector.svelte';
  import {
    resolveTimestepHour,
    stepTimestep,
    type TimestepDirection,
    type TimestepMode,
  } from '#lib/components/timestepNavigation.js';
  import ForecastError from '#lib/components/ForecastError.svelte';
  import { MODEL_FORECAST_DAYS, type CompassModel } from '#lib/api/models.js';
  import LocationMap from '#lib/components/LocationMap.svelte';
  import ChartContainer from '#lib/components/ChartContainer.svelte';
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '#lib/components/ui/resizable/index.js';
  import { getInitialParameters } from '#lib/services/defaults.js';
  import { type PageParameters, type ChartView } from '#lib/services/types.js';
  import { FORECAST_API_MAX_DAYS, forecastDayStart, lastCompleteForecastDay } from '#lib/api/api.js';
  import type { Location } from '#lib/api/types.js';
  import { resolveLocationTimezone } from '#lib/api/timezone.js';
  import {
    createSkewTForecast,
    createWindComparison,
    createWindForecast,
    type ForecastDayRequest,
    type ModelForecastRequest,
  } from '#lib/services/forecastRequests.svelte.js';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { onDestroy, onMount, tick } from 'svelte';
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
  let pendingLastHourDay = $state<number | null>(null);
  let inspectedModels = $state<CompassModel[]>([]);
  let highlighted = $state<CompassModel | null>(null);
  const locationKey = $derived(`${parameters.location.latitude},${parameters.location.longitude}`);
  let timezoneResult = $state.raw<{ key: string; timezone: string | null }>();
  let timezoneRetry = $state(0);
  const locationTimezone = $derived(timezoneResult?.key === locationKey ? timezoneResult.timezone : undefined);
  const timezoneError = $derived(
    locationTimezone === null ? 'Could not determine the forecast location’s time zone.' : null
  );
  const referenceDate = $derived.by(() => {
    void locationKey;
    void parameters.selectedDay;
    return new Date();
  });

  $effect(() => {
    const key = locationKey;
    void timezoneRetry;
    const controller = new AbortController();
    void resolveLocationTimezone({ ...parameters.location }, controller.signal)
      .then((timezone) => {
        if (!controller.signal.aborted) timezoneResult = { key, timezone };
      })
      .catch(() => {
        if (!controller.signal.aborted) timezoneResult = { key, timezone: null };
      });
    return () => controller.abort();
  });

  function resolveLoadedHour(day: number, times: Date[]) {
    if (!times.length) return;
    const useLastHour = pendingLastHourDay === day;
    selectedHour = resolveTimestepHour(useLastHour ? 'last' : selectedHour, times.length);
    if (useLastHour) pendingLastHourDay = null;
  }

  function selectHour(hour: number) {
    pendingLastHourDay = null;
    selectedHour = hour;
  }

  function getForecastStep(mode: TimestepMode, direction: TimestepDirection) {
    if (!startDate) return null;
    return stepTimestep({
      mode,
      direction,
      selectedDay: parameters.selectedDay,
      hour: selectedHour,
      traceCount: timeline.length,
      maxForecastDays,
    });
  }

  function stepForecastTime(mode: TimestepMode, direction: TimestepDirection) {
    const next = getForecastStep(mode, direction);
    if (!next) return;
    pendingLastHourDay = next.hour === 'last' ? next.selectedDay : null;
    if (next.hour !== 'last') selectedHour = next.hour;
    parameters.selectedDay = next.selectedDay;
  }

  let panelTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  let chartPane: PaneAPI | undefined;
  let renderChartPanel = $state(true);
  let chartPanelReady = $state(false);
  let chartContainer = $state<ChartContainer>();
  let mapTimeSelector = $state<HTMLDivElement>();
  let pageElement: HTMLDivElement;
  let isChartPaneDragging = $state(false);
  let viewportHeight = $state(0);
  let chartContentHeight = $state(0);
  let cacheNoticeHeight = $state(0);
  let fitMobileChart = $state(true);
  const PANEL_TRANSITION_MS = 300;
  const chartPaneSizes: Record<'horizontal' | 'vertical', number> = {
    horizontal: 50,
    vertical: 77,
  };

  const paneDirection = $derived<'horizontal' | 'vertical'>($isMobile ? 'vertical' : 'horizontal');
  const startDate = $derived(
    locationTimezone ? forecastDayStart(referenceDate, locationTimezone, parameters.selectedDay) : undefined
  );
  const maxForecastDays = $derived.by(() => {
    const modelDays = comparing ? FORECAST_API_MAX_DAYS : MODEL_FORECAST_DAYS[parameters.selectedModel];
    return locationTimezone ? lastCompleteForecastDay(referenceDate, locationTimezone, modelDays) : modelDays;
  });
  const dayRequest: ForecastDayRequest | null = $derived(
    locationTimezone && parameters.selectedDay <= maxForecastDays
      ? {
          location: { ...parameters.location },
          timezone: locationTimezone,
          referenceDate,
          dayOffset: parameters.selectedDay - 1,
          cellSelection: parameters.cellSelection,
        }
      : null
  );
  const modelRequest: ModelForecastRequest | null = $derived(
    dayRequest && !comparing
      ? { ...dayRequest, model: parameters.selectedModel, maxAltitude: parameters.maxAltitude }
      : null
  );

  const wind = createWindForecast(() => modelRequest);
  const skewT = createSkewTForecast(
    () => (showChart && chartView === 'skewt' ? modelRequest : null),
    resolveLoadedHour
  );
  const windComparison = createWindComparison(() => (comparing ? dayRequest : null), resolveLoadedHour);
  const windChartData = $derived(wind.data);
  const skewTWeatherData = $derived(skewT.data);
  const comparison = $derived(windComparison.data);
  const isWindChartLoading = $derived(!comparing && (locationTimezone === undefined || wind.loading));
  const isSkewTLoading = $derived(
    showChart && chartView === 'skewt' && (locationTimezone === undefined || skewT.loading)
  );
  const timeline = $derived(
    comparing
      ? (comparison?.time ?? [])
      : chartView === 'skewt' && !isSkewTLoading
        ? (skewTWeatherData?.hourly.time ?? [])
        : []
  );
  const windError = $derived(timezoneError ?? wind.error);
  const skewTError = $derived(timezoneError ?? skewT.error);
  const comparisonError = $derived(timezoneError ?? windComparison.error);
  const retryWindChart = $derived(timezoneError ? retryTimezone : wind.retry);
  const retrySkewT = $derived(timezoneError ? retryTimezone : skewT.retry);
  const retryComparison = $derived(timezoneError ? retryTimezone : windComparison.retry);
  const mapForecastStatus = $derived(
    showChart
      ? null
      : comparing
        ? {
            loading: locationTimezone === undefined || windComparison.loading,
            errorMessage: comparisonError,
            retry: retryComparison,
          }
        : {
            loading: isWindChartLoading && !windChartData,
            errorMessage: windError,
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
    chartView === 'comparison' ? windComparison.cachedAt : chartView === 'wind' ? wind.cachedAt : skewT.cachedAt
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
      if (!comparing && wind.error) wind.retry();
    }
  }

  function updateLocation(location: Location) {
    parameters.location = location;

    if (!showChart && comparing && document.activeElement?.closest('.maplibregl-map')) {
      mapTimeSelector?.focus({ preventScroll: true });
    }
  }

  function retryTimezone() {
    timezoneResult = undefined;
    timezoneRetry++;
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
    if (!comparing && wind.error) wind.retry();
  }

  function handleChartPaneTransitionEnd(event: TransitionEvent) {
    if (event.propertyName === 'flex-grow' && !showChart) {
      finishClosingChartPanel();
    }
  }

  $effect(() => {
    if (parameters.selectedDay > maxForecastDays) {
      pendingLastHourDay = null;
      parameters.selectedDay = maxForecastDays;
    }
  });

  $effect(() => {
    if (showChart && chartPanelReady && chartPane && !isChartPaneDragging) {
      resizeChartPanel();
    }
  });

  onMount(() => {
    viewportHeight = pageElement.clientHeight;
    chartContentHeight = chartContainer?.measureContentHeight() ?? 0;
    resizeChartPanel();
    chartPanelReady = true;

    if (!('serviceWorker' in navigator)) return;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const message: unknown = event.data;
      if (!isWeatherCacheOutdatedMessage(message)) return;
      const forecast = message.dataset === 'wind' ? wind : message.dataset === 'comparison' ? windComparison : skewT;
      forecast.markCached(message.cachedAt);
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  });

  onDestroy(clearPanelTransitionTimer);
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

{#snippet timeSelector()}
  <ForecastTimeSelector
    date={startDate}
    hour={selectedHour}
    times={timeline}
    timezone={locationTimezone ?? undefined}
    showHours={chartView !== 'wind'}
    canStep={(mode, direction) => getForecastStep(mode, direction) !== null}
    onStep={stepForecastTime}
    onHourChange={selectHour}
  />
{/snippet}

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
              {skewTError}
              onRetrySkewT={retrySkewT}
              bind:maxAltitude={parameters.maxAltitude}
              bind:model={parameters.selectedModel}
              bind:chartView
              selectedTime={timeline[selectedHour]}
              bind:daylightOnly={parameters.daylightOnly}
              onClose={closeChartPanel}
            >
              {#snippet timestepControls()}
                {#if showChart}
                  {@render timeSelector()}
                {/if}
              {/snippet}
              {#snippet comparisonGrid()}
                <WindComparisonGrid
                  bind:highlighted
                  {inspectedModels}
                  day={comparison}
                  error={comparisonError}
                  retry={retryComparison}
                  bind:hour={() => selectedHour, selectHour}
                />
              {/snippet}
            </ChartContainer>
            {#if windError && chartView === 'wind'}
              <div class="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
                <ForecastError message={windError} retry={retryWindChart} class="max-w-md flex-col text-center" />
              </div>
            {/if}
          </div>
        {/if}
      </ResizablePane>
    </ResizablePaneGroup>
  </div>
  {#if !showChart && comparing}
    <div
      bind:this={mapTimeSelector}
      tabindex="-1"
      class="shrink-0 border-t border-slate-200 bg-white px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      {#if windComparison.cachedAt !== null}
        <p class="mb-1 text-center text-xs text-amber-800">
          Showing cached wind forecast from {new Date(windComparison.cachedAt).toLocaleString()}.
        </p>
      {/if}
      {@render timeSelector()}
    </div>
  {/if}
</div>
