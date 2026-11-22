<script lang="ts">
  import {
    buildVisitedURL,
    getInitialChartPaneSize,
    saveChartPaneSize,
    saveLastVisitedURL,
    type ChartPaneDirection,
  } from '#lib/services/storage.js';
  import { browser } from '$app/env';
  import { page } from '$app/state';
  import { afterNavigate, goto } from '$app/navigation';
  import { isMobile, matchesMobileViewport } from '#lib/stores/media.js';
  import WindComparisonGrid from '#lib/components/WindComparisonGrid.svelte';
  import ForecastTimeSelector from '#lib/components/ForecastTimeSelector.svelte';
  import {
    resolveTimestepHour,
    stepTimestep,
    type TimestepDirection,
    type TimestepMode,
  } from '#lib/components/timestepNavigation.js';
  import ForecastError from '#lib/components/ForecastError.svelte';
  import type { CompassModel } from '#lib/api/models.js';
  import LocationMap from '#lib/components/LocationMap.svelte';
  import ChartContainer from '#lib/components/ChartContainer.svelte';
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '#lib/components/ui/resizable/index.js';
  import { getInitialParameters } from '#lib/services/defaults.js';
  import { type PageParameters, type ChartView } from '#lib/services/types.js';
  import type { Location } from '#lib/api/types.js';
  import { createForecastRequest } from '#lib/services/forecastRequests.svelte.js';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import type { PaneAPI } from 'paneforge';

  let parameters: PageParameters = $state(
    getInitialParameters(browser ? page.url.searchParams : new URLSearchParams())
  );
  let showChart = $state(true);
  let routerReady = $state(false);
  let chartView: ChartView = $state(parameters.chartView ?? 'wind');
  const comparing = $derived(chartView === 'comparison');
  let selectedHour = $state(parameters.hour ?? 0);
  let pendingLastHourDay = $state<number | null>(null);
  let inspectedModels = $state<CompassModel[]>([]);
  let highlighted = $state<CompassModel | null>(null);

  const forecast = createForecastRequest(() => {
    const selection = {
      location: { ...parameters.location },
      selectedDay: parameters.selectedDay,
      cellSelection: parameters.cellSelection,
    };
    return chartView === 'comparison'
      ? { ...selection, view: chartView }
      : { ...selection, view: chartView, selectedModel: parameters.selectedModel, maxAltitude: parameters.maxAltitude };
  }, resolveLoadedHour);
  const comparison = $derived(forecast.data?.view === 'comparison' ? forecast.data.weather : null);
  const gridWeather = $derived(forecast.data?.view === 'comparison' ? null : forecast.data?.weather);
  const timeline = $derived(
    comparison?.time ?? (forecast.data?.view === 'skewt' ? forecast.data.weather.hourly.time : [])
  );

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
    if (!forecast.date) return null;
    return stepTimestep({
      mode,
      direction,
      selectedDay: parameters.selectedDay,
      hour: selectedHour,
      traceCount: timeline.length,
      maxForecastDays: forecast.maxDays,
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
  let hasClosedChartPanel = $state(false);
  let chartContainer = $state<ChartContainer>();
  let mapTimeSelector = $state<HTMLDivElement>();
  let pageElement: HTMLDivElement;
  let isChartPaneDragging = $state(false);
  let viewportHeight = $state(0);
  let chartContentHeight = $state(0);
  let cacheNoticeHeight = $state(0);
  let preferredPaneSizes = $state<Partial<Record<ChartPaneDirection, number>>>({});
  let paneDrag: { direction: ChartPaneDirection; startSize?: number } | undefined;
  let dragClosedPane: { direction: ChartPaneDirection; size: number } | undefined;
  const PANEL_TRANSITION_MS = 300;
  const mobilePaneMinSize = 10;
  const defaultPaneSizes: Record<ChartPaneDirection, number> = {
    horizontal: 50,
    vertical: 77,
  };

  const paneDirection = $derived<ChartPaneDirection>($isMobile ? 'vertical' : 'horizontal');
  const preferredPaneSize = $derived(preferredPaneSizes[paneDirection]);
  const paneDefaultSize = $derived.by(() => {
    const direction = paneDirection;
    // Paneforge resets the live layout when its defaults change.
    return untrack(() => preferredPaneSizes[direction] ?? 50);
  });
  const initialChartLayout = $derived(showChart && !chartPanelReady);
  const paneResizeTransition = $derived(
    hasClosedChartPanel &&
      !isChartPaneDragging &&
      'transition-[flex-grow] duration-300 ease-in-out motion-reduce:transition-none'
  );
  const showMapLoading = $derived(!showChart && forecast.loading);
  const mapError = $derived(showChart ? null : forecast.error);
  const mapControlsTopOffset = $derived(
    $isMobile && mapError ? '7.5rem' : $isMobile && showMapLoading ? '3.75rem' : '0.75rem'
  );

  const outdatedCachedAtLabel = $derived(
    forecast.cachedAt === null
      ? ''
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(forecast.cachedAt))
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
    chartPanelReady = false;

    await tick();
    chartContentHeight = chartContainer?.measureContentHeight() ?? 0;
    if (dragClosedPane?.direction === paneDirection) {
      chartPane?.resize(dragClosedPane.size);
    } else {
      resizeChartPanel();
    }
    dragClosedPane = undefined;
    await tick();
    showChart = true;
    chartPanelReady = true;
  }

  function resizeChartPanel() {
    let size = preferredPaneSize ?? defaultPaneSizes[paneDirection];
    if ($isMobile && preferredPaneSize === undefined && !comparing && chartContentHeight > 0 && viewportHeight > 0) {
      const noticeHeight = forecast.cachedAt !== null ? cacheNoticeHeight : 0;
      size = Math.min(size, ((chartContentHeight + noticeHeight + 1) / viewportHeight) * 100);
    }
    chartPane?.resize(size);
  }

  function closeChartPanel() {
    hasClosedChartPanel = true;
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
      if (chartView === 'wind' && forecast.error) forecast.retry();
    }
  }

  function updateLocation(location: Location) {
    parameters.location = location;

    if (!showChart && comparing && document.activeElement?.closest('.maplibregl-map')) {
      mapTimeSelector?.focus({ preventScroll: true });
    }
  }

  function getViewportPaneDirection(): ChartPaneDirection {
    return matchesMobileViewport() ? 'vertical' : 'horizontal';
  }

  function rememberPaneSize(direction: ChartPaneDirection, size: number) {
    preferredPaneSizes[direction] = size;
    saveChartPaneSize(direction, size);
  }

  function handleChartPaneDraggingChange(dragging: boolean) {
    const wasDragging = isChartPaneDragging;
    isChartPaneDragging = dragging;
    if (dragging) {
      paneDrag = { direction: paneDirection, startSize: chartPane?.getSize() };
    } else if (wasDragging) {
      const drag = paneDrag;
      paneDrag = undefined;
      if (drag?.direction === getViewportPaneDirection()) {
        const size = chartPane?.getSize();
        if (showChart && size && size !== drag.startSize) {
          rememberPaneSize(drag.direction, size);
        } else if (!showChart && drag.startSize) {
          dragClosedPane = { direction: drag.direction, size: drag.startSize };
        }
      } else if (showChart) {
        resizeChartPanel();
      }
    }
  }

  function handleChartPaneKeydown(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;

    const direction = paneDirection;
    const previousSize = chartPane?.getSize();
    queueMicrotask(() => {
      const size = chartPane?.getSize();
      if (size && size !== previousSize && paneDirection === direction) rememberPaneSize(direction, size);
    });
  }

  function handleChartPaneCollapse() {
    if (showChart && (!isChartPaneDragging || paneDrag?.direction === getViewportPaneDirection())) {
      closeChartPanel();
    }
  }

  function handleChartPaneExpand() {
    if (paneDrag?.direction !== getViewportPaneDirection() || showChart) return;

    clearPanelTransitionTimer();
    renderChartPanel = true;
    showChart = true;
    if (chartView === 'wind' && forecast.error) forecast.retry();
  }

  function handleChartPaneTransitionEnd(event: TransitionEvent) {
    if (event.propertyName === 'flex-grow' && !showChart) {
      finishClosingChartPanel();
    }
  }

  $effect(() => {
    if (parameters.selectedDay > forecast.maxDays) {
      pendingLastHourDay = null;
      parameters.selectedDay = forecast.maxDays;
    }
  });

  $effect.pre(() => {
    if (paneDirection !== paneDrag?.direction) paneDrag = undefined;
  });

  $effect(() => {
    if (!chartPanelReady || !chartPane) return;

    if (!showChart) {
      const canDragOpen = isChartPaneDragging && paneDrag?.direction === paneDirection;
      if (!canDragOpen && chartPane.isExpanded()) chartPane.collapse();
    } else if (!isChartPaneDragging && !($isMobile && comparing)) {
      resizeChartPanel();
    }
  });

  onMount(() => {
    preferredPaneSizes = {
      horizontal: getInitialChartPaneSize('horizontal'),
      vertical: getInitialChartPaneSize('vertical'),
    };
    viewportHeight = pageElement.clientHeight;
    chartContentHeight = chartContainer?.measureContentHeight() ?? 0;
    resizeChartPanel();
    chartPanelReady = true;
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
    date={forecast.date}
    hour={selectedHour}
    times={timeline}
    timezone={forecast.timezone}
    showHours={chartView !== 'wind'}
    canStep={(mode, direction) => getForecastStep(mode, direction) !== null}
    onStep={stepForecastTime}
    onHourChange={selectHour}
  />
{/snippet}

<div
  class="relative flex flex-col h-dvh w-full overflow-hidden bg-slate-100"
  style="--map-controls-top-offset: {mapControlsTopOffset}; --initial-mobile-chart-max: {defaultPaneSizes.vertical}%; --mobile-pane-min: {mobilePaneMinSize}%;"
>
  {#if showMapLoading}
    <div
      class="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 flex justify-center"
      role="status"
    >
      <div class="rounded-md bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-md ring-1 ring-slate-200">
        Loading weather data…
      </div>
    </div>
  {:else if mapError}
    <div
      class="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 flex justify-center"
    >
      <ForecastError message={mapError} retry={forecast.retry} class="max-w-lg shadow-md" />
    </div>
  {/if}

  <div bind:this={pageElement} bind:clientHeight={viewportHeight} class="relative min-h-0 flex-1">
    <ResizablePaneGroup direction={paneDirection} class="flex-col! sm:flex-row!">
      <ResizablePane
        defaultSize={100 - paneDefaultSize}
        minSize={$isMobile ? mobilePaneMinSize : 30}
        class={[initialChartLayout && 'initial-map-pane', paneResizeTransition]}
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
            selectedGridCell={gridWeather?.selectedGridCell ?? null}
            gridCellElevation={gridWeather?.elevation}
            modelGridElevation={gridWeather?.modelGridElevation}
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
        onkeydown={handleChartPaneKeydown}
        class="transition-opacity duration-200 motion-reduce:transition-none max-sm:h-px max-sm:w-full max-sm:after:left-0 max-sm:after:h-1 max-sm:after:w-full max-sm:after:translate-x-0 max-sm:after:-translate-y-1/2 max-sm:[&>div]:rotate-90 {showChart
          ? 'opacity-100'
          : 'pointer-events-none opacity-0'}"
      />
      <ResizablePane
        bind:this={chartPane}
        defaultSize={paneDefaultSize}
        minSize={$isMobile ? mobilePaneMinSize : 30}
        collapsedSize={0}
        collapsible
        onCollapse={handleChartPaneCollapse}
        onExpand={handleChartPaneExpand}
        ontransitionend={handleChartPaneTransitionEnd}
        class={[initialChartLayout && 'initial-chart-pane', paneResizeTransition]}
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
            {#if forecast.cachedAt !== null}
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
              forecastData={forecast.data}
              isLoading={forecast.loading}
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
                  error={forecast.error}
                  retry={forecast.retry}
                  bind:hour={() => selectedHour, selectHour}
                />
              {/snippet}
            </ChartContainer>
            {#if forecast.error && !comparing}
              <div class="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
                <ForecastError message={forecast.error} retry={forecast.retry} class="max-w-md flex-col text-center" />
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
      {#if forecast.cachedAt !== null}
        <p class="mb-1 text-center text-xs text-amber-800">
          Showing cached wind forecast from {new Date(forecast.cachedAt).toLocaleString()}.
        </p>
      {/if}
      {@render timeSelector()}
    </div>
  {/if}
</div>
