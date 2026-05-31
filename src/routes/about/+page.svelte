<script lang="ts">
  import { getLastVisitedURL } from '$lib/services/storage';

  const returnUrl = getLastVisitedURL() ?? '/';
</script>

<svelte:head>
  <title>Meteo-Fly About</title>
  <meta
    name="description"
    content="Meteo-Fly provides transparent, model-aware weather forecasts for paragliding and hang gliding with wind, cloud, and meteogram visualizations."
  />
  <meta property="og:title" content="Meteo-Fly About" />
  <meta
    property="og:description"
    content="Meteo-Fly provides transparent, model-aware weather forecasts for paragliding and hang gliding with wind, cloud, and meteogram visualizations."
  />
</svelte:head>

<div class="bg-slate-50 text-slate-900">
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pt-10 pb-16 sm:px-6 lg:px-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="max-w-2xl">
        <p class="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">About</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">About Meteo-Fly</h1>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          Meteo-Fly is built for transparent, model-aware weather interpretation for paragliding and hang gliding. It
          combines an interactive map with detailed meteogram panels for wind, cloud, rain, humidity, and lifted
          condensation level analysis.
        </p>
      </div>
      <!-- eslint-disable svelte/no-navigation-without-resolve -->
      <a
        href={returnUrl}
        class="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-widest text-slate-600 uppercase transition hover:border-slate-300 hover:text-slate-900"
      >
        Back to forecast
      </a>
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    </div>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-xl font-semibold text-slate-900">Why was Meteo-Fly created</h2>
      <p class="mt-3 text-sm text-slate-600 sm:text-base">
        I wanted a single chart that brings together all the information needed to assess a flight day: wind, cloud,
        rain, humidity, and the lifted condensation level, while letting me pick the forecast models I trust. That
        combination was missing from the tools available for paragliding and hang gliding. Additionally, most projects
        in this space come with some plan for monetization and transparency is limited because their code cannot be
        accessed. In comparison, Meteo-Fly is and will stay free and open-source. Meteo-Fly is a pet project I wanted to
        share, and Open-Meteo makes it possible.
      </p>
      <p class="mt-4 text-sm text-slate-600 sm:text-base">
        <strong>Full disclosure:</strong> I work for Open-Meteo in my day job.
      </p>
    </section>

    <section class="space-y-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">The meteogram panel</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          The meteogram panel shows a stack of charts covering wind, cloud cover, precipitation, humidity, and the
          lifted condensation level. You can show or hide the panel from the map view.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Wind arrows</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          In the wind chart, solid arrows correspond to wind data that comes directly from the model's native pressure
          levels. Transparent arrows are interpolated between those native levels to provide smoother vertical
          resolution. Treat the transparent arrows as helpful guidance rather than hard measurements.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Lifted Condensation Level (LCL)</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          The LCL line is calculated from surface temperature and dewpoint using Espy's approximation: <strong
            >LCL ≈ 125 × (T − Td)</strong
          > meters. The chart adds local terrain elevation to express the result as an altitude above sea level.
        </p>
        <div class="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 sm:text-base">
          <p class="font-semibold text-slate-700">When is this valid?</p>
          <ul class="mt-2 list-disc space-y-2 pl-5">
            <li>Best for a well-mixed boundary layer on convective days.</li>
            <li>Less reliable with inversions, frontal layers, or widespread stratiform cloud.</li>
            <li>Convective effects such as upvalley flows or thermal plumes are not captured by this estimate.</li>
          </ul>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Grid cell selection</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          Weather models provide data on a grid. Meteo-Fly lets you decide whether to always select the closest grid
          cell or whether a grid cell with a similar terrain height should be selected. The resulting grid cell, the
          model grid elevation, and the DEM elevation will be displayed on the map. Which mode is optimal depends on
          various factors, such as the model's grid resolution, the local terrain variability, and the conditions
          on a specific day (e.g. windward vs. leeward). Experiment with both modes to see which one provides
          more realistic forecasts for your location and conditions.
        </p>
        <ul class="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600 sm:text-base">
          <li>
            <strong>Terrain-aware</strong> favors land grid cells around the selected point with a similar elevation.
          </li>
          <li>
            <strong>Nearest</strong> always picks the closest grid cell, even if it sits over water or the elevation does
            not match.
          </li>
        </ul>
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
        <h2 class="text-xl font-semibold text-slate-900">Map tiles</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          Map tiles are served by two awesome projects: the base map uses
          <a href="https://openfreemap.com/" class="underline" target="_blank" rel="noopener noreferrer">OpenFreeMap</a
          >, while terrain and hillshade overlays come from
          <a href="https://mapterhorn.com/" class="underline" target="_blank" rel="noopener noreferrer">Mapterhorn</a>,
          an open-data project hosting high-resolution terrain tiles. Go check them out.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Data source</h2>
        <p class="mt-3 text-sm text-slate-600 sm:text-base">
          Meteo-Fly uses meteorological data from
          <a href="https://open-meteo.com/" class="underline" target="_blank" rel="noopener noreferrer">Open-Meteo</a>.
          All forecast data is fetched directly in the browser and cached locally for offline access via the service
          worker.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Limitations</h2>
        <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600 sm:text-base">
          <li>Mountain meteorology, valley circulations, and rotor effects are not resolved by global models.</li>
          <li>
            For some models, cloud cover is derived from model humidity profiles; thin orographic cloud can be missed.
          </li>
          <li>All forecasts are guidance only. Always combine with live observations and local knowledge.</li>
        </ul>
      </div>
    </section>
  </div>
</div>
