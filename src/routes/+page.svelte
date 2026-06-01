<script lang="ts">
  import { saveLastVisitedURL } from '$lib/services/storage';
  import { page } from '$app/stores';
  import { afterNavigate, replaceState } from '$app/navigation';
  import { isMobile } from '$lib/stores/media';
  import type { RasterTileSource } from 'maplibre-gl';
  import { domainOptions } from '@openmeteo/weather-map-layer';
  import Map from '$lib/components/Map.svelte';
  import MapControls from '$lib/components/MapControls.svelte';
  import TimeSlider from '$lib/components/TimeSlider.svelte';
  import { updateWeatherLayer } from '$lib/services/weatherMap/url';
  import { buildOpenMeteoUrl } from '$lib/services/weatherMap/om_url';
  import { WeatherMapManager, type WeatherMapState } from '$lib/services/weatherMap/manager';
  import type { Subscriber, Unsubscriber } from 'svelte/store';
  import ChartContainer from '$lib/components/ChartContainer.svelte';
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '$lib/components/ui/resizable';
  import { getInitialParameters } from '$lib/services/defaults';
  import { type PageParameters } from '$lib/services/types';
  import { fetchWindChartData, fetchModelGridElevation, fetchSkewTData } from '$lib/api/api';
  import type { Location, WindChartData, SkewTWeatherData, WeatherModel } from '$lib/api/types';
  import { addDays } from '$lib/utils/dateExtensions';
  import { SvelteURLSearchParams } from 'svelte/reactivity';

  const weatherMapManager = new WeatherMapManager($page.url.searchParams);
  const weatherMapStore: {
    subscribe: (this: void, run: Subscriber<WeatherMapState>, invalidate?: () => void) => Unsubscriber;
  } = { subscribe: weatherMapManager.subscribe };

  let parameters: PageParameters = $state(getInitialParameters($page.url.searchParams));
  let showChart = $state(false);
  let chartView: 'wind' | 'skewt' = $state(parameters.chartView ?? 'wind');
  let selectedHour = $state(parameters.hour ?? 0);
  let windChartData = $state.raw<WindChartData | null>(null);
  let skewTWeatherData = $state.raw<SkewTWeatherData | null>(null);
  let isWindChartLoading = $state(false);
  let isSkewTLoading = $state(false);
  let error: string | null = $state(null);

  let rasterTileSource = $state<RasterTileSource | undefined>();
  let updateTimer: ReturnType<typeof setTimeout> | null = null;

  const startDate = $derived(addDays(new Date(), parameters.selectedDay - 1));

  const urlSearch = $derived.by(() => {
    const { location, selectedDay, selectedModel, maxAltitude, cellSelection } = parameters;
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

  function toggleChartPanel() {
    showChart = !showChart;
  }

  function handleDomainChange(domainValue: string) {
    const selectedDomain = domainOptions.find((d) => d.value === domainValue);
    if (selectedDomain) {
      weatherMapManager.setDomain(selectedDomain);
    }
  }

  function handleBaseVariableChange(baseVariable: string) {
    weatherMapManager.setBaseVariable(baseVariable);
  }

  function handleLevelChange(level: string) {
    weatherMapManager.setLevel(level);
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

  $effect(() => {
    if (rasterTileSource && $weatherMapStore.domainInfo) {
      const omUrl = buildOpenMeteoUrl({
        domain: $weatherMapStore.domain,
        variable: $weatherMapStore.variable,
        datetime: $weatherMapStore.datetime,
        domainInfo: $weatherMapStore.domainInfo,
      });
      updateWeatherLayer(rasterTileSource, omUrl);
    }
  });

  $effect(() => {
    void parameters.location.latitude;
    void parameters.location.longitude;
    void parameters.selectedDay;
    void parameters.selectedModel;
    void parameters.maxAltitude;
    void parameters.cellSelection;

    clearTimeout(updateTimer ?? undefined);
    updateTimer = setTimeout(updateWindChart, 5);
  });

  $effect(() => {
    if (!showChart || chartView !== 'skewt') return;

    void parameters.location.latitude;
    void parameters.location.longitude;
    void parameters.selectedModel;
    void parameters.maxAltitude;
    void parameters.cellSelection;
    void startDate;

    updateSkewTData();
  });

  async function updateWindChart() {
    isWindChartLoading = true;

    try {
      error = null;
      const result = await fetchWindChartData(
        parameters.location,
        parameters.selectedModel,
        startDate,
        1,
        parameters.maxAltitude,
        parameters.cellSelection
      );
      const modelGridElevation = result.selectedGridCell
        ? await fetchModelGridElevation(
            result.selectedGridCell,
            parameters.selectedModel,
            parameters.cellSelection
          ).catch(() => undefined)
        : undefined;
      windChartData = { ...result, modelGridElevation };
      showChart = true;
    } catch (err) {
      console.error(err);
      error = 'Failed to fetch weather data. Please try again.';
    } finally {
      isWindChartLoading = false;
    }
  }

  async function updateSkewTData() {
    if (!showChart) return;

    isSkewTLoading = true;

    try {
      skewTWeatherData = await fetchSkewTData(
        parameters.location,
        parameters.selectedModel,
        startDate,
        parameters.maxAltitude,
        parameters.cellSelection
      );
    } catch (err) {
      console.error(err);
    } finally {
      isSkewTLoading = false;
    }
  }
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
  {#if $isMobile}
    <div class="z-10 w-full bg-white/80 p-2 shadow-sm">
      <MapControls
        currentDomain={$weatherMapStore.domain}
        currentBaseVariable={$weatherMapStore.baseVariable}
        currentLevel={$weatherMapStore.level}
        domainInfo={$weatherMapStore.domainInfo}
        availableLevels={$weatherMapStore.availableLevels}
        onDomainChange={handleDomainChange}
        onBaseVariableChange={handleBaseVariableChange}
        onLevelChange={handleLevelChange}
        latitude={$weatherMapStore.location.latitude}
        longitude={$weatherMapStore.location.longitude}
        onOpenChart={toggleChartPanel}
      />
    </div>
  {/if}
  <ResizablePaneGroup direction={$isMobile ? 'vertical' : 'horizontal'}>
    <ResizablePane defaultSize={showChart ? ($isMobile ? 15 : 50) : 100} minSize={$isMobile ? 10 : 30}>
      <div class="relative h-full w-full overflow-hidden bg-slate-200">
        {#if !$isMobile}
          <div class="absolute inset-x-0 top-0 z-10 bg-white/80 p-4 shadow-sm">
            <MapControls
              currentDomain={$weatherMapStore.domain}
              currentBaseVariable={$weatherMapStore.baseVariable}
              currentLevel={$weatherMapStore.level}
              domainInfo={$weatherMapStore.domainInfo}
              availableLevels={$weatherMapStore.availableLevels}
              onDomainChange={handleDomainChange}
              onBaseVariableChange={handleBaseVariableChange}
              onLevelChange={handleLevelChange}
              latitude={$weatherMapStore.location.latitude}
              longitude={$weatherMapStore.location.longitude}
              selectedDay={$weatherMapStore.selectedDay}
              selectedModel={$weatherMapStore.selectedModel}
              onLocationChange={(loc: Location) => weatherMapManager.setLocation(loc)}
              onSelectedDayChange={(day: number) => weatherMapManager.setSelectedDay(day)}
              onSelectedModelChange={(model: WeatherModel) => weatherMapManager.setSelectedModel(model)}
              maxAltitude={parameters.maxAltitude}
              onMaxAltitudeChange={(alt) => (parameters.maxAltitude = alt)}
              onOpenChart={toggleChartPanel}
            />
          </div>
        {/if}
        <Map
          {weatherMapManager}
          {weatherMapStore}
          bind:rasterTileSource
          latitude={parameters.location.latitude}
          longitude={parameters.location.longitude}
          bind:chartOpen={showChart}
          selectedGridCell={windChartData?.selectedGridCell ?? null}
          gridCellElevation={windChartData?.elevation}
          modelGridElevation={windChartData?.modelGridElevation}
          onToggleChart={toggleChartPanel}
          onLocationChange={updateLocation}
        />
        <TimeSlider {weatherMapManager} {weatherMapStore} />
      </div>
    </ResizablePane>

    {#if showChart && windChartData}
      <ResizableHandle withHandle />
      <ResizablePane defaultSize={50} minSize={$isMobile ? 10 : 30}>
        <div class="h-full overflow-y-auto bg-white p-0 sm:p-0">
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
            bind:latitude={parameters.location.latitude}
            bind:longitude={parameters.location.longitude}
            bind:chartView
            bind:hour={selectedHour}
            onClose={() => (showChart = false)}
          />
        </div>
      </ResizablePane>
    {/if}
  </ResizablePaneGroup>
</div>
