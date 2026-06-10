<script lang="ts">
  let {
    selectedDay = $bindable(),
    startDate,
    hour = $bindable(0),
    traceHours = [],
    timezoneAbbr = '',
    maxForecastDays = 8,
    onclose = undefined,
  }: {
    selectedDay: number;
    startDate: Date;
    hour?: number;
    traceHours?: Date[];
    timezoneAbbr?: string;
    maxForecastDays?: number;
    onclose?: () => void;
  } = $props();

  function getDayLabel(day: number) {
    if (day === 1) return 'Today';
    if (day === 2) return 'Tomorrow';
    if (day === 0) return 'Yesterday';
    return day > 1 ? `+${day - 1} days` : `${day - 1} days`;
  }

  function handleNextDay(e: MouseEvent) {
    e.preventDefault();
    if (selectedDay < maxForecastDays) selectedDay += 1;
  }

  function handlePrevDay(e: MouseEvent) {
    e.preventDefault();
    if (selectedDay > -13) selectedDay -= 1;
  }

  function formatDayHour(date: Date): string {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function prevTrace() {
    if (hour > 0) {
      hour--;
    } else if (selectedDay > -13) {
      selectedDay--;
      hour = 23;
    }
  }

  function nextTrace() {
    if (hour < traceHours.length - 1) {
      hour++;
    } else if (selectedDay < maxForecastDays) {
      selectedDay++;
      hour = 0;
    }
  }

  function handleSliderInput(e: Event) {
    const target = e.target as HTMLInputElement;
    hour = parseInt(target.value);
  }
</script>

<div class="flex flex-col gap-1">
  {#if traceHours.length > 0}
    <div class="flex items-center gap-2 px-1">
      <span class="text-xs font-medium text-slate-500">Time</span>
      <button
        onclick={prevTrace}
        disabled={hour <= 0 && selectedDay <= -13}
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
        class="h-2 flex-1 cursor-pointer rounded-lg bg-slate-200 accent-indigo-600"
      />
      <button
        onclick={nextTrace}
        disabled={hour >= traceHours.length - 1 && selectedDay >= maxForecastDays}
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
      onclick={handlePrevDay}
      disabled={selectedDay <= -13}
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-10 sm:w-10"
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
          {startDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>

    <button
      onclick={handleNextDay}
      disabled={selectedDay >= maxForecastDays}
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-10 sm:w-10"
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
      onclick={() => onclose?.()}
      class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-800 sm:h-10 sm:w-10"
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
