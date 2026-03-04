# Agents.md — meteo-fly

## Project Overview

**meteo-fly** is a browser-based meteogram visualization tool for paragliders and hang gliders. It shows useful meteograms for a chosen location.

- **Framework**: SvelteKit (Svelte 5) with TypeScript
- **Styling**: Tailwind CSS v4
- **Charting**: Observable Plot + D3
- **Map**: MapLibre GL + PMTiles (hillshade terrain, custom tile protocol)
- **Data**: Open-Meteo REST API via the `openmeteo` npm package
- **Deployment**: Static site on Cloudflare Pages via `@sveltejs/adapter-static` (fallback: `404.html`)
- **Service Worker**: registered at build time for offline-first caching
- **Tests**: Vitest (`npm test`)

---

## Repository Layout

```
src/
  app.html / app.css / app.d.ts   # SvelteKit shell
  service-worker.ts               # SW registration
  routes/
    +layout.svelte                # <head> meta, root shell
    +layout.ts                    # (empty – reserved)
    +page.ts                      # load(): redirect to last URL if no params
    +page.svelte                  # Root page: map + controls + chart panel
  lib/
    api/
      types.ts                    # Core domain types (Location, WeatherModel, VerticalProfile, HourlyData…)
      variables.ts                # Variable definitions & model-specific overrides (VariableConfig)
      api.ts                      # fetchWeatherData(), createQueryParams(), createHourlyParams()
      api.test.ts
    meteo/
      types.ts                    # PressureLevel, WindData
      wind.ts                     # getUComponent, getVComponent, interpolateWind
      wind.test.ts
      cloudBase.ts                # calculateCloudBaseWeather() — Espy's LCL equation
    charts/
      pressureLevels.ts           # pressureLevels[], interpolatedLevels[], allLevels[], getAtLevel()
      wind.ts                     # getWindFieldAllLevels()
      clouds.ts                   # getCloudCoverData()
      scales.ts                   # D3/Plot colour & stroke scales
    workers/
      chartWorker.types.ts        # Input/output message types for the Web Worker
      chartWorker.ts              # Web Worker: heavy data prep (runs off main thread)
    components/
      WindChart.svelte            # Observable Plot render via Svelte action + Web Worker
      ChartContainer.svelte       # Day navigation, close button, wraps WindChart
      Controls.svelte             # Model selector, day input, "Show Chart" button
      LocationMap.svelte          # MapLibre map, draggable marker, click-to-place
      LocationControl.ts          # IControl implementation for GPS button
      Legend.svelte               # Observable Plot legend (wind speed, cloud cover)
      Footer.svelte               # Copyright + GitHub link
      ui/                         # shadcn-svelte primitives (ResizablePane*)
    services/
      types.ts                    # PageParameters interface
      defaults.ts                 # Default location (Andermatt, CH), model, day
      url.ts                      # readURLParams()
      storage.ts                  # localStorage last-URL persistence
      location/
        geolocation.ts            # Browser Geolocation API wrapper
        store.ts                  # Svelte writable store + locationActions
        index.ts                  # Re-exports
    icons/
      RainIcons.ts                # Custom canvas rain-drop symbols for Observable Plot
  utils/
    dateExtensions.ts             # addDays(), addSeconds()
```

---

## Architecture Decisions

### State & URL
All user-selectable state (`latitude`, `longitude`, `selectedModel`, `selectedDay`) lives in a single `PageParameters` object in `+page.svelte`. It is **always mirrored to URL search params** (`?lat=&lon=&day=&model=`) and to `localStorage` (last visited URL) so the page is fully bookmarkable and restores on reload.

### Data Flow
```
+page.svelte
  → fetchWeatherData()          (lib/api/api.ts)  — HTTP to Open-Meteo
  → WeatherDataType             (lib/api/types.ts)
  → WindChart.svelte (Svelte action)
      → Web Worker (chartWorker.ts)               — heavy CPU work off-thread
          → getCloudCoverData()
          → getWindFieldAllLevels()
          → calculateCloudBaseWeather()
          → prepareTemperatureData / RainCloudData / WindChartData
      ← ChartWorkerSuccessOutput
  → Observable Plot (three stacked SVG plots)
```

### Pressure Levels → Metres
All vertical data is stored at 9 discrete pressure levels (1000 → 600 hPa). `pressureLevels.ts` maps each to an approximate height in metres. Additional `interpolatedLevels` at round-number heights are linearly interpolated from adjacent pressure levels in `getWindFieldAllLevels()`.

### Weather Models
Supported models: `icon_seamless`, `icon_d2`, `icon_eu`, `icon_global`, `gfs_seamless`, `meteofrance_seamless`, `ukmo_seamless`, `gem_seamless`, `cma_grapes_global`. Model-specific extra variables (e.g. `verticalVelocityProfile` for `gfs_seamless`) are declared in `variableConfig.modelSpecific` in `variables.ts`.

---

## Coding Conventions

- **TypeScript everywhere** — no `any`, use the types already defined in `lib/api/types.ts` and `lib/meteo/types.ts` before adding new ones.
- **Keep it simple and small** — prefer a plain function or a short Svelte component over a new abstraction. If a new utility is ≤5 lines, add it to the nearest existing file before creating a new file.
- **DRY** — reuse `pressureLevels`, `allLevels`, `getAtLevel()`, and the existing scales. Do not duplicate pressure-level arrays or colour definitions.
- **No side-effectful imports** — pure functions in `lib/meteo/` and `lib/charts/` must remain free of Svelte/browser globals so they can run inside the Web Worker and in tests.
- **Svelte 5 runes** — new components should use `$props()`, `$state()`, `$derived()`, `$effect()`.
- **Tailwind utility classes** — do not add `<style>` blocks to components unless they require CSS features unavailable in Tailwind (e.g. `@keyframes`, complex `:global()` overrides for third-party libraries).
- **Path aliases** — always import via `$lib/…` (never relative `../../lib/…`).
- **Tests** — any pure function in `lib/meteo/` or `lib/api/` should have a corresponding Vitest test alongside it. Run `npm test` to verify.

---

## Making Changes

### Changing the map or location handling
- Map logic lives exclusively in `LocationMap.svelte` and `LocationControl.ts`.
- Location state is managed by `lib/services/location/store.ts`. Prefer `locationActions` over direct store mutation.

### Adding a new weather model
1. Add the string literal to the `WeatherModel` union in `lib/api/types.ts`.
2. Add an entry to `variableConfig.modelSpecific` in `variables.ts` (empty array `[]` if it uses only default variables).
3. Add a `{ id, name }` entry to the `models` array in `Controls.svelte`.

### Modifying URL / persistence behaviour
- URL encoding/decoding: `lib/services/url.ts`
- localStorage: `lib/services/storage.ts`
- Redirect-on-load: `src/routes/+page.ts`

---

## Commands

```sh
npm run dev          # local dev server
npm run build        # production build (static, output: build/)
npm run preview      # preview the production build locally
npm run check        # svelte-check + tsc
npm run lint         # prettier + eslint
npm run format       # auto-format
npm test             # vitest (unit tests)
```

The build output in `build/` is deployed as-is to Cloudflare Pages. The `BASE_PATH` environment variable is injected at build time for path-prefixed deployments; leave it unset for root deployments.

---

## What to Avoid

- Do **not** add a server-side `+page.server.ts` or `+server.ts` — this is a fully static site; there is no server runtime.
- Do **not** use `fetch` or browser APIs directly inside `lib/charts/` or `lib/meteo/` — they must stay worker/test-safe.
- Do **not** introduce a new state management library; the existing Svelte store in `location/store.ts` and the `PageParameters` object in `+page.svelte` are sufficient.
- Do **not** add new npm dependencies without a clear justification — the bundle is already large (MapLibre, D3, Observable Plot). Prefer reusing what is already imported.
- Do **not** hardcode coordinates, pressure levels, or colour values outside their canonical definition files (`defaults.ts`, `pressureLevels.ts`, `scales.ts`).
