<script lang="ts">
  import { windColors, windMaxSpeed } from '$lib/charts/scales';

  const cloudGradient =
    'linear-gradient(to right, rgba(100,120,145,0), rgba(100,120,145,0.45) 50%, rgba(100,120,145,0.85))';

  const step = 100 / windColors.length;
  const windGradient = `linear-gradient(to right, ${windColors
    .flatMap((color, i) => {
      const start = (i * step).toFixed(1) + '%';
      const end = ((i + 1) * step).toFixed(1) + '%';
      return [`${color} ${start}`, `${color} ${end}`];
    })
    .join(', ')})`;
</script>

<div
  class="mx-auto flex max-w-3xl flex-wrap justify-center gap-x-10 gap-y-4 p-4 opacity-60 transition-opacity hover:opacity-100"
>
  <!-- Cloud Scale -->
  <div class="flex min-w-36 flex-1 basis-44 items-center gap-3">
    <span class="text-[0.65rem] tracking-wide whitespace-nowrap text-slate-400 uppercase">
      Clouds <small class="lowercase opacity-60">%</small>
    </span>
    <div class="flex flex-1 flex-col gap-[3px]">
      <div class="h-[5px] w-full rounded-full border border-slate-200" style="background: {cloudGradient};"></div>
      <div class="flex justify-between font-mono text-[0.6rem] text-slate-300">
        <span>0</span><span>100</span>
      </div>
    </div>
  </div>

  <!-- Wind Scale -->
  <div class="flex min-w-36 flex-1 basis-44 items-center gap-3">
    <span class="text-[0.65rem] tracking-wide whitespace-nowrap text-slate-400 uppercase">
      Wind <small class="lowercase opacity-60">km/h</small>
    </span>
    <div class="flex flex-1 flex-col gap-[3px]">
      <div class="h-[5px] w-full rounded-full" style="background: {windGradient};"></div>
      <div class="flex justify-between font-mono text-[0.6rem] text-slate-300">
        <span>0</span><span>{windMaxSpeed}</span>
      </div>
    </div>
  </div>
</div>
