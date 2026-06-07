<script lang="ts">
  import type { CellSelection } from '$lib/api/types';
  import type { MaxAltitude } from '$lib/meteo/types';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import SettingsIcon from '@lucide/svelte/icons/settings';

  let {
    maxAltitude = $bindable<MaxAltitude>(4000),
    cellSelection = $bindable<CellSelection>('nearest'),
    daylightOnly = $bindable(false),
  }: {
    maxAltitude?: MaxAltitude;
    cellSelection?: CellSelection;
    daylightOnly?: boolean;
  } = $props();

  let open = $state(false);

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

<Popover.Root bind:open>
  <Popover.Trigger
    class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/92 shadow-lg backdrop-blur-md transition hover:bg-white"
    aria-label="Chart settings"
    title="Chart settings"
  >
    <span class="flex h-7 w-7 items-center justify-center text-slate-500" aria-hidden="true">
      <SettingsIcon class="h-5 w-5" />
    </span>
  </Popover.Trigger>

  <Popover.Content side="bottom" align="end" class="w-64 p-3" sideOffset={6}>
    <div class="flex flex-col gap-3">
      <label class="flex flex-col gap-1.5">
        <span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Top height</span>
        <select
          bind:value={maxAltitude}
          onchange={() => (open = false)}
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        >
          {#each altitudes as a (a.value)}
            <option value={a.value}>{a.name}</option>
          {/each}
        </select>
      </label>

      <div class="flex flex-col gap-1.5">
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
              onclick={() => {
                cellSelection = opt.value;
                open = false;
              }}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <label class="flex cursor-pointer items-center justify-between gap-3">
        <span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Daylight hours</span>
        <button
          type="button"
          role="switch"
          aria-checked={daylightOnly}
          aria-label="Toggle daylight hours only"
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors"
          class:bg-indigo-600={daylightOnly}
          class:bg-slate-200={!daylightOnly}
          onclick={() => {
            daylightOnly = !daylightOnly;
            open = false;
          }}
        >
          <span
            class="inline-block h-3.5 w-3.5 translate-x-0.5 transform rounded-full bg-white shadow-sm transition-transform"
            class:translate-x-[18px]={daylightOnly}
          ></span>
        </button>
      </label>
    </div>
  </Popover.Content>
</Popover.Root>
