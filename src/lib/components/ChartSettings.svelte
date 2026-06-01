<script lang="ts">
  import type { CellSelection, WeatherModel } from '$lib/api/types';
  import type { MaxAltitude } from '$lib/meteo/types';

  let {
    model = $bindable<WeatherModel>('icon_d2'),
    maxAltitude = $bindable<MaxAltitude>(4000),
    cellSelection = $bindable<CellSelection>('nearest'),
    latitude,
    longitude,
  }: {
    model?: WeatherModel;
    maxAltitude?: MaxAltitude;
    cellSelection?: CellSelection;
    latitude?: number;
    longitude?: number;
  } = $props();

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
</script>

<label class="flex min-w-0 flex-col gap-1.5">
  <span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Model</span>
  <select
    bind:value={model}
    class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
  >
    {#each models as m (m.id)}
      <option value={m.id}>{m.name}</option>
    {/each}
  </select>
</label>

<label class="flex min-w-0 flex-col gap-1.5">
  <span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Top height</span>
  <select
    bind:value={maxAltitude}
    class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
  >
    {#each altitudes as a (a.value)}
      <option value={a.value}>{a.name}</option>
    {/each}
  </select>
</label>

<div class="flex min-w-0 flex-col gap-1.5">
  <div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Grid cell selection</div>
  <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-50/70 p-1">
    {#each cellSelectionOptions as opt (opt.value)}
      <button
        type="button"
        class="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
        class:bg-white={cellSelection === opt.value}
        class:text-slate-900={cellSelection === opt.value}
        class:shadow-sm={cellSelection === opt.value}
        class:ring-1={cellSelection === opt.value}
        class:ring-slate-200={cellSelection === opt.value}
        class:text-slate-500={cellSelection !== opt.value}
        class:hover:text-slate-700={cellSelection !== opt.value}
        aria-pressed={cellSelection === opt.value}
        onclick={() => (cellSelection = opt.value)}
      >
        {opt.label}
      </button>
    {/each}
  </div>
</div>

{#if latitude != null && longitude != null}
  <div class="flex min-w-0 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <div class="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Location</div>
    <div class="mt-1 text-sm font-medium text-slate-800">{latitude.toFixed(4)}°, {longitude.toFixed(4)}°</div>
  </div>
{/if}
