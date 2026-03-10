# Agents.md — meteo-fly

## Project Overview
**meteo-fly** is a browser-based meteogram visualization tool for paragliders and hang gliders. It provides interactive wind and cloud data visualizations for chosen locations.

- **Framework**: SvelteKit (Svelte 5) with TypeScript
- **Styling**: Tailwind CSS v4
- **Charting**: Observable Plot + D3.js
- **Map**: MapLibre GL + PMTiles (hillshade terrain, custom tile protocol)
- **Data**: Open-Meteo REST API via the `openmeteo` npm package
- **Deployment**: Static site on Cloudflare Pages via `@sveltejs/adapter-static`
- **Tests**: Vitest (`npm test`)

---

## Repository Layout
- `src/app.html` / `app.css` / `app.d.ts`: SvelteKit shell
- `src/routes/`: Main application routes (`+page.svelte` is the core UI)
- `src/lib/api/`: Open-Meteo API interaction, types, and variable configurations
- `src/lib/meteo/`: Meteorological logic (wind interpolation, cloud base calculations)
- `src/lib/charts/`: Data preparation and scales for Observable Plot
- `src/lib/workers/`: Web Worker for off-main-thread heavy computation
- `src/lib/components/`: Svelte components (Map, WindChart, Controls, UI primitives)
- `src/lib/services/`: State management (URL persistence, localStorage, geolocation)
- `src/utils/`: General helper functions

---

## Core Architecture
- **Single Source of Truth**: All state (`lat`, `lon`, `model`, `day`) lives in `PageParameters`, mirrored to URL search params and `localStorage`.
- **Data Flow**: `+page.svelte` fetches data → passed to `WindChart.svelte` → processed in a Web Worker → rendered via Observable Plot.
- **Vertical Profile**: Data at 9 discrete pressure levels (1000 to 600 hPa) interpolated to metric heights.
- **Static Only**: No server-side logic (`+page.server.ts`). All logic must be browser/worker compatible.

---

## Guiding Principles & Conventions

### General Rules
- **Be brief**: Keep responses concise.
- **DRY**: Reuse existing types, scales, and pressure level definitions.
- **No useless comments**: Avoid basic code comments or "implemented change" summaries.
- **Simplicity**: Prefer plain functions or short components over new abstractions.

### Coding Style
- **Svelte 5**: Use runes (`$props`, `$state`, `$derived`, `$effect`).
- **TypeScript**: No `any`. Use existing types in `lib/api/types.ts` and `lib/meteo/types.ts`.
- **Styling**: Use Tailwind utility classes; avoid `<style>` blocks.
- **Imports**: Use `$lib/` path aliases. No relative parent imports.
- **Worker-Safe**: Pure functions in `lib/meteo/` and `lib/charts/` must not use browser globals.

### Testing & Quality
- **Unit Tests**: Pure functions in `lib/meteo/` or `lib/api/` must have a corresponding `.test.ts`.
- **Prettier/ESLint**: Follow project formatting (single quotes, 120-char width). Run `npm run lint` and `npm run check`.

---

## Making Changes

### Adding a Weather Model
1. Update `WeatherModel` union in `lib/api/types.ts`.
2. Add config to `variableConfig.modelSpecific` in `variables.ts`.
3. Add entry to `models` array in `Controls.svelte`.

### Map & Location
- Map logic: `LocationMap.svelte` and `LocationControl.ts`.
- State: `lib/services/location/store.ts` (use `locationActions`).

---

## Commands
```sh
npm install      # Install dependencies
npm run dev      # Local dev server
npm run build    # Production build (output: build/)
npm run preview  # Preview build locally
npm run check    # svelte-check + tsc
npm run lint     # prettier + eslint
npm run format   # auto-format
npm test         # Run unit tests
```

---

## What to Avoid
- **No server runtime**: Do not add `+server.ts` or `+page.server.ts`.
- **No side effects**: Keep chart/meteo logic pure for Web Worker compatibility.
- **No new state libs**: Stick to Svelte stores and URL params.
- **No bloat**: Avoid adding npm dependencies unless absolutely necessary.
- **No hardcoding**: Use canonical files for coordinates, pressure levels, and colors.
