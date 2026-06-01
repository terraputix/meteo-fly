<script lang="ts">
  import type { CellSelection, WindChartData, WeatherModel, SkewTWeatherData } from '$lib/api/types';
  import WindChart from './WindChart.svelte';
  import SkewTChart from './SkewTChart.svelte';
  import DayNavigator from './DayNavigator.svelte';
  import ChartSettings from './ChartSettings.svelte';
  import HourSlider from './HourSlider.svelte';
  import Footer from './Footer.svelte';
  import { browser } from '$app/environment';
  import { buildSkewTData } from '$lib/meteo/skewT';
  import type { MaxAltitude } from '$lib/meteo/types';
  import type { ChartView } from '$lib/services/types';

  let {
    windChartData,
    skewTWeatherData = null,
    startDate,
    isWindChartLoading = false,
    isSkewTLoading = false,
    selectedDay = $bindable(),
    maxAltitude = $bindable(4000),
    model = $bindable<WeatherModel>('icon_d2'),
    cellSelection = $bindable<CellSelection>('nearest'),
    latitude = $bindable(),
    longitude = $bindable(),
    chartView = $bindable<ChartView>('wind'),
    hour = $bindable(0),
    onClose,
  }: {
    windChartData: WindChartData;
    skewTWeatherData?: SkewTWeatherData | null;
    startDate: Date;
    isWindChartLoading?: boolean;
    isSkewTLoading?: boolean;
    selectedDay: number;
    maxAltitude?: MaxAltitude;
    model?: WeatherModel;
    cellSelection?: CellSelection;
    latitude: number;
    longitude: number;
    chartView?: ChartView;
    hour?: number;
    onClose?: () => void;
  } = $props();

  let skewTData = $derived.by(() => {
    if (!skewTWeatherData || chartView !== 'skewt') return null;
    return buildSkewTData(skewTWeatherData, model, maxAltitude, windChartData.modelGridElevation);
  });
  let traceHours = $derived(skewTData?.traces.map((t) => t.time) ?? []);

  let showMobileSettings = $state(false);
  let scrollContainer: HTMLDivElement | undefined;

  $effect(() => {
    if (hour >= traceHours.length && traceHours.length > 0) {
      hour = 0;
    }
  });

  $effect(() => {
    void windChartData;
    void selectedDay;
    void maxAltitude;
    void model;
    void cellSelection;
    void showMobileSettings;
    if (scrollContainer && browser && window.innerWidth < 640) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  });
</script>

<div
  bind:this={scrollContainer}
  class="relative mx-auto flex h-full max-w-3xl flex-col overflow-y-auto rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
>
  <div class="border-b border-slate-200 bg-linear-to-b from-slate-50 to-white px-3 py-3 sm:px-5 sm:py-4">
    <div
      class="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2 shadow-inner shadow-slate-100 sm:flex sm:gap-3 sm:p-2.5"
    >
      <DayNavigator bind:selectedDay {startDate} onclose={onClose} />
    </div>

    <div class="mt-0 hidden sm:grid sm:grid-cols-3 sm:gap-3">
      <ChartSettings bind:model bind:maxAltitude bind:cellSelection />
    </div>
  </div>

  <div class="bg-white px-2 pt-3 pb-1 sm:px-4 sm:pt-4 sm:pb-0">
    <div class="mb-2 flex items-center justify-center">
      <div class="inline-flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          class="rounded-lg px-4 py-1.5 text-sm font-medium transition"
          class:bg-white={chartView === 'wind'}
          class:text-slate-900={chartView === 'wind'}
          class:shadow-sm={chartView === 'wind'}
          class:ring-1={chartView === 'wind'}
          class:ring-slate-200={chartView === 'wind'}
          class:text-slate-500={chartView !== 'wind'}
          class:hover:text-slate-700={chartView !== 'wind'}
          onclick={() => (chartView = 'wind')}
        >
          Wind Chart
        </button>
        <button
          type="button"
          class="rounded-lg px-4 py-1.5 text-sm font-medium transition"
          class:bg-white={chartView === 'skewt'}
          class:text-slate-900={chartView === 'skewt'}
          class:shadow-sm={chartView === 'skewt'}
          class:ring-1={chartView === 'skewt'}
          class:ring-slate-200={chartView === 'skewt'}
          class:text-slate-500={chartView !== 'skewt'}
          class:hover:text-slate-700={chartView !== 'skewt'}
          onclick={() => (chartView = 'skewt')}
        >
          Skew-T
        </button>
      </div>
    </div>

    {#if chartView === 'wind'}
      <WindChart {windChartData} {maxAltitude} {model} isLoading={isWindChartLoading} />
    {:else if skewTData && traceHours.length > 0}
      <div class="mb-3">
        <HourSlider bind:hour {traceHours} timezoneAbbr={skewTData?.timezoneAbbr ?? ''} />
      </div>
      <SkewTChart {skewTData} {hour} isLoading={isSkewTLoading} />
    {:else if isSkewTLoading}
      <div class="flex h-64 items-center justify-center">
        <div class="text-sm text-slate-500">Loading sounding data...</div>
      </div>
    {:else}
      <div class="flex h-64 items-center justify-center">
        <div class="text-sm text-slate-500">No sounding data available</div>
      </div>
    {/if}

    <div class="mt-0.5 sm:mt-1">
      <Footer />
    </div>
  </div>

  <div class="mt-auto border-t border-slate-200 bg-linear-to-b from-slate-50 to-white px-3 py-2 sm:hidden">
    <div
      class="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2 shadow-inner shadow-slate-100"
    >
      <DayNavigator bind:selectedDay {startDate} onclose={onClose} compact />
    </div>

    <button
      type="button"
      class="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
      onclick={() => (showMobileSettings = !showMobileSettings)}
      aria-expanded={showMobileSettings}
      aria-controls="chart-mobile-settings"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6h18M7 12h10M10 18h4" />
      </svg>
      Settings
    </button>

    {#if showMobileSettings}
      <div id="chart-mobile-settings" class="mt-2 grid grid-cols-1 gap-2">
        <ChartSettings bind:model bind:maxAltitude bind:cellSelection {latitude} {longitude} />
      </div>
    {/if}
  </div>
</div>
