<script lang="ts">
  let {
    children,
    heading,
    body,
  }: {
    children?: import('svelte').Snippet;
    heading?: import('svelte').Snippet;
    body?: import('svelte').Snippet;
  } = $props();
</script>

<div class="mx-auto flex w-full max-w-3xl shrink-0 flex-col px-4 py-4">
  <div class="flex items-center justify-between gap-2">
    <div>
      {#if heading}
        {@render heading()}
      {:else if children}
        {@render children()}
      {/if}
    </div>
    <a
      href="https://open-meteo.com/"
      target="_blank"
      class="shrink-0 text-[0.65rem] text-slate-400 underline transition-colors hover:text-slate-600"
    >
      Weather data by Open-Meteo.com
    </a>
  </div>
  {#if body}
    {@render body()}
  {/if}
</div>
