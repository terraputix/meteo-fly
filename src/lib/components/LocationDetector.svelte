<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { locationStore, locationActions, isLocationAvailable } from '$lib/services/location/store';
  import { createEventDispatcher } from 'svelte';
  import type { Location } from '$lib/api/types';

  const dispatch = createEventDispatcher<{
    locationDetected: Location;
  }>();

  export let autoDetect = false;
  export let showButton = true;
  export let buttonText = 'Use My Location';
  export let size: 'sm' | 'md' | 'lg' = 'md';

  let mounted = false;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  $: if (mounted && $locationStore.current && $isLocationAvailable) {
    dispatch('locationDetected', $locationStore.current);
  }

  async function handleDetectLocation() {
    try {
      await locationActions.detectLocation();
    } catch (error) {
      console.error('Location detection failed:', error);
    }
  }

  function handleClearError() {
    locationActions.clearError();
  }

  onMount(() => {
    mounted = true;
    if (autoDetect && $locationStore.isSupported && !$locationStore.current) {
      handleDetectLocation();
    }
  });

  onDestroy(() => {
    locationActions.stopWatching();
  });
</script>

{#if showButton && $locationStore.isSupported}
  <div class="flex flex-col items-center gap-2">
    <button
      type="button"
      on:click={handleDetectLocation}
      disabled={$locationStore.isDetecting}
      class="flex items-center gap-2 rounded bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400 {sizeClasses[
        size
      ]}"
    >
      {#if $locationStore.isDetecting}
        <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span>Detecting...</span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{buttonText}</span>
      {/if}
    </button>

    {#if $locationStore.error}
      <div class="flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span>{$locationStore.error}</span>
        <button
          type="button"
          on:click={handleClearError}
          class="ml-2 text-red-500 hover:text-red-700"
          aria-label="Clear error"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/if}

    {#if $locationStore.current && $locationStore.accuracy}
      <div class="text-xs text-gray-500">
        Accuracy: ±{Math.round($locationStore.accuracy)}m
      </div>
    {/if}
  </div>
{:else if !$locationStore.isSupported}
  <div class="flex items-center gap-2 rounded bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
    <span>Location detection not supported</span>
  </div>
{/if}
