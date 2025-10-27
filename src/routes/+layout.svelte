<script lang="ts">
  import '../app.css';
  let { children } = $props();
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
