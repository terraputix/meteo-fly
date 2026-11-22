<script lang="ts">
  import type { ForecastFailure } from '#lib/api/forecastFailure.js';

  let {
    failure,
    retry,
    class: className = '',
  }: {
    failure: ForecastFailure;
    retry?: () => void;
    class?: string;
  } = $props();
</script>

<div
  role="alert"
  class="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 {className}"
>
  <div class="min-w-0 wrap-anywhere">
    <p class="font-semibold">{failure.message}</p>
    {#if failure.detail}
      <p class="mt-1 text-xs">{failure.detail}</p>
    {/if}
  </div>
  {#if retry}
    <button
      type="button"
      class="shrink-0 rounded-md bg-red-700 px-3 py-1.5 font-medium text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      onclick={retry}
    >
      Retry
    </button>
  {/if}
</div>
