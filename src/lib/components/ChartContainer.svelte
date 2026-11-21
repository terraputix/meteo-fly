<script lang="ts">
  import type { Snippet } from 'svelte';
  import { units } from '#lib/stores/units.js';
  import { windSpeed } from '#lib/utils/units.js';
  import type { WindChartData, WeatherModel, SkewTWeatherData } from '#lib/api/types.js';
  import WindChart from './WindChart.svelte';
  import SkewTChart from './SkewTChart.svelte';
  import Footer from './Footer.svelte';
  import { windColors, windMaxSpeed } from '#lib/charts/scales.js';
  import { CHART_COLORS, WIND_CLOUD_BANDS, WIND_CLOUD_EDGE_ALPHA } from '#lib/charts/chartColors.js';
  import { buildSkewTData } from '#lib/meteo/skewT.js';
  import type { MaxAltitude } from '#lib/meteo/types.js';
  import type { ChartView } from '#lib/services/types.js';

  let {
    windChartData,
    skewTWeatherData = null,
    isWindChartLoading = false,
    isSkewTLoading = false,
    skewTError = null,
    maxAltitude = $bindable(4000),
    model = $bindable<WeatherModel>('icon_seamless'),
    chartView = $bindable<ChartView>('wind'),
    selectedTime,
    comparisonGrid,
    timestepControls,
    daylightOnly = $bindable(false),
    onContentHeightChange,
    onRetrySkewT,
    onClose,
  }: {
    windChartData: WindChartData | null;
    skewTWeatherData?: SkewTWeatherData | null;
    isWindChartLoading?: boolean;
    isSkewTLoading?: boolean;
    skewTError?: string | null;
    maxAltitude?: MaxAltitude;
    model?: WeatherModel;
    chartView?: ChartView;
    selectedTime?: Date;
    comparisonGrid: Snippet;
    timestepControls: Snippet;
    daylightOnly?: boolean;
    onContentHeightChange?: (height: number) => void;
    onRetrySkewT?: () => void;
    onClose?: () => void;
  } = $props();

  let skewTData = $derived.by(() => {
    if (!skewTWeatherData || chartView !== 'skewt') return null;
    return buildSkewTData(skewTWeatherData, model, maxAltitude, windChartData?.modelGridElevation);
  });
  let traceHours = $derived(skewTData?.traces.map((t) => t.time) ?? []);
  let legendOpen = $state(false);
  let bodyHeight = $state(0);
  let bodyElement: HTMLDivElement;
  let controlsElement: HTMLDivElement;
  let controlsHeight = $state(0);

  export function measureContentHeight() {
    return bodyElement.offsetHeight + controlsElement.offsetHeight + 2;
  }

  $effect(() => {
    if (bodyHeight > 0) {
      onContentHeightChange?.(bodyHeight + controlsHeight + 2);
    }
  });

  const cloudGradient = `linear-gradient(to right, ${[
    `${CHART_COLORS.cloudRect}0) 0%`,
    `${CHART_COLORS.cloudRect}${WIND_CLOUD_EDGE_ALPHA / 255}) ${WIND_CLOUD_BANDS[0].minimum}%`,
    ...WIND_CLOUD_BANDS.flatMap((band, i) => {
      const color = `${CHART_COLORS.cloudRect}${band.alpha / 255})`;
      return [`${color} ${band.minimum}%`, `${color} ${WIND_CLOUD_BANDS[i + 1]?.minimum ?? 100}%`];
    }),
  ].join(', ')})`;

  const step = 100 / windColors.length;
  const windGradient = `linear-gradient(to right, ${windColors
    .flatMap((color, i) => {
      const start = (i * step).toFixed(1) + '%';
      const end = ((i + 1) * step).toFixed(1) + '%';
      return [`${color} ${start}`, `${color} ${end}`];
    })
    .join(', ')})`;

  let soundingHour = $derived(traceHours.findIndex((time) => +time === selectedTime?.getTime()));
</script>

<div
  class="relative mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
>
  <div data-chart-scroll class="min-h-0 flex-1 overflow-y-auto bg-white">
    <div
      bind:this={bodyElement}
      bind:offsetHeight={bodyHeight}
      class="flex flex-col px-2 pt-3 pb-1 sm:min-h-full sm:px-4 sm:pt-4 sm:pb-0"
    >
      <div class="relative mb-2 flex shrink-0 items-center justify-center">
        <button
          type="button"
          aria-label="Close chart panel"
          onclick={onClose}
          class="absolute right-0 rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100">×</button
        >
        <div class="inline-flex rounded-xl bg-slate-100 p-1">
          {#each [{ id: 'wind', name: 'Wind Chart' }, { id: 'skewt', name: 'Skew-T' }, { id: 'comparison', name: 'Compare winds' }] as const as tab (tab.id)}
            <button
              type="button"
              class="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 sm:px-3 sm:text-sm"
              class:bg-white={chartView === tab.id}
              class:shadow-sm={chartView === tab.id}
              aria-pressed={chartView === tab.id}
              onclick={() => (chartView = tab.id)}>{tab.name}</button
            >
          {/each}
        </div>
      </div>

      {#if chartView === 'comparison'}
        {@render comparisonGrid()}
      {:else if chartView === 'wind'}
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
                    <div class="relative h-3 font-mono text-[0.6rem] text-slate-400">
                      {#each WIND_CLOUD_BANDS as band (band.minimum)}
                        <span class="absolute -translate-x-1/2" style="left: {band.minimum}%;">{band.minimum}</span>
                      {/each}
                      <span class="absolute right-0">100</span>
                    </div>
                  </div>
                </div>
                <div class="flex min-w-36 flex-1 basis-44 items-center gap-3">
                  <span class="text-[0.65rem] tracking-wide whitespace-nowrap text-slate-400 uppercase">
                    Wind <small class="lowercase opacity-60">{$units.wind}</small>
                  </span>
                  <div class="flex flex-1 flex-col gap-0.75">
                    <div class="h-1.25 w-full rounded-full" style="background: {windGradient};"></div>
                    <div class="flex justify-between font-mono text-[0.6rem] text-slate-300">
                      <span>0</span><span>{Math.round(windSpeed(windMaxSpeed, $units))}</span>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          {/snippet}
        </Footer>
      {:else}
        <div class="relative flex flex-1 flex-col">
          <SkewTChart
            skewTData={soundingHour >= 0 ? skewTData : null}
            hour={soundingHour}
            bind:maxAltitude
            {model}
            isLoading={isSkewTLoading || (isWindChartLoading && !windChartData)}
          />
          {#if skewTError}
            <div
              class="absolute top-1/2 left-1/2 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-md bg-red-50 px-4 py-3 text-center text-sm text-red-700 ring-1 ring-red-200"
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
          {:else if windChartData && !isSkewTLoading && soundingHour < 0}
            <div class="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
              No sounding data available
            </div>
          {/if}
        </div>
        <Footer />
      {/if}
    </div>
  </div>
  <div
    bind:this={controlsElement}
    bind:offsetHeight={controlsHeight}
    class="shrink-0 border-t border-slate-200 bg-white px-3 pt-1 pb-[max(.25rem,env(safe-area-inset-bottom))]"
  >
    {@render timestepControls()}
  </div>
</div>
