<script lang="ts">
  import type { WeatherModel } from '$lib/api/types';
  import { MODEL_OPTIONS, type ModelOption } from '$lib/api/models';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import GridIcon from '@lucide/svelte/icons/grid-2x2';
  import CheckIcon from '@lucide/svelte/icons/check';

  let {
    model = $bindable<WeatherModel>('icon_d2'),
  }: {
    model?: WeatherModel;
  } = $props();

  let open = $state(false);

  let currentName = $derived(MODEL_OPTIONS.find((m) => m.id === model)?.name ?? model);

  function select(m: ModelOption) {
    model = m.id;
    open = false;
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/92 px-2.5 py-2 text-left text-slate-700 shadow-lg backdrop-blur-md transition hover:bg-white"
    aria-label="Select weather model"
    title="Select weather model"
  >
    <span
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
      aria-hidden="true"
    >
      <GridIcon class="h-4 w-4" />
    </span>
    <span class="min-w-0 max-w-28 truncate text-xs font-semibold text-slate-800">{currentName}</span>
  </Popover.Trigger>

  <Popover.Content side="bottom" align="start" class="w-56 p-1.5" sideOffset={6}>
    <div class="text-xs font-semibold tracking-wide text-slate-500 uppercase px-2 py-1.5">Select Model</div>
    <div class="mt-0.5 flex flex-col gap-0.5">
      {#each MODEL_OPTIONS as m (m.id)}
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition"
          class:bg-indigo-50={model === m.id}
          class:text-indigo-700={model === m.id}
          class:hover:bg-slate-100={model !== m.id}
          class:text-slate-700={model !== m.id}
          onclick={() => select(m)}
        >
          <span class="flex h-4 w-4 shrink-0 items-center justify-center">
            {#if model === m.id}
              <CheckIcon class="h-4 w-4 text-indigo-600" />
            {/if}
          </span>
          <span class="font-medium">{m.name}</span>
        </button>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>
