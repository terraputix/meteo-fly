<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { pwaInfo } from 'virtual:pwa-info';

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
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html webManifest}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Meteo-Fly" />
  <meta property="og:image" content="https://meteo-fly.com/icons/icon-512x512.png" />
  <meta name="twitter:card" content="summary" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <main class="flex-grow">
    {@render children()}
  </main>
</div>
