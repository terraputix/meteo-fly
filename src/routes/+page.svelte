<script lang="ts">
  import { onMount } from 'svelte';
  import { domainOptions } from '@openmeteo/mapbox-layer';
  import { saveLastVisitedURL } from '$lib/services/storage';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import maplibregl from 'maplibre-gl';
  import Map from '$lib/components/Map.svelte';
  import Controls from '$lib/components/Controls.svelte';
  import MapControls from '$lib/components/MapControls.svelte';
  import TimeSlider from '$lib/components/TimeSlider.svelte';
  import { updateWeatherLayer } from '$lib/services/weatherMap/url';
  import { buildOpenMeteoUrl } from '$lib/services/weatherMap/om_url';
  import ChartContainer from '../lib/components/ChartContainer.svelte';
  import { getInitialParameters } from '$lib/services/defaults';
  import { addDays } from '../utils/dateExtensions';
  import type { WeatherDataType } from '$lib/api/types';
  import { type PageParameters } from '$lib/services/types';
  import { fetchWeatherData } from '$lib/api/api';
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '$lib/components/ui/resizable';

  import { weatherMapStore, weatherMapManager } from '$lib/services/weatherMap/store';

  let parameters = getInitialParameters($page.url.searchParams);

  $: startDate = addDays(new Date(), parameters.selectedDay - 1);

  let rasterTileSource: maplibregl.RasterTileSource | undefined;
  let showChart = false;
  let weatherData: WeatherDataType | null = null;
  let error: string | null = null;

  // Timer for debouncing
  let updateTimer: number;

  // Centralized reactive statement for all map updates
  $: if (rasterTileSource && $weatherMapStore.domainInfo) {
    const omUrl = buildOpenMeteoUrl({
      paddedBounds: $weatherMapStore.paddedBounds,
      domain: $weatherMapStore.domain,
      variable: $weatherMapStore.variable,
      datetime: $weatherMapStore.datetime,
      domainInfo: $weatherMapStore.domainInfo,
    });
    updateWeatherLayer(rasterTileSource, omUrl);
  }

  // URL parameter handling
  function updateURLParams(pageParams: PageParameters) {
    if (!browser) return;

    const params = new URLSearchParams({
      lat: pageParams.location.latitude.toString(),
      lon: pageParams.location.longitude.toString(),
      day: pageParams.selectedDay.toString(),
      model: pageParams.selectedModel,
    });

    const newURL = `?${params.toString()}`;
    saveLastVisitedURL(newURL);
    history.replaceState({}, '', newURL);
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

  function handleBoundsChange(bounds: maplibregl.LngLatBounds) {
    weatherMapManager.setPaddedBounds(bounds);
  }

  function handleLocationChange(lat: number, lng: number) {
    parameters.location.latitude = lat;
    parameters.location.longitude = lng;
    parameters = { ...parameters }; // Trigger reactivity
  }

  async function updateWeather() {
    try {
      error = null;
      weatherData = await fetchWeatherData(parameters.location, parameters.selectedModel, startDate);
    } catch (err) {
      console.error(err);
      error = 'Failed to fetch weather data. Please try again.';
    }
    handleOpenChart();
  }

  function handleClose() {
    showChart = false;
  }

  function handleOpenChart() {
    showChart = true;
  }
</script>

{#if $weatherMapStore.domainInfo}
  {@const initialOmUrl = buildOpenMeteoUrl({
    paddedBounds: $weatherMapStore.paddedBounds,
    domain: $weatherMapStore.domain,
    variable: $weatherMapStore.variable,
    datetime: $weatherMapStore.datetime,
    domainInfo: $weatherMapStore.domainInfo,
  })}
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
      />
      <Controls bind:parameters on:openChart={() => handleOpenChart()} />
    </div>
    <ResizablePaneGroup direction="vertical" class="flex-col-reverse">
      <ResizablePane defaultSize={showChart ? 15 : 100}>
        <TimeSlider />
        <div class="relative h-full w-full">
          <Map
            bind:latitude={parameters.location.latitude}
            bind:longitude={parameters.location.longitude}
            domain={$weatherMapStore.domain}
            {initialOmUrl}
            onLocationChange={handleLocationChange}
            onPaddingExceeded={handleBoundsChange}
            bind:rasterTileSource
          />
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
                  bind:selectedDay={parameters.selectedDay}
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
          <Map
            bind:latitude={parameters.location.latitude}
            bind:longitude={parameters.location.longitude}
            domain={$weatherMapStore.domain}
            {initialOmUrl}
            onLocationChange={handleLocationChange}
            onPaddingExceeded={handleBoundsChange}
            bind:rasterTileSource
          />
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
              />
            </div>
            <div class="rounded-md bg-white/80 p-2">
              <Controls bind:parameters on:openChart={() => handleOpenChart()} />
            </div>
          </div>
          <TimeSlider />
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
                  bind:selectedDay={parameters.selectedDay}
                  on:close={handleClose}
                />
              </div>
            </div>
          {/if}
        </ResizablePane>
      {/if}
    </ResizablePaneGroup>
  </div>
{/if}
