<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { pwaInfo } from 'virtual:pwa-info';

  const webManifest = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

  let { children } = $props();

  let needRefresh = $state(false);
  let offlineReady = $state(false);
  let isOffline = $state(false);
  let isUpdating = $state(false);
  let updateError = $state<string | null>(null);
  let updateServiceWorker: (() => Promise<void>) | undefined;
  let offlineReadyTimer: ReturnType<typeof setTimeout> | undefined;
  const UPDATE_TIMEOUT_MS = 15_000;

  function showOfflineReady() {
    offlineReady = true;
    clearTimeout(offlineReadyTimer);
    offlineReadyTimer = setTimeout(() => {
      offlineReady = false;
    }, 6000);
  }

  function activateWaitingServiceWorker() {
    return new Promise<void>((resolve, reject) => {
      const handleControllerChange = () => {
        cleanup();
        resolve();
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for the updated service worker to take control'));
      }, UPDATE_TIMEOUT_MS);
      const cleanup = () => {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      void updateServiceWorker!().catch((error) => {
        cleanup();
        reject(error);
      });
    });
  }

  async function applyUpdate() {
    if (!updateServiceWorker || isUpdating) return;
    isUpdating = true;
    updateError = null;

    try {
      await activateWaitingServiceWorker();
      needRefresh = false;
      window.location.reload();
    } catch (error) {
      console.error('Service worker update error', error);
      updateError = 'The update could not be applied. Please try again.';
      isUpdating = false;
    }
  }

  onMount(() => {
    let destroyed = false;

    const updateOnlineStatus = () => {
      isOffline = !navigator.onLine;
    };

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    if (pwaInfo) {
      void import('virtual:pwa-register').then(({ registerSW }) => {
        if (destroyed) return;
        updateServiceWorker = registerSW({
          immediate: false,
          onNeedRefresh() {
            needRefresh = true;
            updateError = null;
          },
          onOfflineReady() {
            showOfflineReady();
          },
          onRegisteredSW(_url, registration) {
            console.log(`SW Registered: ${registration}`);
          },
          onRegisterError(error) {
            console.error('SW registration error', error);
          },
        });
      });
    }

    return () => {
      destroyed = true;
      clearTimeout(offlineReadyTimer);
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
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

{#if needRefresh || offlineReady || isOffline}
  <div
    class="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-100 flex flex-col items-center gap-2"
    aria-live="polite"
  >
    {#if needRefresh}
      <div
        class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-xl backdrop-blur-md"
        role="status"
      >
        <span class="min-w-0 flex-1" class:text-red-700={updateError}>
          {updateError ?? 'A new version is ready.'}
        </span>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          onclick={() => (needRefresh = false)}
          disabled={isUpdating}
        >
          Later
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
          onclick={applyUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? 'Updating…' : 'Update'}
        </button>
      </div>
    {/if}

    {#if isOffline}
      <div
        class="pointer-events-auto w-full max-w-md rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-2.5 text-center text-sm text-amber-800 shadow-lg backdrop-blur-md"
        role="status"
      >
        Offline — cached forecasts and previously viewed map areas remain available.
      </div>
    {:else if offlineReady}
      <div
        class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-2.5 text-sm text-emerald-800 shadow-lg backdrop-blur-md"
        role="status"
      >
        <span class="min-w-0 flex-1">Ready for offline use.</span>
        <button
          type="button"
          class="rounded-lg px-2 py-1 font-medium transition hover:bg-emerald-100"
          onclick={() => (offlineReady = false)}
          aria-label="Dismiss offline-ready notification"
        >
          Dismiss
        </button>
      </div>
    {/if}
  </div>
{/if}
