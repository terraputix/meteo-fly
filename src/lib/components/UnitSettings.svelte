<script lang="ts">
  import { units } from '#lib/stores/units.js';
  import { UNIT_OPTIONS, METRIC_UNITS, IMPERIAL_UNITS, type UnitPreferences } from '#lib/utils/units.js';

  const labels = { wind: 'Wind', temperature: 'Temperature', altitude: 'Altitude', rain: 'Rain' };
  const keys = Object.keys(UNIT_OPTIONS) as (keyof UnitPreferences)[];
  const presets = [
    { label: 'Metric', units: METRIC_UNITS },
    { label: 'Imperial', units: IMPERIAL_UNITS },
  ];
</script>

<div class="flex flex-col gap-2.5">
  <div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Units</div>
  <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-50/70 p-1">
    {#each presets as preset (preset.label)}
      {@const selected = keys.every((key) => $units[key] === preset.units[key])}
      <button
        type="button"
        class="rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500"
        class:bg-white={selected}
        class:text-slate-900={selected}
        class:shadow-sm={selected}
        class:ring-1={selected}
        class:ring-slate-200={selected}
        class:text-slate-500={!selected}
        aria-pressed={selected}
        onclick={() => ($units = { ...preset.units })}
      >
        {preset.label}
      </button>
    {/each}
  </div>
  <div class="flex flex-col gap-2">
    {#each keys as key (key)}
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-slate-600">{labels[key]}</span>
        <div class="flex rounded-lg bg-slate-50 p-0.5" role="group" aria-label={`${labels[key]} units`}>
          {#each UNIT_OPTIONS[key] as unit (unit)}
            <button
              type="button"
              class="min-w-8 rounded-md px-1.5 py-1 text-[11px] font-medium transition hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500"
              class:bg-white={$units[key] === unit}
              class:text-slate-900={$units[key] === unit}
              class:shadow-sm={$units[key] === unit}
              class:text-slate-400={$units[key] !== unit}
              aria-pressed={$units[key] === unit}
              onclick={() => ($units = { ...$units, [key]: unit })}
            >
              {unit}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
