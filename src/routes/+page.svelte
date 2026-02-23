<script lang="ts">
  import { onMount } from 'svelte';
  import { domainOptions } from '@openmeteo/mapbox-layer';
  import { saveLastVisitedURL } from '$lib/services/storage';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import maplibregl from 'maplibre-gl';
  import Map from '$lib/components/Map.svelte';
  import MapControls from '$lib/components/MapControls.svelte';
  import TimeSlider from '$lib/components/TimeSlider.svelte';
  import { updateWeatherLayer } from '$lib/services/weatherMap/url';
  import { buildOpenMeteoUrl } from '$lib/services/weatherMap/om_url';
  import ChartContainer from '../lib/components/ChartContainer.svelte';
  import { addDays } from '../utils/dateExtensions';
  import type { Location, WeatherDataType } from '$lib/api/types';
  import { fetchWeatherData } from '$lib/api/api';
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '$lib/components/ui/resizable';

  import { WeatherMapManager, type WeatherMapState } from '$lib/services/weatherMap/manager';
  import type { WeatherModel } from '$lib/api/types';
  import type { Subscriber, Unsubscriber } from 'svelte/store';

  const weatherMapManager = new WeatherMapManager($page.url.searchParams);
  const weatherMapStore: {
    subscribe: (this: void, run: Subscriber<WeatherMapState>, invalidate?: () => void) => Unsubscriber;
  } = { subscribe: weatherMapManager.subscribe };

  $: startDate = addDays(new Date(), $weatherMapStore.selectedDay - 1);

  let rasterTileSource: maplibregl.RasterTileSource | undefined;
  let showChart = false;
  let weatherData: WeatherDataType | null = null;
  let error: string | null = null;

  let initialOmUrl: string;
  onMount(async () => {
    await weatherMapManager.setDomain($weatherMapStore.domain);

    initialOmUrl = buildOpenMeteoUrl({
      domain: $weatherMapStore.domain,
      variable: $weatherMapStore.variable,
      datetime: $weatherMapStore.datetime,
      domainInfo: $weatherMapStore.domainInfo,
    });
    console.log('initialOmUrl', initialOmUrl);
  });

  // Centralized reactive statement for all map updates
  $: if (rasterTileSource && $weatherMapStore.domainInfo) {
    const omUrl = buildOpenMeteoUrl({
      domain: $weatherMapStore.domain,
      variable: $weatherMapStore.variable,
      datetime: $weatherMapStore.datetime,
      domainInfo: $weatherMapStore.domainInfo,
    });
    updateWeatherLayer(rasterTileSource, omUrl);
  }

  // URL parameter handling
  $: if (browser && $weatherMapStore) {
    const url = new URL($page.url);
    const state = $weatherMapStore;

    url.searchParams.set('lat', state.location.latitude.toString());
    url.searchParams.set('lon', state.location.longitude.toString());
    url.searchParams.set('day', state.selectedDay.toString());
    url.searchParams.set('model', state.selectedModel);

    // Weather map specific parameters
    if (state.domain) {
      url.searchParams.set('map_domain', state.domain.value);
    }
    if (state.baseVariable) {
      url.searchParams.set('map_variable', state.variable);
    }
    if (state.level) {
      url.searchParams.set('map_level', state.level);
    } else {
      url.searchParams.delete('map_level');
    }
    if (state.datetime) {
      url.searchParams.set('map_datetime', state.datetime);
    }

    if (url.search !== $page.url.search) {
      saveLastVisitedURL(url.toString()); // Save full URL
      history.replaceState({}, '', url);
    }
  }

  // Simplified handlers that call the manager
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

  // Synchronize selectedDay with weatherMapStore.datetime
  $: if ($weatherMapStore.datetime) {
    const currentDatetime = new Date($weatherMapStore.datetime);
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day

    const diffTime = currentDatetime.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    weatherMapManager.setSelectedDay(diffDays + 1);
  }

  async function updateWeather() {
    try {
      error = null;
      weatherData = await fetchWeatherData($weatherMapStore.location, $weatherMapStore.selectedModel, startDate);
    } catch (err) {
      console.error(err);
      error = 'Failed to fetch weather data. Please try again.';
    }
  }

  function handleClose() {
    showChart = false;
  }

  function handleOpenChart() {
    showChart = true;
    updateWeather();
  }
</script>

<div class="h-screen sm:hidden">
  <div class="z-10 block w-full bg-white/80 p-4">
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
      onOpenChart={handleOpenChart}
    />
  </div>
  <ResizablePaneGroup direction="vertical" class="flex-col-reverse">
    <ResizablePane defaultSize={showChart ? 15 : 100}>
      <TimeSlider {weatherMapManager} {weatherMapStore} />
      <div class="relative h-full w-full">
        <Map {weatherMapManager} {weatherMapStore} bind:rasterTileSource />
      </div>
    </ResizablePane>
    {#if showChart}
      <ResizableHandle withHandle />
      <ResizablePane defaultSize={50}>
        {#if weatherData}
          <div class="flex h-full flex-col overflow-y-auto">
            <div class="grow bg-white p-2 sm:p-4">
              {#if error}
                <div class="mb-4 bg-red-50 px-4 py-3 text-red-700" role="alert">
                  <span class="block sm:inline">{error}</span>
                </div>
              {/if}
              <ChartContainer
                {weatherData}
                {startDate}
                selectedDay={$weatherMapStore.selectedDay}
                onSelectedDayChange={weatherMapManager.setSelectedDay}
                on:close={handleClose}
              />
            </div>
          </div>
        {/if}
      </ResizablePane>
    {/if}
  </ResizablePaneGroup>
</div>

<div class="hidden h-screen w-full sm:block">
  <ResizablePaneGroup direction="horizontal">
    <ResizablePane defaultSize={showChart ? 50 : 100} minSize={30}>
      <div class="relative h-full w-full">
        <Map {weatherMapManager} {weatherMapStore} bind:rasterTileSource />
        <div class="absolute top-0 right-0 left-0 flex w-full justify-between p-4">
          <div class="rounded-md bg-white/80 p-2">
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
              onOpenChart={handleOpenChart}
            />
          </div>
        </div>
        <TimeSlider {weatherMapManager} {weatherMapStore} />
      </div>
    </ResizablePane>
    {#if showChart}
      <ResizableHandle withHandle />
      <ResizablePane defaultSize={50} minSize={30}>
        {#if weatherData}
          <div class="flex h-full flex-col overflow-y-auto">
            <div class="grow bg-white p-2 sm:p-4">
              {#if error}
                <div class="mb-4 bg-red-50 px-4 py-3 text-red-700" role="alert">
                  <span class="block sm:inline">{error}</span>
                </div>
              {/if}
              <ChartContainer
                {weatherData}
                {startDate}
                selectedDay={$weatherMapStore.selectedDay}
                onSelectedDayChange={weatherMapManager.setSelectedDay}
                on:close={handleClose}
              />
            </div>
          </div>
        {/if}
      </ResizablePane>
    {/if}
  </ResizablePaneGroup>
</div>
