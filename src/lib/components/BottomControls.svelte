<script lang="ts">
  import { MIN_FORECAST_DAY, stepTimestep, type TimestepDirection } from '$lib/components/timestepNavigation';
  import { THERMAL_TRIGGER_HEIGHT_AGL_METERS } from '$lib/meteo/thermal';
  import type { SkewTTrace } from '$lib/meteo/types';
  import type { ChartView } from '$lib/services/types';

  let {
    selectedDay = $bindable(),
    startDate,
    hour = $bindable(0),
    traceHours = [],
    thermalTraces = [],
    thermalTriggerTime = null,
    timezone = 'UTC',
    timezoneAbbr = '',
    maxForecastDays = 8,
    chartView = 'wind',
    keyboardNavigationEnabled = false,
    onclose = undefined,
  }: {
    selectedDay: number;
    startDate: Date;
    hour?: number;
    traceHours?: Date[];
    thermalTraces?: SkewTTrace[];
    thermalTriggerTime?: Date | null;
    timezone?: string;
    timezoneAbbr?: string;
    maxForecastDays?: number;
    chartView?: ChartView;
    keyboardNavigationEnabled?: boolean;
    onclose?: () => void;
  } = $props();

  let selectedThermalTrace = $derived(thermalTraces[hour] ?? null);
  let thermalTriggerIndex = $derived(
    thermalTriggerTime == null ? -1 : traceHours.findIndex((time) => time.getTime() === thermalTriggerTime.getTime())
  );

  function reachesThermalThreshold(trace: SkewTTrace): boolean {
    return (
      trace.thermal.topHeightAglMeters != null && trace.thermal.topHeightAglMeters >= THERMAL_TRIGGER_HEIGHT_AGL_METERS
    );
  }

  function formatTemperature(value: number): string {
    return Number.isFinite(value) ? `${value.toFixed(1)} °C` : '—';
  }

  function formatHeatingStatus(trace: SkewTTrace): string {
    if (reachesThermalThreshold(trace)) return 'Reached';
    const triggerTemperature = trace.thermal.triggerTemperature;
    if (!Number.isFinite(trace.surfaceTemp)) return 'Unavailable';
    if (triggerTemperature == null || !Number.isFinite(triggerTemperature)) return 'Outside profile';
    return `Needs +${Math.max(0, triggerTemperature - trace.surfaceTemp).toFixed(1)} °C`;
  }

  const keyboardNavigationExclusionSelector = [
    'a[href]',
    'input',
    'select',
    'textarea',
    'summary',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])',
    '[role="dialog"]',
    '.maplibregl-map',
  ].join(',');

  function getDayLabel(day: number) {
    if (day === 1) return 'Today';
    if (day === 2) return 'Tomorrow';
    if (day === 0) return 'Yesterday';
    return day > 1 ? `+${day - 1} days` : `${day - 1} days`;
  }

  function formatForecastDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    });
  }

  function applyTimestep(direction: TimestepDirection, activeView = chartView) {
    ({ selectedDay, hour } = stepTimestep({
      chartView: activeView,
      direction,
      selectedDay,
      hour,
      traceCount: traceHours.length,
      maxForecastDays,
    }));
  }

  function handleNextDay(e: MouseEvent) {
    e.preventDefault();
    applyTimestep(1, 'wind');
  }

  function handlePrevDay(e: MouseEvent) {
    e.preventDefault();
    applyTimestep(-1, 'wind');
  }

  function formatDayHour(date: Date): string {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
  }

  function prevTrace() {
    applyTimestep(-1, 'skewt');
  }

  function nextTrace() {
    applyTimestep(1, 'skewt');
  }

  function handleSliderInput(e: Event) {
    const target = e.target as HTMLInputElement;
    hour = parseInt(target.value);
  }

  function hasInteractiveKeyboardTarget(event: KeyboardEvent): boolean {
    return event
      .composedPath()
      .some((target) => target instanceof Element && target.matches(keyboardNavigationExclusionSelector));
  }

  function handleTimestepKeydown(event: KeyboardEvent) {
    if (
      !keyboardNavigationEnabled ||
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') ||
      hasInteractiveKeyboardTarget(event)
    ) {
      return;
    }

    event.preventDefault();
    applyTimestep(event.key === 'ArrowLeft' ? -1 : 1);
  }

  let timestepAnnouncement = $derived.by(() => {
    if (chartView === 'skewt' && traceHours.length > 0) {
      return `Forecast time ${formatDayHour(traceHours[hour] ?? new Date())} ${timezoneAbbr}`.trim();
    }
    return `Forecast ${getDayLabel(selectedDay)}, ${formatForecastDate(startDate)}`;
  });
</script>

<svelte:window onkeydown={handleTimestepKeydown} />

<div
  class="flex flex-col gap-1"
  role="group"
  aria-label="Forecast timestep controls"
  aria-keyshortcuts="ArrowLeft ArrowRight"
>
  <span class="sr-only" aria-live="polite" aria-atomic="true">{timestepAnnouncement}</span>
  {#if traceHours.length > 0}
    <div class="flex items-center gap-2 px-1">
      <span class="text-xs font-medium text-slate-500">Time</span>
      <button
        type="button"
        onclick={prevTrace}
        disabled={hour <= 0 && selectedDay <= MIN_FORECAST_DAY}
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous hour"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="relative h-4 min-w-0 flex-1">
        <input
          type="range"
          min="0"
          max={traceHours.length - 1}
          value={hour}
          oninput={handleSliderInput}
          aria-label="Forecast time"
          aria-valuetext={`${formatDayHour(traceHours[hour] ?? new Date())} ${timezoneAbbr}`.trim()}
          class="absolute top-0 left-0 h-2 w-full cursor-pointer rounded-lg bg-slate-200 accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
        />
        {#if chartView === 'skewt' && thermalTraces.length > 0}
          <div
            class="absolute right-0 bottom-0 left-0 flex h-1 overflow-hidden rounded-full bg-slate-100"
            role="img"
            aria-label="Orange hours reach 1.2 kilometres of dry lift"
            title="Orange hours reach 1.2 km of dry lift"
          >
            {#each thermalTraces as trace, index (`${trace.time.getTime()}-${index}`)}
              <span
                class="h-full flex-1"
                class:bg-orange-400={reachesThermalThreshold(trace)}
                class:bg-slate-200={!reachesThermalThreshold(trace)}
              ></span>
            {/each}
          </div>
          {#if thermalTriggerIndex >= 0 && traceHours.length > 1}
            <span
              class="absolute top-0 h-3 w-0.5 -translate-x-1/2 bg-orange-600"
              style:left={`${(thermalTriggerIndex / (traceHours.length - 1)) * 100}%`}
              title="First hour reaching 1.2 km of dry lift"
              aria-hidden="true"
            ></span>
          {/if}
        {/if}
      </div>
      <button
        type="button"
        onclick={nextTrace}
        disabled={hour >= traceHours.length - 1 && selectedDay >= maxForecastDays}
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next hour"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <span class="min-w-30 text-right text-xs font-medium text-slate-700">
        {formatDayHour(traceHours[hour] ?? new Date())}
        <span class="text-slate-400"> {timezoneAbbr}</span>
      </span>
    </div>
    {#if chartView === 'skewt' && selectedThermalTrace}
      <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-[10px] text-slate-500">
        <span>Surface {formatTemperature(selectedThermalTrace.surfaceTemp)}</span>
        <span class="text-slate-300">•</span>
        <span>
          Surface temp for {THERMAL_TRIGGER_HEIGHT_AGL_METERS / 1000} km lift
          {selectedThermalTrace.thermal.triggerTemperature == null
            ? '—'
            : formatTemperature(selectedThermalTrace.thermal.triggerTemperature)}
        </span>
        <span
          class="rounded-full px-1.5 py-0.5 font-semibold"
          class:bg-orange-100={reachesThermalThreshold(selectedThermalTrace)}
          class:text-orange-800={reachesThermalThreshold(selectedThermalTrace)}
          class:bg-slate-100={!reachesThermalThreshold(selectedThermalTrace)}
          class:text-slate-600={!reachesThermalThreshold(selectedThermalTrace)}
        >
          {formatHeatingStatus(selectedThermalTrace)}
        </span>
        {#if thermalTriggerTime}
          <span class="text-slate-400">First reached {formatDayHour(thermalTriggerTime)} {timezoneAbbr}</span>
        {/if}
      </div>
    {/if}
  {/if}

  <div
    class="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2 shadow-inner shadow-slate-100 sm:gap-3 sm:p-2.5"
  >
    <button
      type="button"
      onclick={handlePrevDay}
      disabled={selectedDay <= MIN_FORECAST_DAY}
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-10 sm:w-10"
      aria-label="Previous day"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5 sm:h-4 sm:w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <div class="min-w-0 flex-1">
      <div class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
        Forecast
      </div>
      <div class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-slate-800">
        <span class="truncate">{getDayLabel(selectedDay)}</span>
        <span class="text-slate-300">•</span>
        <span class="truncate text-slate-600">
          {formatForecastDate(startDate)}
        </span>
      </div>
    </div>

    <button
      type="button"
      onclick={handleNextDay}
      disabled={selectedDay >= maxForecastDays}
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-10 sm:w-10"
      aria-label="Next day"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5 sm:h-4 sm:w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>

    <button
      type="button"
      onclick={() => onclose?.()}
      class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:h-10 sm:w-10"
      aria-label="Close chart panel"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 sm:h-5 sm:w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</div>
