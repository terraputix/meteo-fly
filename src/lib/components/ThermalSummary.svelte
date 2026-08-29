<script lang="ts">
  import type { WeatherModel } from '$lib/api/types';
  import type { SkewTTrace } from '$lib/meteo/types';

  let { trace, model }: { trace: SkewTTrace; model: WeatherModel } = $props();

  let thermal = $derived(trace.thermal);

  function roundHeight(height: number): number {
    return Math.round(height / 50) * 50;
  }

  function formatTop(): string {
    if (thermal.topHeightAglMeters == null) return 'Not triggered';
    return `${thermal.topIsAboveProfile ? '> ' : ''}${roundHeight(thermal.topHeightAglMeters)} m AGL`;
  }

  function formatIndex(): string {
    const value = thermal.minimumThermalIndex;
    if (value == null || !Number.isFinite(value)) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)} °C`;
  }

  function formatCloudPotential(): string {
    if (thermal.reachesLcl === true) return 'Cumulus possible';
    if (thermal.reachesLcl === false) return 'Likely blue';
    return 'Undetermined';
  }

  function formatStrength(): string {
    const value = trace.thermalStrength?.convectiveVelocityScale;
    return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)} m/s`;
  }
</script>

<section
  class="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2"
  aria-label="Thermal potential"
>
  <div class="flex items-center gap-2">
    <h3 class="text-[10px] font-semibold tracking-wide text-orange-950 uppercase">Thermal potential</h3>
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <a
      href="/about#thermal-potential"
      class="text-[10px] text-orange-800/70 underline decoration-orange-300 underline-offset-2 hover:text-orange-900"
    >
      Method
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  </div>

  <dl class="flex flex-1 flex-wrap items-center justify-end gap-x-5 gap-y-1 text-xs">
    <div class="flex items-baseline gap-1.5">
      <dt class="text-slate-500">Dry lift</dt>
      <dd class="font-semibold text-slate-800">{formatTop()}</dd>
    </div>
    <div class="flex items-baseline gap-1.5">
      <dt class="text-slate-500">Minimum TI</dt>
      <dd class="font-mono font-semibold text-slate-800">{formatIndex()}</dd>
    </div>
    <div class="flex items-baseline gap-1.5">
      <dt class="text-slate-500">Cloud</dt>
      <dd class="font-semibold text-slate-800">{formatCloudPotential()}</dd>
    </div>
    {#if model === 'gfs_seamless'}
      <div
        class="flex items-baseline gap-1.5"
        title="Deardorff convective velocity scale from mixed-resolution GFS fields; not an expected vario reading"
      >
        <dt class="text-slate-500">GFS w*</dt>
        <dd class="font-mono font-semibold text-orange-800">
          {formatStrength()}
          {#if trace.thermalStrength}
            <span class="font-sans font-normal text-slate-500">
              · BL {roundHeight(trace.thermalStrength.boundaryLayerHeightAglMeters)} m
            </span>
          {/if}
        </dd>
      </div>
    {/if}
  </dl>
</section>
