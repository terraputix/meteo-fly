<script lang="ts">
  let {
    hour = $bindable(0),
    selectedDay = $bindable(),
    traceHours,
    timezoneAbbr = '',
  }: {
    hour?: number;
    selectedDay: number;
    traceHours: Date[];
    timezoneAbbr?: string;
  } = $props();

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
    } else if (selectedDay < 8) {
      selectedDay++;
      hour = 0;
    }
  }

  function handleSliderInput(e: Event) {
    const target = e.target as HTMLInputElement;
    hour = parseInt(target.value);
  }
</script>

<div class="flex items-center gap-2">
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
    disabled={hour >= traceHours.length - 1 && selectedDay >= 8}
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
