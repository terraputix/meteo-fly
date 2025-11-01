<script lang="ts">
  import { weatherMapStore, weatherMapManager } from '$lib/services/weatherMap/store';
  import { onDestroy } from 'svelte';

  let timeIndex = 0;
  let isPlaying = false;
  let interval: ReturnType<typeof globalThis.setInterval>;

  $: if ($weatherMapStore.domainInfo) {
    timeIndex = $weatherMapStore.domainInfo.valid_times.indexOf($weatherMapStore.datetime);
  }

  function handleTimeChange(event: Event) {
    const newIndex = parseInt((event.target as HTMLInputElement).value, 10);
    if ($weatherMapStore.domainInfo) {
      weatherMapManager.setDatetime($weatherMapStore.domainInfo.valid_times[newIndex]);
    }
  }

  function play() {
    isPlaying = true;
    interval = globalThis.setInterval(() => {
      stepForward();
    }, 1000);
  }

  function pause() {
    isPlaying = false;
    globalThis.clearInterval(interval);
  }

  function togglePlay() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function stepForward() {
    if ($weatherMapStore.domainInfo) {
      console.log('blub');
      const nextIndex = timeIndex + 1;
      if (nextIndex < $weatherMapStore.domainInfo.valid_times.length) {
        weatherMapManager.setDatetime($weatherMapStore.domainInfo.valid_times[nextIndex]);
      } else {
        // Loop back to start
        weatherMapManager.setDatetime($weatherMapStore.domainInfo.valid_times[0]);
      }
    }
  }

  function stepBackward() {
    if ($weatherMapStore.domainInfo) {
      const prevIndex = timeIndex - 1;
      if (prevIndex >= 0) {
        weatherMapManager.setDatetime($weatherMapStore.domainInfo.valid_times[prevIndex]);
      } else {
        // Loop to end
        const lastIndex = $weatherMapStore.domainInfo.valid_times.length - 1;
        weatherMapManager.setDatetime($weatherMapStore.domainInfo.valid_times[lastIndex]);
      }
    }
  }

  function stepDayForward() {
    weatherMapManager.jumpToNextDay();
  }

  function stepDayBackward() {
    weatherMapManager.jumpToPreviousDay();
  }

  onDestroy(() => {
    clearInterval(interval);
  });
</script>

{#if $weatherMapStore.domainInfo}
  <div class="time-slider-container">
    <div class="controls">
      <button on:click={stepDayBackward}>&lt;&lt; Day</button>
      <button on:click={stepBackward}>&lt;&lt;</button>
      <button on:click={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
      <button on:click={stepForward}>&gt;&gt;</button>
      <button on:click={stepDayForward}>Day &gt;&gt;</button>
    </div>
    <div class="slider">
      <input
        type="range"
        min="0"
        max={$weatherMapStore.domainInfo.valid_times.length - 1}
        step="1"
        bind:value={timeIndex}
        on:input={handleTimeChange}
      />
    </div>
    <div class="time-label">
      <span>{new Date($weatherMapStore.datetime).toLocaleString()}</span>
    </div>
  </div>
{/if}

<style>
  .time-slider-container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: rgba(255, 255, 255, 0.7);
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    z-index: 10;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    transition: background-color 0.3s ease;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
  }

  .controls button {
    background-color: #fff;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  .controls button:hover {
    background-color: #f9fafb;
    border-color: #6b7280;
  }

  .controls button:active {
    transform: translateY(1px);
    box-shadow: none;
  }

  .slider {
    flex-grow: 1;
  }

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    background: #d1d5db;
    border-radius: 9999px;
    outline: none;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  input[type='range']:hover {
    opacity: 1;
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: #3b82f6;
    cursor: pointer;
    border-radius: 9999px;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  input[type='range']::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: #3b82f6;
    cursor: pointer;
    border-radius: 9999px;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .time-label {
    min-width: 150px;
    text-align: center;
    font-family: monospace;
    font-size: 0.875rem;
    color: #4b5563;
    background-color: rgba(255, 255, 255, 0.5);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  @media (max-width: 640px) {
    .time-slider-container {
      flex-direction: column;
      padding: 0.5rem;
      gap: 0.5rem;
    }

    .time-label {
      font-size: 0.75rem;
      min-width: unset;
    }
  }
</style>
