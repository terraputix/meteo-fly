<script lang="ts">
  import { flip } from 'svelte/animate';
  import { prefersReducedMotion } from 'svelte/motion';
  import { fade } from 'svelte/transition';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
  import { shortcutMode, type TimestepDirection, type TimestepMode } from '#lib/components/timestepNavigation.js';
  import {
    buildForecastTimeline,
    dayJumpIndex,
    layoutForecastRail,
    forecastIndexAt,
  } from '#lib/components/forecastTimeline.js';
  import { fmtTime } from '#lib/helpers.js';

  let {
    date,
    hour,
    times,
    timezone,
    showHours,
    canStep,
    onStep,
    day,
    maxDay,
    onSelect,
  }: {
    date?: Date;
    hour: number;
    times: Date[];
    timezone?: string;
    showHours: boolean;
    canStep: (mode: TimestepMode, direction: TimestepDirection) => boolean;
    onStep: (mode: TimestepMode, direction: TimestepDirection) => void;
    day: number;
    maxDay: number;
    onSelect: (day: number, hour: number, timestamp?: Date) => void;
  } = $props();

  const dayLabel = $derived(
    date?.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone })
  );
  const timeLabel = $derived(times[hour] && timezone ? fmtTime(times[hour], timezone, true) : '');
  const selectionLabel = $derived([dayLabel, showHours && timeLabel].filter(Boolean).join(' '));

  let innerWidth = $state(0);
  const rail = $derived(
    date && timezone
      ? buildForecastTimeline(date, timezone, day, maxDay, showHours ? times : undefined, innerWidth)
      : null
  );
  const weekday = $derived(new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: timezone }));
  const shortDate = $derived(
    new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: timezone })
  );
  const selected = $derived(
    Math.max(0, rail?.slots.findIndex((slot) => slot.day === day && (!showHours || slot.hour === hour)) ?? 0)
  );
  let width = $state(0);
  const segments = $derived(
    rail && width && innerWidth ? layoutForecastRail(rail, (width - innerWidth) / (2 * width)) : []
  );
  const railStart = $derived(segments[0]?.left ?? 0);
  const railEnd = $derived(
    segments.length ? segments[segments.length - 1].left + segments[segments.length - 1].width : 1
  );
  function fractionAt(index: number) {
    const segment = segments.find(({ start, count }) => index >= start && index < start + count);
    return segment ? segment.left + ((index - segment.start + 0.5) / segment.count) * segment.width : 0;
  }
  function percentAt(index: number) {
    return (100 * (fractionAt(index) - railStart)) / (railEnd - railStart);
  }
  let hover = $state<number | null>(null);
  let draft = $state<number | null>(null);
  const position = $derived(draft ?? selected);
  const previewIndex = $derived(draft ?? hover);
  const preview = $derived(rail?.slots[previewIndex ?? -1]);
  const previewLabel = $derived(
    preview && timezone
      ? preview.time.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: timezone,
        }) + (showHours ? ' · ' + fmtTime(preview.time, timezone, true) : '')
      : ''
  );

  function previewPointer(event: PointerEvent & { currentTarget: HTMLInputElement }) {
    const bounds = event.currentTarget.getBoundingClientRect();
    hover = forecastIndexAt(
      segments,
      railStart + ((event.clientX - bounds.left) / bounds.width) * (railEnd - railStart)
    );
  }

  function commit(index: number) {
    const slot = rail?.slots[index];
    draft = null;
    hover = null;
    if (slot) onSelect(slot.day, showHours ? slot.hour : hour, showHours ? slot.time : undefined);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) ||
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof Element &&
            !target.matches(
              'button[data-forecast-hour], [data-forecast-timeline] button, [data-forecast-timeline] input'
            ) &&
            target.matches(
              'a, button, input, select, textarea, summary, [contenteditable], [tabindex]:not([tabindex="-1"]), [role="dialog"], .maplibregl-map'
            )
        )
    )
      return;

    const mode = shortcutMode(event.key, showHours);
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1;
    if (canStep(mode, direction)) {
      event.preventDefault();
      onStep(mode, direction);
    } else if (event.target instanceof HTMLInputElement) {
      event.preventDefault();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet arrow(mode: TimestepMode, direction: TimestepDirection)}
  {@const Icon = mode === 'day' ? ChevronsRight : ChevronRight}
  {@const label = `${direction === 1 ? 'Next' : 'Previous'} ${mode}`}
  <button
    type="button"
    class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-30"
    aria-label={label}
    title={label}
    disabled={!canStep(mode, direction)}
    onclick={() => onStep(mode, direction)}
  >
    <Icon class={direction === -1 ? 'size-4 rotate-180' : 'size-4'} aria-hidden="true" />
  </button>
{/snippet}

<div
  class="relative mx-auto flex min-h-9 w-full items-center border-t border-slate-400 px-1 pb-1 text-sm tabular-nums"
  bind:clientWidth={width}
  role="group"
  aria-label="Forecast day and time"
  data-forecast-timeline
>
  <span class="sr-only" aria-live="polite">{selectionLabel}</span>
  {@render arrow('day', -1)}
  {#if showHours}{@render arrow('hour', -1)}{/if}
  <div class="grid min-w-0 flex-1 self-stretch" bind:clientWidth={innerWidth}>
    {#if rail}
      <div
        class="grid items-stretch overflow-hidden pt-2 pb-0.5"
        style:grid-template-columns={`repeat(${rail.visibleDays}, minmax(0, 1fr))`}
      >
        {#each rail.innerDayStarts as start (rail.slots[start].day)}
          {@const slot = rail.slots[start]}
          {@const target = showHours && timezone ? dayJumpIndex(rail, start, selected, timezone) : start}
          <button
            type="button"
            style:grid-column={slot.day - rail.innerFirstDay + 1}
            animate:flip={{ duration: prefersReducedMotion.current ? 0 : 150 }}
            in:fade={{ duration: prefersReducedMotion.current ? 0 : 150 }}
            aria-current={slot.day === day ? 'date' : undefined}
            aria-label={`Jump to ${weekday.format(slot.time)} ${shortDate.format(slot.time)}${showHours && timezone ? ` at ${fmtTime(rail.slots[target].time, timezone, true)}` : ''}`}
            onpointerenter={() => (hover = target)}
            onpointerleave={() => (hover = null)}
            onfocus={() => (hover = target)}
            onblur={() => (hover = null)}
            onclick={() => commit(target)}
            class="min-h-6 min-w-0 cursor-pointer rounded-sm text-center hover:bg-indigo-50 hover:text-indigo-800 focus-visible:bg-indigo-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 text-[11px] leading-tight {slot.day ===
            day
              ? 'font-semibold text-indigo-800'
              : 'text-slate-600'}"
          >
            <span
              class="flex justify-center gap-x-1 {showHours ? 'flex-wrap items-baseline' : 'flex-col items-center'}"
            >
              <span>{slot.day === 1 ? 'Today' : weekday.format(slot.time)}</span>
              <small class="text-[10px]">{shortDate.format(slot.time)}</small>
            </span>
            {#if showHours && slot.day === day}
              <span class="block text-[11px]">{timeLabel || '—:—'}</span>
            {/if}
          </button>
        {/each}
      </div>
      {#if segments.length}
        <div
          class="group absolute top-0 z-10 h-0"
          style:left={100 * railStart + '%'}
          style:right={100 * (1 - railEnd) + '%'}
        >
          <div class="pointer-events-none absolute inset-x-0 -top-px h-px">
            {#each segments as segment (segment.start)}
              <span
                class="absolute top-0 h-[3px] w-px bg-slate-400"
                style:left={(100 * (segment.left - railStart)) / (railEnd - railStart) + '%'}
              ></span>
            {/each}
            {#if previewIndex !== null && previewIndex !== position}
              <span
                class="absolute top-1/2 size-2 -translate-1/2 rounded-full border border-indigo-600 bg-white"
                style:left={percentAt(previewIndex) + '%'}
              ></span>
            {/if}
            <span
              class="absolute top-1/2 size-2 -translate-1/2 rounded-full bg-indigo-600 ring-1 ring-white group-hover:scale-125"
              style:left={percentAt(position) + '%'}
            ></span>
          </div>
          <input
            type="range"
            class="peer absolute inset-x-0 -top-3 m-0 h-5 touch-pan-y w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:w-px [&::-webkit-slider-thumb]:w-px [&::-webkit-slider-thumb]:appearance-none"
            aria-label={showHours ? 'Forecast timestamp' : 'Forecast day'}
            aria-valuetext={draft !== null ? previewLabel : selectionLabel}
            min={railStart}
            max={railEnd}
            step="any"
            value={fractionAt(position)}
            onpointerenter={previewPointer}
            onpointermove={previewPointer}
            onpointerleave={() => (hover = null)}
            onpointercancel={() => {
              draft = null;
              hover = null;
            }}
            onblur={() => {
              draft = null;
              hover = null;
            }}
            oninput={(event) => (draft = forecastIndexAt(segments, event.currentTarget.valueAsNumber))}
            onchange={(event) => commit(forecastIndexAt(segments, event.currentTarget.valueAsNumber))}
          />
          <span
            class="pointer-events-none absolute inset-x-0 -top-px hidden h-px outline-2 outline-indigo-600 peer-focus-visible:block"
          ></span>
          {#if previewLabel}
            <span
              aria-hidden="true"
              class="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white shadow"
              style:left={'clamp(min(6rem, 50%), ' + percentAt(previewIndex ?? 0) + '%, max(50%, calc(100% - 6rem)))'}
            >
              {previewLabel}
            </span>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
  {#if showHours}{@render arrow('hour', 1)}{/if}
  {@render arrow('day', 1)}
</div>
