<script lang="ts">
  let {
    selectedDay = $bindable(),
    startDate,
    onclose = undefined,
    compact = false,
  }: {
    selectedDay: number;
    startDate: Date;
    onclose?: () => void;
    compact?: boolean;
  } = $props();

  function getDayLabel(day: number) {
    if (day === 1) return 'Today';
    if (day === 2) return 'Tomorrow';
    if (day === 0) return 'Yesterday';
    return day > 1 ? `+${day - 1} days` : `${day - 1} days`;
  }

  function handleNext(e: MouseEvent) {
    e.preventDefault();
    if (selectedDay < 8) selectedDay += 1;
  }

  function handlePrev(e: MouseEvent) {
    e.preventDefault();
    if (selectedDay > -13) selectedDay -= 1;
  }

  const btnCls =
    'inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300';
  const closeCls =
    'inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-800';
</script>

<button
  onclick={handlePrev}
  disabled={selectedDay <= -13}
  class={btnCls}
  class:h-9={compact}
  class:h-10={!compact}
  class:w-9={compact}
  class:w-10={!compact}
  aria-label="Previous day"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
  </svg>
</button>

<div class="min-w-0 flex-1">
  <div
    class="text-xs font-semibold text-slate-500 uppercase"
    class:tracking-[0.18em]={!compact}
    class:tracking-[0.16em]={compact}
    class:text-[10px]={compact}
  >
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
  onclick={handleNext}
  disabled={selectedDay >= 8}
  class={btnCls}
  class:h-9={compact}
  class:h-10={!compact}
  class:w-9={compact}
  class:w-10={!compact}
  aria-label="Next day"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
  </svg>
</button>

<button
  onclick={() => onclose?.()}
  class={closeCls}
  class:h-8={compact}
  class:h-10={!compact}
  class:w-8={compact}
  class:w-10={!compact}
  aria-label="Close chart panel"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class={compact ? 'h-4 w-4' : 'h-5 w-5'}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>
