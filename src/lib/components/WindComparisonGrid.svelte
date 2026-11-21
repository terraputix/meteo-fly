<script lang="ts">
  import type { SurfaceWindDay } from '#lib/api/api.js';
  import { COMPASS_MODELS, type CompassModel } from '#lib/api/models.js';
  import { windColorScale, windColors, windMaxSpeed } from '#lib/charts/scales.js';
  import { windRotation } from '#lib/charts/windChartLayout.js';
  import { fmtTime } from '#lib/helpers.js';
  import { describeSurfaceWind } from '#lib/meteo/surfaceWind.js';
  import { units } from '#lib/stores/units.js';
  import { windSpeed } from '#lib/utils/units.js';

  let {
    day,
    highlighted = $bindable(null),
    inspectedModels,
    failed,
    retry,
    hour = $bindable(0),
  }: {
    highlighted?: CompassModel | null;
    inspectedModels: CompassModel[];
    day: SurfaceWindDay | null;
    failed: boolean;
    retry: () => void;
    hour?: number;
  } = $props();
  let viewport = $state<HTMLDivElement>();
  const value = (n: number) => (Number.isFinite(n) ? Math.round(windSpeed(n, $units)) : '–');
  const visibleModels = $derived(
    COMPASS_MODELS.filter(({ id, regional }) => {
      if (!regional) return true;
      const readings = day?.models[id];
      return day?.time.some((time) => {
        const reading = readings?.get(+time);
        return reading && [reading.speed, reading.direction, reading.gust].some(Number.isFinite);
      });
    })
  );
  const outlineColor = $derived.by(() => {
    const time = day?.time[hour];
    if (!day || !time) return 'var(--color-slate-400)';
    const speeds = COMPASS_MODELS.map(({ id }) => day.models[id]?.get(+time)?.speed ?? NaN).filter(Number.isFinite);
    return speeds.length ? windColorScale(Math.max(...speeds)) : 'var(--color-slate-400)';
  });
  $effect(() => {
    if (!day || !viewport) return;
    const column = viewport.querySelector<HTMLElement>(`[data-hour="${hour}"]`);
    if (!column) return;
    const left = column.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
    const availableLeft = viewport.querySelector('th')?.offsetWidth ?? 0;
    if (left < availableLeft) viewport.scrollLeft += left - availableLeft;
    else if (left + column.offsetWidth > viewport.clientWidth)
      viewport.scrollLeft += left + column.offsetWidth - viewport.clientWidth;
  });
  $effect(() => {
    const [firstModel] = inspectedModels;
    if (!firstModel || !viewport) return;
    const row = viewport.querySelector<HTMLElement>(`[data-model="${firstModel}"]`);
    const scrollArea = viewport.closest<HTMLElement>('[data-chart-scroll]');
    if (!row || !scrollArea) return;
    const bounds = row.getBoundingClientRect();
    const visible = scrollArea.getBoundingClientRect();
    if (bounds.top < visible.top) scrollArea.scrollTop += bounds.top - visible.top;
    else if (bounds.bottom > visible.bottom) scrollArea.scrollTop += bounds.bottom - visible.bottom;
  });
</script>

{#if failed}
  <p role="alert" class="p-4 text-sm">
    Wind comparison could not load. <button class="underline" onclick={retry}>Retry</button>
  </p>
{:else if day}
  <div class="mb-1 flex items-baseline justify-between gap-2 px-1">
    <h2 class="text-sm font-semibold text-slate-800">
      {day.time[0].toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: day.timezone,
      })}
    </h2>
    <span class="text-xs text-slate-600">Wind / gust · {$units.wind}</span>
  </div>
  <div
    class="mb-1 flex items-center justify-end gap-1 px-1 text-[10px] text-slate-500"
    aria-label="Wind speed color scale"
  >
    <span>Wind color</span><span>0</span>
    <span aria-hidden="true" class="flex h-1.5 w-20 overflow-hidden rounded-full"
      >{#each windColors as color (color)}<span class="flex-1" style:background={color}></span>{/each}</span
    >
    <span>{value(windMaxSpeed - windMaxSpeed / windColors.length)}+ {$units.wind}</span>
  </div>
  <div bind:this={viewport} class="relative max-w-full overflow-x-auto">
    <table
      class="w-full border-separate border-spacing-0 text-center text-xs tabular-nums"
      aria-label="Hourly wind and preceding-hour peak gusts at 10 m"
    >
      <thead
        ><tr>
          <th class="sticky left-0 z-10 bg-white px-2 text-left text-slate-500">10 m</th>
          {#each day.time as time, i (+time)}
            <th
              data-hour={i}
              class="rounded-t border-x-2 border-t-2 bg-slate-50 text-slate-500"
              style:border-color={hour === i ? outlineColor : 'transparent'}
            >
              <button
                class="w-full py-1.5"
                aria-label={fmtTime(time, day.timezone, true)}
                aria-pressed={hour === i}
                onclick={() => (hour = i)}>{fmtTime(time, day.timezone)}</button
              >
            </th>
          {/each}
        </tr></thead
      >
      <tbody>
        {#each visibleModels as model (model.id)}
          <tr data-model={model.id}
            ><th
              scope="row"
              title={model.name}
              class="sticky left-0 z-10 border-b border-slate-100 bg-white px-2 text-left font-semibold whitespace-nowrap text-slate-700"
              ><button
                type="button"
                aria-label={`Highlight ${model.name} on the map`}
                aria-pressed={highlighted === model.id}
                class="py-1 text-left hover:underline"
                class:underline={highlighted === model.id}
                class:text-indigo-700={inspectedModels.includes(model.id)}
                onclick={() => (highlighted = highlighted === model.id ? null : model.id)}
              >
                {model.name}
              </button></th
            >
            {#each day.time as time, i (+time)}
              {@const reading = day.models[model.id]?.get(+time)}
              {@const speed = reading?.speed ?? NaN}
              {@const gust = reading?.gust ?? NaN}
              {@const wind = describeSurfaceWind(speed, reading?.direction ?? NaN, gust, $units)}
              <td
                class="min-w-12 border-x-2 border-b border-b-slate-100 p-0"
                style:border-inline-color={hour === i ? outlineColor : 'transparent'}
                style:border-bottom-color={hour === i && model.id === visibleModels.at(-1)?.id
                  ? outlineColor
                  : undefined}
                style:background-color={Number.isFinite(speed)
                  ? `color-mix(in srgb, ${windColorScale(speed)} 28%, white)`
                  : undefined}
              >
                <button
                  type="button"
                  class="block w-full py-0.5 leading-tight"
                  class:ring-2={inspectedModels.includes(model.id) && hour === i}
                  class:ring-inset={inspectedModels.includes(model.id) && hour === i}
                  style:--tw-ring-color={Number.isFinite(speed) ? windColorScale(speed) : 'var(--color-slate-400)'}
                  tabindex="-1"
                  aria-label={`${model.name}, ${fmtTime(time, day.timezone, true)}, ${wind.wind}, gust ${wind.gust}`}
                  onclick={() => (hour = i)}
                >
                  <span class="flex items-center justify-center gap-0.5 font-semibold">
                    {#if wind.bearing !== null}<svg
                        viewBox="0 0 12 12"
                        aria-hidden="true"
                        class="size-3"
                        style:transform={`rotate(${windRotation(wind.bearing)}rad)`}
                        ><path d="M6 1 10 10 6 8 2 10Z" fill="none" stroke="currentColor" /></svg
                      >{/if}
                    {value(speed)}
                  </span>
                  <span class="block text-[10px] text-slate-500">{value(gust)}</span>
                </button>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p role="status" class="p-4 text-sm text-slate-600">Loading wind comparison…</p>
{/if}
