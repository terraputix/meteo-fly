<script lang="ts">
  import type { WindChartData, WeatherModel, SkewTWeatherData } from '$lib/api/types';
  import { MODEL_FORECAST_DAYS } from '$lib/api/models';
  import WindChart from './WindChart.svelte';
  import SkewTChart from './SkewTChart.svelte';
  import BottomControls from './BottomControls.svelte';
  import Footer from './Footer.svelte';
  import { windColors, windMaxSpeed } from '$lib/charts/scales';
  import { buildSkewTData } from '$lib/meteo/skewT';
  import type { MaxAltitude } from '$lib/meteo/types';
  import type { ChartView } from '$lib/services/types';

  let {
    windChartData,
    skewTWeatherData = null,
    startDate,
    isWindChartLoading = false,
    isSkewTLoading = false,
    skewTError = null,
    selectedDay = $bindable(),
    maxAltitude = $bindable(4000),
    model = $bindable<WeatherModel>('icon_seamless'),
    chartView = $bindable<ChartView>('wind'),
    hour = $bindable(0),
    daylightOnly = $bindable(false),
    keyboardNavigationEnabled = false,
    onRetrySkewT,
    onClose,
  }: {
    windChartData: WindChartData;
    skewTWeatherData?: SkewTWeatherData | null;
    startDate: Date;
    isWindChartLoading?: boolean;
    isSkewTLoading?: boolean;
    skewTError?: string | null;
    selectedDay: number;
    maxAltitude?: MaxAltitude;
    model?: WeatherModel;
    chartView?: ChartView;
    hour?: number;
    daylightOnly?: boolean;
    keyboardNavigationEnabled?: boolean;
    onRetrySkewT?: () => void;
    onClose?: () => void;
  } = $props();

  let skewTData = $derived.by(() => {
    if (!skewTWeatherData || chartView !== 'skewt') return null;
    return buildSkewTData(skewTWeatherData, model, maxAltitude, windChartData.modelGridElevation);
  });
  let traceHours = $derived(skewTData?.traces.map((t) => t.time) ?? []);
  let maxForecastDays = $derived(MODEL_FORECAST_DAYS[model]);

  $effect(() => {
    if (selectedDay > maxForecastDays) {
      selectedDay = maxForecastDays;
    }
  });

  let legendOpen = $state(false);

  const cloudGradient =
    'linear-gradient(to right, rgba(100,120,145,0), rgba(100,120,145,0.45) 50%, rgba(100,120,145,0.85))';

  const step = 100 / windColors.length;
  const windGradient = `linear-gradient(to right, ${windColors
    .flatMap((color, i) => {
      const start = (i * step).toFixed(1) + '%';
      const end = ((i + 1) * step).toFixed(1) + '%';
      return [`${color} ${start}`, `${color} ${end}`];
    })
    .join(', ')})`;

  $effect(() => {
    if (hour >= traceHours.length && traceHours.length > 0) {
      hour = 0;
    }
  });
</script>

<div
  class="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
>
  <div class="min-h-0 flex-1 overflow-y-auto bg-white px-2 pt-3 pb-1 sm:px-4 sm:pt-4 sm:pb-0">
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
      <WindChart {windChartData} bind:maxAltitude {model} bind:daylightOnly isLoading={isWindChartLoading} />
      <Footer>
        {#snippet heading()}
          <button
            type="button"
            class="text-left text-[0.65rem] tracking-wide whitespace-nowrap text-slate-400 uppercase transition-opacity hover:opacity-100"
            class:opacity-60={!legendOpen}
            class:opacity-100={legendOpen}
            onclick={() => (legendOpen = !legendOpen)}
          >
            {legendOpen ? '▼' : '▶'} Legend
          </button>
        {/snippet}
        {#snippet body()}
          {#if legendOpen}
            <div class="flex w-full flex-wrap justify-center gap-x-10 gap-y-4 pt-4">
              <div class="flex min-w-36 flex-1 basis-44 items-center gap-3">
                <span class="text-[0.65rem] tracking-wide whitespace-nowrap text-slate-400 uppercase">
                  Clouds <small class="lowercase opacity-60">%</small>
                </span>
                <div class="flex flex-1 flex-col gap-0.75">
                  <div
                    class="h-1.25 w-full rounded-full border border-slate-200"
                    style="background: {cloudGradient};"
                  ></div>
                  <div class="flex justify-between font-mono text-[0.6rem] text-slate-300">
                    <span>0</span><span>100</span>
                  </div>
                </div>
              </div>
              <div class="flex min-w-36 flex-1 basis-44 items-center gap-3">
                <span class="text-[0.65rem] tracking-wide whitespace-nowrap text-slate-400 uppercase">
                  Wind <small class="lowercase opacity-60">km/h</small>
                </span>
                <div class="flex flex-1 flex-col gap-0.75">
                  <div class="h-1.25 w-full rounded-full" style="background: {windGradient};"></div>
                  <div class="flex justify-between font-mono text-[0.6rem] text-slate-300">
                    <span>0</span><span>{windMaxSpeed}</span>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        {/snippet}
      </Footer>
    {:else if isSkewTLoading}
      <div class="flex h-64 items-center justify-center">
        <div class="text-sm text-slate-500">Loading sounding data...</div>
      </div>
    {:else if skewTError}
      <div class="flex h-64 items-center justify-center px-4">
        <div
          class="flex max-w-md flex-col items-center gap-3 rounded-md bg-red-50 px-4 py-3 text-center text-sm text-red-700 ring-1 ring-red-200"
          role="alert"
        >
          <span>{skewTError}</span>
          <button
            type="button"
            class="rounded-md bg-red-700 px-3 py-1.5 font-medium text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onclick={onRetrySkewT}
          >
            Retry
          </button>
        </div>
      </div>
    {:else if skewTData && traceHours.length > 0}
      <SkewTChart {skewTData} {hour} bind:maxAltitude {model} isLoading={isSkewTLoading} />
      <Footer />
    {:else}
      <div class="flex h-64 items-center justify-center">
        <div class="text-sm text-slate-500">No sounding data available</div>
      </div>
    {/if}
  </div>

  <div class="shrink-0 border-t border-slate-200 bg-linear-to-b from-slate-50 to-white px-3 pb-2 pt-1 sm:px-5">
    <BottomControls
      bind:selectedDay
      {startDate}
      bind:hour
      {traceHours}
      timezone={skewTData?.timezone ?? windChartData.timezone}
      timezoneAbbr={skewTData?.timezoneAbbr ?? windChartData.timezoneAbbr}
      {maxForecastDays}
      {chartView}
      {keyboardNavigationEnabled}
      onclose={onClose}
    />
  </div>
</div>
