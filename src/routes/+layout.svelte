<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { pwaInfo } from 'virtual:pwa-info';
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

  const webManifest = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

  let { children } = $props();

  onMount(async () => {
    if (pwaInfo) {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({
        immediate: true,
        onRegistered(r) {
          console.log(`SW Registered: ${r}`);
        },
        onRegisterError(error) {
          console.log('SW registration error', error);
        },
      });
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
