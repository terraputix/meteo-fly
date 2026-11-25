<script lang="ts">
  import type { TimestepDirection, TimestepMode } from '#lib/components/timestepNavigation.js';
  import { fmtTime } from '#lib/helpers.js';

  let {
    date,
    hour,
    times,
    timezone,
    showHours,
    singleRow = false,
    canStep,
    onStep,
    onHourChange,
  }: {
    date?: Date;
    hour: number;
    times: Date[];
    timezone?: string;
    showHours: boolean;
    singleRow?: boolean;
    canStep: (mode: TimestepMode, direction: TimestepDirection) => boolean;
    onStep: (mode: TimestepMode, direction: TimestepDirection) => void;
    onHourChange: (hour: number) => void;
  } = $props();

  const dayLabel = $derived(
    date?.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone })
  );
  const timeLabel = $derived(times[hour] && timezone ? fmtTime(times[hour], timezone, true) : '');
  const buttonClass =
    'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-white hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-30';
  let controls: HTMLDivElement;
  let hourPickerOpenedWithPointer = false;

  function handleHourChange(event: Event & { currentTarget: HTMLSelectElement }) {
    onHourChange(Number(event.currentTarget.value));
    if (hourPickerOpenedWithPointer) controls.focus({ preventScroll: true });
    hourPickerOpenedWithPointer = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') ||
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof Element &&
            !target.matches('button[data-forecast-hour], [data-forecast-timeline] button') &&
            target.matches(
              'a, button, input, select, textarea, summary, [contenteditable], [tabindex]:not([tabindex="-1"]), [role="dialog"], .maplibregl-map'
            )
        )
    )
      return;
    const mode = showHours ? 'hour' : 'day';
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    if (!canStep(mode, direction)) return;
    event.preventDefault();
    onStep(mode, direction);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet chevron(next: boolean, day = false)}
  <svg viewBox="0 0 16 16" fill="none" class="size-4" aria-hidden="true">
    <path
      d={day
        ? next
          ? 'm3 3 5 5-5 5m5-10 5 5-5 5'
          : 'm13 3-5 5 5 5m-5-10-5 5 5 5'
        : next
          ? 'm6 3 5 5-5 5'
          : 'm10 3-5 5 5 5'}
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

<div
  bind:this={controls}
  class="mx-auto flex w-fit max-w-full items-center rounded-lg bg-slate-100/90 p-0.5 text-sm tabular-nums"
  role="group"
  aria-label="Forecast day and time"
  tabindex="-1"
  data-forecast-timeline
>
  <span class="sr-only" aria-live="polite">{dayLabel} {timeLabel}</span>
  <button
    type="button"
    class={buttonClass}
    aria-label="Previous day"
    title="Previous day"
    disabled={!canStep('day', -1)}
    onclick={() => onStep('day', -1)}
  >
    {@render chevron(false, true)}
  </button>
  {#if showHours}
    <button
      type="button"
      class={buttonClass}
      aria-label="Previous hour"
      title="Previous hour"
      disabled={!canStep('hour', -1)}
      onclick={() => onStep('hour', -1)}
    >
      {@render chevron(false)}
    </button>
  {/if}

  <div class="flex min-w-0 items-center justify-center gap-x-1 px-0.5 text-center" class:flex-wrap={!singleRow}>
    <span class="font-medium text-slate-800" class:truncate={singleRow} title={singleRow ? dayLabel : undefined}>
      {dayLabel ?? '—'}
    </span>
    {#if showHours}
      <select
        class="max-w-full min-w-0 cursor-pointer rounded-md px-1 py-0.5 font-semibold text-indigo-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-default disabled:opacity-50"
        class:shrink-0={singleRow}
        aria-label="Forecast time"
        disabled={!times.length}
        value={times.length ? hour : ''}
        onpointerdown={() => (hourPickerOpenedWithPointer = true)}
        onkeydown={() => (hourPickerOpenedWithPointer = false)}
        onblur={() => (hourPickerOpenedWithPointer = false)}
        onchange={handleHourChange}
      >
        {#if times.length && timezone}
          {#each times as time, index (+time)}
            <option value={index}>{fmtTime(time, timezone, true)}</option>
          {/each}
        {:else}
          <option value="">—:—</option>
        {/if}
      </select>
    {/if}
  </div>

  {#if showHours}
    <button
      type="button"
      class={buttonClass}
      aria-label="Next hour"
      title="Next hour"
      disabled={!canStep('hour', 1)}
      onclick={() => onStep('hour', 1)}
    >
      {@render chevron(true)}
    </button>
  {/if}
  <button
    type="button"
    class={buttonClass}
    aria-label="Next day"
    title="Next day"
    disabled={!canStep('day', 1)}
    onclick={() => onStep('day', 1)}
  >
    {@render chevron(true, true)}
  </button>
</div>
