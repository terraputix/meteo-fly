<script lang="ts">
  import { getLastVisitedURL } from '$lib/services/storage';

  const returnUrl = getLastVisitedURL() ?? '/';
</script>

<svelte:head>
  <title>Meteo-Fly Help - How to Read the Forecast</title>
  <meta
    name="description"
    content="Help and interpretation notes for Meteo-Fly wind, cloud, and meteogram visualizations for paragliding and hang gliding."
  />
  <meta property="og:title" content="Meteo-Fly Help - How to Read the Forecast" />
  <meta
    property="og:description"
    content="Help and interpretation notes for Meteo-Fly wind, cloud, and meteogram visualizations for paragliding and hang gliding."
  />
</svelte:head>

<div class="bg-slate-50 text-slate-900">
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pt-10 pb-16 sm:px-6 lg:px-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="max-w-2xl">
        <p class="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Help</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">How to read Meteo-Fly</h1>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          Meteo-Fly is built for transparent, model-aware weather interpretation for paragliding and hang gliding. Below
          you will find what each visualization means, how it is derived, and where the limitations are.
        </p>
      </div>
      <a
        href={returnUrl}
        class="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-widest text-slate-600 uppercase transition hover:border-slate-300 hover:text-slate-900"
      >
        Back to forecast
      </a>
    </div>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-xl font-semibold text-slate-900">What Meteo-Fly focuses on</h2>
      <ul class="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600 sm:text-base">
        <li>Transparent communication of available meteorological data for free flight.</li>
        <li>Side-by-side multi-model comparisons to spot consensus and uncertainty.</li>
        <li>A practical workflow for planning launches and cross-country routes.</li>
      </ul>
      <p class="mt-4 text-sm text-slate-600 sm:text-base">
        More features are on the way. This help page will grow as new layers and tools are added.
      </p>
    </section>

    <section class="space-y-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Transparent wind arrows</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          In the wind chart, solid arrows correspond to wind data that comes directly from the model’s native pressure
          levels. Transparent arrows are interpolated between those native levels to provide smoother vertical
          resolution. Treat the transparent arrows as helpful guidance rather than hard measurements.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Cloud base line (LCL estimate)</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          The cloud-base line is calculated from surface temperature and dewpoint using Espy’s approximation for the
          lifting condensation level (LCL): <strong>LCL ≈ 125 × (T − Td)</strong> meters. The chart adds local terrain elevation
          to express the result as an altitude above sea level.
        </p>
        <div class="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 sm:text-base">
          <p class="font-semibold text-slate-700">When is this valid?</p>
          <ul class="mt-2 list-disc space-y-2 pl-5">
            <li>Best for a well-mixed boundary layer on convective days.</li>
            <li>Less reliable with inversions, frontal layers, or widespread stratiform cloud.</li>
            <li>Local moisture sources, terrain flows, and valley inversions can shift the real cloud base.</li>
          </ul>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Grid cell selection</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          Models provide data on a grid. Meteo-Fly lets you decide how to choose the grid cell when your location sits
          between land and water or rugged terrain.
        </p>
        <ul class="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600 sm:text-base">
          <li><strong>Terrain-aware</strong> favors land grid cells around the selected point.</li>
          <li><strong>Nearest</strong> always picks the closest grid cell, even if it sits over water.</li>
        </ul>
        <p class="mt-4 text-sm text-slate-600 sm:text-base">
          For free flight, terrain-aware selection usually matches launch reality better, but coastal and lake sites can
          benefit from the nearest mode.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Multi-model comparison</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          Each model has its own grid resolution, vertical levels, and physics. Use the model selector to compare trends
          instead of looking for exact agreement. When models converge, confidence is higher; when they diverge, expect
          variability in the real world.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Limitations to keep in mind</h2>
        <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600 sm:text-base">
          <li>Mountain meteorology, valley circulations, and rotor effects are not resolved by global models.</li>
          <li>Cloud cover is derived from model humidity profiles; thin orographic cloud can be missed.</li>
          <li>All forecasts are guidance only. Always combine with live observations and local knowledge.</li>
        </ul>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">What’s next</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          Planned features include deeper thermal diagnostics, launch and landing overlays, and clearer uncertainty
          cues. If you have feedback, feel free to open an issue on GitHub.
        </p>
      </div>
    </section>
  </div>
</div>
