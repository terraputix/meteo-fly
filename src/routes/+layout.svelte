<script lang="ts">
  import '../app.css';
  let { children } = $props();
  import { weatherMapStore } from '$lib/services/weatherMap/store';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  $effect(() => {
    const state = $weatherMapStore;
    if (browser) {
      const url = new URL($page.url);
      if (state.domain) {
        url.searchParams.set('map_domain', state.domain.value);
      }
      if (state.baseVariable) {
        url.searchParams.set('map_variable', state.baseVariable);
      }
      if (state.level) {
        url.searchParams.set('map_level', state.level);
      } else {
        url.searchParams.delete('map_level');
      }
      if (state.datetime) {
        url.searchParams.set('map_datetime', state.datetime);
      }
      if (url.search !== $page.url.search) {
        history.replaceState({}, '', url);
      }
    }
  });
</script>

<svelte:head>
  <title>Meteo-Fly - Wind Forecast for Paragliding & Hang Gliding</title>
  <meta
    name="description"
    content="Professional wind forecast visualization for paragliders and hang gliders. Interactive wind charts for multiple meteorological models including ICON, GFS, UKMO, and MeteoFrance."
  />
  <meta
    name="keywords"
    content="paragliding wind forecast, hang gliding weather, wind speed chart, meteorological data, aviation weather"
  />

  <link rel="canonical" href="https://meteo-fly.com/" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <main class="flex-grow">
    {@render children()}
  </main>
</div>
