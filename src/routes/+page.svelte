<script lang="ts">
  import { untrack } from 'svelte';
  import { saveLastVisitedURL } from '$lib/services/storage';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';
  import { isMobile } from '$lib/stores/media';
  import LocationMap from '$lib/components/LocationMap.svelte';
  import ChartContainer from '$lib/components/ChartContainer.svelte';
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '$lib/components/ui/resizable';
  import { getInitialParameters } from '$lib/services/defaults';
  import { type PageParameters } from '$lib/services/types';
  import { fetchWeatherData } from '$lib/api/api';
  import type { Location, WeatherDataType } from '$lib/api/types';
  import { addDays } from '$lib/utils/dateExtensions';

  let parameters: PageParameters = $state(getInitialParameters($page.url.searchParams));
  let showChart = $state(false);
  let weatherData = $state.raw<WeatherDataType | null>(null);
  let isWeatherLoading = $state(false);
  let error: string | null = $state(null);

  let updateTimer: ReturnType<typeof setTimeout> | null = null;

  const startDate = $derived(addDays(new Date(), parameters.selectedDay - 1));

  const urlSearch = $derived.by(() => {
    const { location, selectedDay, selectedModel, maxAltitude, cellSelection } = parameters;
    const params = new URLSearchParams({
      lat: location.latitude.toString(),
      lon: location.longitude.toString(),
      day: selectedDay.toString(),
      model: selectedModel,
      maxAlt: (maxAltitude ?? 4000).toString(),
      cellSelection,
    });
    return `?${params.toString()}`;
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    const search = urlSearch;
    const currentSearch = untrack(() => $page.url.search);
    if (currentSearch === search) {
      return;
    }

    const pathname = untrack(() => $page.url.pathname);
    const pageState = untrack(() => $page.state);
    const newURL = `${pathname}${search}`;
    saveLastVisitedURL(newURL);
    replaceState(newURL, pageState);
  });

  function toggleChartPanel() {
    showChart = !showChart;
  }

  function updateLocation(location: Location) {
    parameters.location = location;

    if (weatherData) {
      weatherData = {
        ...weatherData,
        selectedGridCell: null,
      };
    }
  }

  $effect(() => {
    parameters.location.latitude;
    parameters.location.longitude;
    parameters.selectedDay;
    parameters.selectedModel;
    parameters.maxAltitude;
    parameters.cellSelection;

    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    updateTimer = setTimeout(updateWeather, 5);

    return () => {
      if (updateTimer) {
        clearTimeout(updateTimer);
      }
    };
  });

  async function updateWeather() {
    isWeatherLoading = true;

    try {
      error = null;
      weatherData = await fetchWeatherData(
        parameters.location,
        parameters.selectedModel,
        startDate,
        1,
        parameters.maxAltitude ?? 4000,
        parameters.cellSelection
      );
      showChart = true;
    } catch (err) {
      console.error(err);
      error = 'Failed to fetch weather data. Please try again.';
    } finally {
      isWeatherLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Meteo-Fly - Wind Forecast for Paragliding & Hang Gliding</title>
  <meta
    name="description"
    content="Professional wind forecast visualization for paragliders and hang gliders. Interactive wind charts for multiple meteorological models including ICON, GFS, UKMO, and MeteoFrance."
  />
  <meta
    name="keywords"
    content="paragliding wind forecast, hang gliding weather, wind speed chart, meteorological data, aviation weather"
  />
  <meta property="og:title" content="Meteo-Fly - Wind Forecast for Paragliding & Hang Gliding" />
  <meta
    property="og:description"
    content="Professional wind forecast visualization for paragliders and hang gliders. Interactive wind charts for multiple meteorological models including ICON, GFS, UKMO, and MeteoFrance."
  />
  <meta property="og:url" content="https://meteo-fly.com/" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://meteo-fly.com/icons/icon-512x512.png" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Meteo-Fly - Wind Forecast for Paragliding & Hang Gliding" />
  <meta
    name="twitter:description"
    content="Professional wind forecast visualization for paragliders and hang gliders. Interactive wind charts for multiple meteorological models including ICON, GFS, UKMO, and MeteoFrance."
  />
  <meta name="twitter:image" content="https://meteo-fly.com/icons/icon-512x512.png" />

  <link rel="canonical" href="https://meteo-fly.com/" />
</svelte:head>

<div class="h-screen w-full overflow-hidden bg-slate-100">
  <ResizablePaneGroup direction={$isMobile ? 'vertical' : 'horizontal'}>
    <ResizablePane defaultSize={showChart ? ($isMobile ? 15 : 50) : 100} minSize={$isMobile ? 10 : 30}>
      <div class="relative h-full w-full overflow-hidden bg-slate-200">
        <LocationMap
          latitude={parameters.location.latitude}
          longitude={parameters.location.longitude}
          bind:chartOpen={showChart}
          selectedGridCell={weatherData?.selectedGridCell ?? null}
          onToggleChart={toggleChartPanel}
          onLocationChange={updateLocation}
        />
      </div>
    </ResizablePane>

    {#if showChart && weatherData}
      <ResizableHandle withHandle />
      <ResizablePane defaultSize={50} minSize={$isMobile ? 10 : 30}>
        <div class="h-full overflow-y-auto bg-white p-0 sm:p-0">
          {#if error}
            <div class="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          {/if}
          <ChartContainer
            {weatherData}
            {startDate}
            {isWeatherLoading}
            bind:selectedDay={parameters.selectedDay}
            bind:maxAltitude={parameters.maxAltitude}
            bind:model={parameters.selectedModel}
            bind:cellSelection={parameters.cellSelection}
            bind:latitude={parameters.location.latitude}
            bind:longitude={parameters.location.longitude}
            on:close={() => (showChart = false)}
          />
        </div>
      </ResizablePane>
    {/if}
  </ResizablePaneGroup>
</div>
