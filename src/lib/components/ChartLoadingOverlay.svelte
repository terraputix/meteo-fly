<script lang="ts">
  let {
    visible,
    message,
  }: {
    visible: boolean;
    message: string;
  } = $props();
</script>

<div
  class="pointer-events-none absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 transition-opacity duration-200"
  class:opacity-100={visible}
  class:opacity-0={!visible}
  aria-hidden={!visible}
>
  <div class="h-10 w-10 animate-spin rounded-full border-4 border-[#f3f3f3] border-t-indigo-600"></div>
  <p>{message}</p>
</div>
