<script lang="ts">
  import { saveLastVisitedURL } from '$lib/services/storage';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { isMobile } from '$lib/stores/media';
  import LocationMap from '$lib/components/LocationMap.svelte';
  import Controls from '$lib/components/Controls.svelte';
  import ChartContainer from '$lib/components/ChartContainer.svelte';
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '$lib/components/ui/resizable';
  import { getInitialParameters } from '$lib/services/defaults';
  import { type PageParameters } from '$lib/services/types';
  import { fetchWeatherData } from '$lib/api/api';
  import type { WeatherDataType } from '$lib/api/types';
  import { addDays } from '$lib/utils/dateExtensions';

  let parameters = getInitialParameters($page.url.searchParams);
  let showChart = false;
  let weatherData: WeatherDataType | null = null;
  let error: string | null = null;
  let updateTimer: ReturnType<typeof setTimeout>;

  $: startDate = addDays(new Date(), parameters.selectedDay - 1);

  function updateURLParams(pageParams: PageParameters) {
    if (!browser) return;
    const params = new URLSearchParams({
      lat: pageParams.location.latitude.toString(),
      lon: pageParams.location.longitude.toString(),
      day: pageParams.selectedDay.toString(),
      model: pageParams.selectedModel,
      maxAlt: (pageParams.maxAltitude ?? 4500).toString(),
    });
    const newURL = `?${params.toString()}`;
    saveLastVisitedURL(newURL);
    history.replaceState({}, '', newURL);
  }

  $: {
    updateURLParams(parameters);
    clearTimeout(updateTimer);
    updateTimer = setTimeout(updateWeather, 5);
  }

  async function updateWeather() {
    try {
      error = null;
      weatherData = await fetchWeatherData(
        parameters.location,
        parameters.selectedModel,
        startDate,
        1,
        parameters.maxAltitude ?? 4500
      );
      showChart = true;
    } catch (err) {
      console.error(err);
      error = 'Failed to fetch weather data. Please try again.';
    }
  }
</script>

<div class="h-screen w-full">
  {#if $isMobile}
    <div class="z-10 w-full bg-white/80 p-2 shadow-sm">
      <Controls bind:parameters on:openChart={() => (showChart = true)} />
    </div>
  {/if}

  <ResizablePaneGroup direction={$isMobile ? 'vertical' : 'horizontal'}>
    <ResizablePane defaultSize={showChart ? ($isMobile ? 15 : 50) : 100} minSize={$isMobile ? 10 : 30}>
      <div class="relative h-full w-full">
        <LocationMap bind:latitude={parameters.location.latitude} bind:longitude={parameters.location.longitude} />
        {#if !$isMobile}
          <div class="absolute inset-x-0 top-0 bg-white/80 p-4 shadow-sm">
            <Controls bind:parameters on:openChart={() => (showChart = true)} />
          </div>
        {/if}
      </div>
    </ResizablePane>

    {#if showChart && weatherData}
      <ResizableHandle withHandle />
      <ResizablePane defaultSize={50} minSize={$isMobile ? 10 : 30}>
        <div class="h-full overflow-y-auto bg-white p-2 sm:p-4">
          {#if error}
            <div class="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          {/if}
          <ChartContainer
            {weatherData}
            {startDate}
            bind:selectedDay={parameters.selectedDay}
            maxAltitude={parameters.maxAltitude}
            model={parameters.selectedModel}
            on:close={() => (showChart = false)}
          />
        </div>
      </ResizablePane>
    {/if}
  </ResizablePaneGroup>
</div>
