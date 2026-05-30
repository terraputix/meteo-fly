<script lang="ts">
  import { tick } from 'svelte';
  import type { CellSelection, WeatherDataType, WeatherModel, SkewTWeatherData } from '$lib/api/types';
  import WindChart from './WindChart.svelte';
  import SkewTChart from './SkewTChart.svelte';
  import { buildSkewTData } from '$lib/meteo/skewT';
  import { createEventDispatcher } from 'svelte';
  import Footer from './Footer.svelte';
  import type { MaxAltitude, SkewTData } from '$lib/meteo/types';
  import type { ChartView } from '$lib/services/types';

  export let weatherData: WeatherDataType;
  export let skewTWeatherData: SkewTWeatherData | null = null;
  export let startDate: Date;
  export let isWeatherLoading = false;
  export let isSkewTLoading = false;
  export let selectedDay: number;
  export let maxAltitude: MaxAltitude = 4000;
  export let model: WeatherModel = 'icon_d2';
  export let cellSelection: CellSelection = 'nearest';
  export let latitude: number;
  export let longitude: number;
  export let chartView: ChartView = 'wind';
  export let selectedTraceIndex = 0;
  export let hour: number | undefined = undefined;

  let skewTData: SkewTData | null = null;
  let traceHours: Date[] = [];

  const models: { id: WeatherModel; name: string }[] = [
    { id: 'icon_seamless', name: 'ICON Seamless' },
    { id: 'icon_d2', name: 'ICON D2' },
    { id: 'icon_eu', name: 'ICON EU' },
    { id: 'icon_global', name: 'ICON Global' },
    { id: 'gfs_seamless', name: 'GFS Seamless' },
    { id: 'meteofrance_seamless', name: 'MeteoFrance' },
    { id: 'ecmwf_ifs025', name: 'ECMWF IFS 0.25°' },
    { id: 'ecmwf_aifs025_single', name: 'ECMWF AIFS 0.25°' },
    { id: 'ukmo_seamless', name: 'UKMO' },
    { id: 'gem_seamless', name: 'GEM' },
    { id: 'cma_grapes_global', name: 'CMA GRAPES' },
  ];

  const altitudes: { value: MaxAltitude; name: string }[] = [
    { value: 3000, name: '3000m (700hPa)' },
    { value: 4000, name: '4000m (625hPa)' },
    { value: 5000, name: '5000m (550hPa)' },
    { value: 6000, name: '6000m (475hPa)' },
    { value: 7000, name: '7000m (400hPa)' },
    { value: 8000, name: '8000m (350hPa)' },
  ];

  const cellSelectionOptions: { value: CellSelection; label: string }[] = [
    { value: 'land', label: 'Terrain-aware' },
    { value: 'nearest', label: 'Nearest' },
  ];

  const dispatch = createEventDispatcher();
  let showMobileSettings = false;
  let scrollContainer: HTMLDivElement | undefined;

  let syncedHour: number | undefined = undefined;

  $: if (skewTWeatherData && chartView === 'skewt') {
    skewTData = buildSkewTData(skewTWeatherData, model, maxAltitude);
    traceHours = skewTData?.traces.map((t) => t.time) ?? [];
    syncedHour = undefined;
    if (selectedTraceIndex >= traceHours.length) {
      selectedTraceIndex = 0;
    }
  }

  $: if (traceHours.length > 0 && hour != null && hour !== syncedHour) {
    const idx = traceHours.findIndex((t) => t.getHours() === hour);
    if (idx >= 0) selectedTraceIndex = idx;
  }

  function emitHour() {
    const h = traceHours[selectedTraceIndex]?.getHours();
    if (h != null) {
      syncedHour = h;
      dispatch('hourChange', h);
    }
  }

  function prevTrace() {
    if (selectedTraceIndex > 0) selectedTraceIndex--;
    emitHour();
  }

  function nextTrace() {
    if (selectedTraceIndex < traceHours.length - 1) selectedTraceIndex++;
    emitHour();
  }

  function handleSliderInput(e: Event) {
    const target = e.target as HTMLInputElement;
    selectedTraceIndex = parseInt(target.value);
    emitHour();
  }

  function handleViewChange(view: ChartView) {
    chartView = view;
  }

  function formatDayHour(date: Date): string {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function getDayLabel(day: number) {
    if (day === 1) return 'Today';
    if (day === 2) return 'Tomorrow';
    if (day === 0) return 'Yesterday';
    return day > 1 ? `+${day - 1} days` : `${day - 1} days`;
  }

  function scrollToBottom() {
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }

  async function refreshScrollPosition() {
    await tick();
    scrollToBottom();
  }

  function handleNextDay(e: MouseEvent) {
    e.preventDefault();
    if (selectedDay < 8) {
      selectedDay += 1;
    }
  }

  function handlePreviousDay(e: MouseEvent) {
    e.preventDefault();
    if (selectedDay > -13) {
      selectedDay -= 1;
    }
  }

  function close() {
    dispatch('close');
  }

  $: (weatherData, refreshScrollPosition());
  $: (selectedDay, refreshScrollPosition());
  $: (maxAltitude, refreshScrollPosition());
  $: (model, refreshScrollPosition());
  $: (cellSelection, refreshScrollPosition());
  $: (showMobileSettings, refreshScrollPosition());
</script>

<div
  bind:this={scrollContainer}
  class="relative mx-auto flex h-full max-w-3xl flex-col overflow-y-auto rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
>
  <div class="border-b border-slate-200 bg-linear-to-b from-slate-50 to-white px-3 py-3 sm:px-5 sm:py-4">
    <div
      class="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2 shadow-inner shadow-slate-100 sm:flex sm:gap-3 sm:p-2.5"
    >
      <button
        on:click={handlePreviousDay}
        disabled={selectedDay <= -13}
        class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        aria-label="Previous day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div class="min-w-0 flex-1">
        <div class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Forecast</div>
        <div class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-slate-800">
          <span class="truncate">{getDayLabel(selectedDay)}</span>
          <span class="text-slate-300">•</span>
          <span class="truncate text-slate-600">
            {startDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      <button
        on:click={handleNextDay}
        disabled={selectedDay >= 8}
        class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        aria-label="Next day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button
        on:click={close}
        class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-800"
        aria-label="Close chart panel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="mt-0 hidden sm:grid sm:grid-cols-3 sm:gap-3">
      <label class="flex min-w-0 flex-col gap-1.5">
        <span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Model</span>
        <select
          id="model"
          bind:value={model}
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        >
          {#each models as weatherModel (weatherModel.id)}
            <option value={weatherModel.id}>{weatherModel.name}</option>
          {/each}
        </select>
      </label>

      <label class="flex min-w-0 flex-col gap-1.5">
        <span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Top height</span>
        <select
          id="altitude"
          bind:value={maxAltitude}
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        >
          {#each altitudes as alt}
            <option value={alt.value}>{alt.name}</option>
          {/each}
        </select>
      </label>

      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Grid cell selection</div>
        <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-50/70 p-1">
          {#each cellSelectionOptions as option (option.value)}
            <button
              type="button"
              class={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                cellSelection === option.value
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              aria-pressed={cellSelection === option.value}
              on:click={() => (cellSelection = option.value)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <div class="bg-white px-2 pt-3 pb-1 sm:px-4 sm:pt-4 sm:pb-0">
    <div class="mb-2 flex items-center justify-center">
      <div class="inline-flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          class={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            chartView === 'wind'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          on:click={() => handleViewChange('wind')}
        >
          Wind Chart
        </button>
        <button
          type="button"
          class={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            chartView === 'skewt'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          on:click={() => handleViewChange('skewt')}
        >
          Skew-T
        </button>
      </div>
    </div>

    {#if chartView === 'wind'}
      <WindChart {weatherData} {maxAltitude} {model} isLoading={isWeatherLoading} />
    {:else if skewTData && traceHours.length > 0}
      <div class="mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-slate-500">Time</span>
          <button
            on:click={prevTrace}
            disabled={selectedTraceIndex <= 0}
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous hour"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            type="range"
            min="0"
            max={traceHours.length - 1}
            value={selectedTraceIndex}
            on:input={handleSliderInput}
            class="h-2 flex-1 cursor-pointer rounded-lg bg-slate-200 accent-indigo-600"
          />
          <button
            on:click={nextTrace}
            disabled={selectedTraceIndex >= traceHours.length - 1}
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next hour"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span class="min-w-30 text-right text-xs font-medium text-slate-700">
            {formatDayHour(traceHours[selectedTraceIndex] ?? new Date())}
            <span class="text-slate-400"> {skewTData?.timezoneAbbr ?? ''}</span>
          </span>
        </div>
      </div>
      <SkewTChart {skewTData} {selectedTraceIndex} isLoading={isSkewTLoading} />
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
      <button
        on:click={handlePreviousDay}
        disabled={selectedDay <= -13}
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        aria-label="Previous day"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div class="min-w-0 flex-1">
        <div class="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Forecast</div>
        <div class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-slate-800">
          <span class="truncate">{getDayLabel(selectedDay)}</span>
          <span class="text-slate-300">•</span>
          <span class="truncate text-slate-600">
            {startDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        on:click={() => (showMobileSettings = !showMobileSettings)}
        aria-expanded={showMobileSettings}
        aria-controls="chart-mobile-settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6h18M7 12h10M10 18h4" />
        </svg>
        Settings
      </button>

      <button
        on:click={handleNextDay}
        disabled={selectedDay >= 8}
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        aria-label="Next day"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button
        on:click={close}
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-800"
        aria-label="Close chart panel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    {#if showMobileSettings}
      <div id="chart-mobile-settings" class="mt-2 grid grid-cols-1 gap-2">
        <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div class="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Location</div>
          <div class="mt-1 text-sm font-medium text-slate-800">{latitude.toFixed(4)}°, {longitude.toFixed(4)}°</div>
        </div>

        <label class="flex min-w-0 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <span class="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Model</span>
          <select
            id="model-mobile"
            bind:value={model}
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            {#each models as weatherModel (weatherModel.id)}
              <option value={weatherModel.id}>{weatherModel.name}</option>
            {/each}
          </select>
        </label>

        <div class="flex min-w-0 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div class="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Grid cell selection</div>
          <div class="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-50/70 p-1">
            {#each cellSelectionOptions as option (option.value)}
              <button
                type="button"
                class={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  cellSelection === option.value
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 active:text-slate-700'
                }`}
                aria-pressed={cellSelection === option.value}
                on:click={() => (cellSelection = option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        <label class="flex min-w-0 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <span class="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Top height</span>
          <select
            id="altitude-mobile"
            bind:value={maxAltitude}
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            {#each altitudes as alt}
              <option value={alt.value}>{alt.name}</option>
            {/each}
          </select>
        </label>
      </div>
    {/if}
  </div>
</div>
