<script lang="ts">
  import { MIN_FORECAST_DAY, stepTimestep, type TimestepDirection } from '$lib/components/timestepNavigation';
  import type { ChartView } from '$lib/services/types';

  let {
    selectedDay = $bindable(),
    startDate,
    hour = $bindable(0),
    traceHours = [],
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
    timezone?: string;
    timezoneAbbr?: string;
    maxForecastDays?: number;
    chartView?: ChartView;
    keyboardNavigationEnabled?: boolean;
    onclose?: () => void;
  } = $props();

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
      <input
        type="range"
        min="0"
        max={traceHours.length - 1}
        value={hour}
        oninput={handleSliderInput}
        aria-label="Forecast time"
        aria-valuetext={`${formatDayHour(traceHours[hour] ?? new Date())} ${timezoneAbbr}`.trim()}
        class="h-2 flex-1 cursor-pointer rounded-lg bg-slate-200 accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
      />
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
