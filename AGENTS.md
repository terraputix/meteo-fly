# Agents.md — meteo-fly

## Project Overview

**meteo-fly** is a browser-based weather visualization tool for paragliders and hang gliders. It combines an interactive map with a detailed meteogram panel for wind, cloud, rain, humidity, and cloud-base analysis.

- **Framework**: SvelteKit 3 with Svelte 5 and TypeScript
- **Styling**: Tailwind CSS v4
- **UI primitives**: `shadcn-svelte` for some more complex UI components built on reusable primitives
- **Charts**: Canvas 2D renderers with pure chart-preparation and layout helpers
- **Map**: MapLibre GL 6 with a bundled ES module worker (requires WebGL 2)
- **PWA**: SvelteKit-built Workbox service worker, static web manifest, and browser service-worker registration
- **Data**: Open-Meteo REST API via the `openmeteo` npm package
- **Deployment**: Static client build with `@sveltejs/adapter-static`
- **Tests**: Vitest

---

## Repository Layout

- `src/routes/+layout.svelte`: global shell, metadata, PWA registration, and update/offline status
- `src/service-worker/index.ts`: app-shell navigation, precaching, weather fallback, and bounded map runtime caches
- `src/routes/+page.svelte`: main page state, URL sync, and weather fetch lifecycle
- `src/lib/api/`: Open-Meteo API integration, request config, and response types
- `src/lib/meteo/`: pure meteorological calculations and altitude/pressure helpers
- `src/lib/charts/`: pure chart data preparation/layout and Canvas 2D drawing
- `src/lib/workers/`: Web Workers and pure preparation helpers for off-main-thread chart and Hike & Fly processing
- `src/lib/components/`: UI components including map, chart, legend, footer, and layout pieces
- `src/lib/components/ui/`: shared `shadcn-svelte`-style UI primitives such as `switch` and `resizable`
- `src/lib/services/`: defaults, URL/storage persistence, and location/geolocation state
- `src/lib/stores/`: lightweight app stores such as media-query state
- `src/lib/utils/`: general utility helpers such as date manipulation
- `static/`: static assets including PWA icons and other public files
- `.github/workflows/`: CI and deployment automation

---

## Core Architecture

- **Single-page client app**: Keep everything browser-compatible. Do not introduce server runtime files.
- **State source of truth**: Page parameters drive selected location, day, model, and max altitude; they are mirrored to URL params and persisted locally.
- **Data flow**: `+page.svelte` fetches weather data, passes it into `ChartContainer.svelte`, then `WindChart.svelte` offloads heavy chart preparation to `src/lib/workers/chartWorker.ts`.
- **Worker split**: Expensive chart shaping and Hike & Fly terrain/raster processing belong in pure helpers or workers, not in UI components.
- **Chart stack**: Reuse existing chart builders and tooltip/state helpers before adding new rendering abstractions.
- **Forecast models**: Supported models are defined canonically in `src/lib/api/types.ts`; UI selectors must stay aligned with that union.
- **PWA**: Registration and update UI live in `+layout.svelte`; precache inputs come from `$app/manifest`; navigation
  fallback and runtime caching live in `src/service-worker/index.ts`. The worker has its own TypeScript project.

---

## Guiding Principles & Conventions

### General Rules

- **Be brief**: Keep responses concise.
- **DRY**: Reuse existing types, constants, helpers, and chart/meteo utilities.
- **No useless comments**: Avoid obvious comments and change/implementation summaries in code.
- **Simplicity**: Prefer small functions and direct component changes over extra abstractions.
- **Keep docs current**: Update this file when project architecture or conventions materially change.

### Coding Style

- **Svelte 5**: Prefer runes-style APIs for new or refactored Svelte code when consistent with the file.
- **TypeScript**: No `any`. Reuse existing domain types from `src/lib/api/types.ts`, `src/lib/meteo/types.ts`, and service types.
- **Styling**: Prefer Tailwind utility classes. For more complex UI building blocks, prefer existing `shadcn-svelte` components in `src/lib/components/ui/` before creating custom primitives. Avoid adding `<style>` blocks unless an existing component already uses one and a utility-only approach is impractical.
- **Imports**: Use `#lib/` subpath imports with file extensions for project imports. Avoid relative parent imports.
- **Worker-safe purity**: Meteorological and chart-preparation/layout helpers stay deterministic and worker-safe. Canvas renderers draw only to explicitly supplied contexts; DOM access and scheduling belong in components.
- **Charts**: Reuse existing Canvas 2D renderers, shared colors, sizing, and meteorological helpers.

### Testing & Quality

- **Unit tests**: New pure logic in `src/lib/meteo/`, `src/lib/api/`, or other pure utility modules should include corresponding Vitest coverage.
- **Validation**: After meaningful changes, run `npm run check`, `npm run lint`, and `npm test` when practical.
- **Formatting**: Follow project formatting preferences from Prettier/ESLint: single quotes and 120-char width.

---

## Making Changes

### Adding or Updating a Weather Model

1. Update the `WeatherModel` union in `src/lib/api/types.ts`.
2. Update API variable/model configuration in `src/lib/api/variables.ts` and related API logic if needed.
3. Update model selectors in `src/lib/components/ChartContainer.svelte`.
4. Verify any model-specific chart or data assumptions still hold.

### Map & Location

- Map UI lives primarily in `src/lib/components/LocationMap.svelte` and `src/lib/components/Controls.ts`.
- MapLibre uses named imports and a Vite `?worker&url` bundle configured with `setWorkerUrl`; the worker is precached in `src/service-worker/index.ts`.
- Location state and geolocation behavior live in `src/lib/services/location/`.

### Charting

- UI container: `src/lib/components/ChartContainer.svelte`
- Canvas lifecycle, interaction, and worker orchestration: `src/lib/components/WindChart.svelte`
- Wind layout/hit testing: `src/lib/charts/windChartLayout.ts`; drawing: `src/lib/charts/windChartRenderer.ts`
- Wind chart uses a base canvas plus a separate crosshair canvas; resize reuses prepared data.
- Wind cloud cover is interpolated in the chart worker and rendered with a faint base band for positive cover and stronger 25/50/75% contour bands in a cached RGBA raster. Missing observations, 0% cover, and areas below model ground (DEM fallback) remain transparent.
- Worker entrypoint: `src/lib/workers/chartWorker.ts`
- Pure chart builders/helpers: `src/lib/charts/`

### Shared UI Primitives

- For some more complex UI components, use `shadcn-svelte` primitives from `src/lib/components/ui/`.
- Existing examples include `src/lib/components/ui/switch/switch.svelte` and the resizable panel components in `src/lib/components/ui/resizable/`.
- When adding a new `shadcn-svelte` component, use the library CLI to generate it into `src/lib/components/ui/`, then adapt the generated files to the project's conventions such as `#lib/` imports, existing styling patterns, and Svelte 5 usage where appropriate.
- Prefer extending generated `shadcn-svelte` primitives locally instead of duplicating or reimplementing the same component patterns elsewhere in the app.

### PWA / Metadata

- The web manifest lives in `static/manifest.webmanifest`; SvelteKit builds the worker using `$app/manifest`.
- App-shell navigation and runtime cache policies are handled in `src/service-worker/index.ts`.
- `runed`'s optional SvelteKit peer is overridden to the application version; the UI uses its framework-independent helpers.
- Registration, update prompts, offline status, and document head metadata are handled in `src/routes/+layout.svelte`.
- Installation events are observed by `src/lib/services/serviceWorkerRegistration.ts`.

---

## Commands

```sh
npm install
npm run dev
npm run build
npm run preview
npm run check
npm run lint
npm run format
npm test
```

---

## What to Avoid

- **No server runtime**: Do not add `+server.ts`, `+page.server.ts`, or server-only dependencies.
- **No charting bloat**: Use focused Canvas 2D renderers; avoid generic chart frameworks or scene graphs.
- **No side effects in pure modules**: Keep meteo/chart preparation and layout deterministic and worker-friendly; isolate drawing in renderers.
- **No new state libraries**: Stick to Svelte state/stores and existing service modules.
- **No unnecessary dependencies**: Add packages only when clearly justified.
- **No hardcoded duplicated domain data**: Reuse canonical model lists, pressure/altitude definitions, and shared colors/helpers.
