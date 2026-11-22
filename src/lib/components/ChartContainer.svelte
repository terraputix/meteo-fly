<script lang="ts">
  import type { Snippet } from 'svelte';
  import { units } from '#lib/stores/units.js';
  import { windSpeed } from '#lib/utils/units.js';
  import type { WeatherModel } from '#lib/api/types.js';
  import WindChart from './WindChart.svelte';
  import SkewTChart from './SkewTChart.svelte';
  import Footer from './Footer.svelte';
  import { windColors, windMaxSpeed } from '#lib/charts/scales.js';
  import { CHART_COLORS, WIND_CLOUD_BANDS, WIND_CLOUD_EDGE_ALPHA } from '#lib/charts/chartColors.js';
  import { buildSkewTData } from '#lib/meteo/skewT.js';
  import type { MaxAltitude } from '#lib/meteo/types.js';
  import type { ChartView } from '#lib/services/types.js';
  import type { ForecastData } from '#lib/services/forecastRequests.svelte.js';

  let {
    forecastData,
    isLoading,
    maxAltitude = $bindable(4000),
    model = $bindable<WeatherModel>('icon_seamless'),
    chartView = $bindable<ChartView>('wind'),
    selectedTime,
    comparisonGrid,
    timestepControls,
    daylightOnly = $bindable(false),
    onContentHeightChange,
    onClose,
  }: {
    forecastData: ForecastData | null;
    isLoading: boolean;
    maxAltitude?: MaxAltitude;
    model?: WeatherModel;
    chartView?: ChartView;
    selectedTime?: Date;
    comparisonGrid: Snippet;
    timestepControls: Snippet;
    daylightOnly?: boolean;
    onContentHeightChange?: (height: number) => void;
    onClose?: () => void;
  } = $props();

  const skewTData = $derived.by(() => {
    if (forecastData?.view !== 'skewt' || chartView !== 'skewt') return null;
    const { weather } = forecastData;
    return buildSkewTData(weather, model, maxAltitude, weather.modelGridElevation);
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
      class="@container flex flex-col px-2 pt-3 pb-1 sm:min-h-full sm:px-4 sm:pt-4 sm:pb-0"
    >
      <div class="mb-2 grid shrink-0 grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-x-1">
        <div class="col-start-2 row-start-1 overflow-x-auto">
          <div class="mx-auto flex w-max rounded-xl bg-slate-100 p-1">
            {#each [{ id: 'wind', name: 'Wind Chart' }, { id: 'skewt', name: 'Skew-T' }, { id: 'comparison', name: 'Compare winds' }] as const as tab (tab.id)}
              <button
                type="button"
                class="shrink-0 rounded-lg px-1.5 py-1.5 text-xs font-medium whitespace-nowrap text-slate-700 @min-[22rem]:px-3 @min-[22rem]:text-sm"
                class:bg-white={chartView === tab.id}
                class:shadow-sm={chartView === tab.id}
                aria-pressed={chartView === tab.id}
                onclick={() => (chartView = tab.id)}>{tab.name}</button
              >
            {/each}
          </div>
        </div>
        <button
          type="button"
          aria-label="Close chart panel"
          onclick={onClose}
          class="col-start-3 row-start-1 inline-flex size-9 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-100"
          >×</button
        >
      </div>

      {#if chartView === 'comparison'}
        {@render comparisonGrid()}
      {:else if chartView === 'wind'}
        <WindChart
          windChartData={forecastData?.view === 'wind' ? forecastData.weather : null}
          bind:maxAltitude
          {model}
          bind:daylightOnly
          {isLoading}
        />
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
            {isLoading}
          />
          {#if skewTData && !isLoading && soundingHour < 0}
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
    class="shrink-0 border-t border-slate-200 bg-white px-3 py-1"
  >
    {@render timestepControls()}
  </div>
</div>
