<script lang="ts">
  import type { CellSelection, WindChartData, WeatherModel, SkewTWeatherData } from '$lib/api/types';
  import WindChart from './WindChart.svelte';
  import SkewTChart from './SkewTChart.svelte';
  import BottomControls from './BottomControls.svelte';
  import Footer from './Footer.svelte';
  import { browser } from '$app/environment';
  import { tick } from 'svelte';
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
    chartView?: ChartView;
    hour?: number;
    onClose?: () => void;
  } = $props();

  let skewTData = $derived.by(() => {
    if (!skewTWeatherData || chartView !== 'skewt') return null;
    return buildSkewTData(skewTWeatherData, model, maxAltitude, windChartData.modelGridElevation);
  });
  let traceHours = $derived(skewTData?.traces.map((t) => t.time) ?? []);

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
    if (scrollContainer && browser && window.innerWidth < 640) {
      tick().then(() => {
        scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
      });
    }
  });
</script>

<div
  bind:this={scrollContainer}
  class="relative mx-auto flex h-full max-w-3xl flex-col overflow-y-auto rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
>
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

  <div class="mt-auto border-t border-slate-200 bg-linear-to-b from-slate-50 to-white px-3 pb-2 pt-1 sm:px-5">
    <BottomControls
      bind:selectedDay
      {startDate}
      bind:hour
      {traceHours}
      timezoneAbbr={skewTData?.timezoneAbbr ?? ''}
      onclose={onClose}
    />
  </div>
</div>
