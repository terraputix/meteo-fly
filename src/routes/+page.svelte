<script lang="ts">
    import { onMount } from 'svelte';
    import WindChart from './WindChart.svelte';
    import { fetchWeatherData, type Location, type WeatherDataType } from '$lib/api';

    let location: Location = { latitude: 44.52, longitude: 9.41 };
    let weatherData: WeatherDataType | null = null;

    async function updateWeather() {
        weatherData = await fetchWeatherData(location);
    }

    onMount(() => {
        updateWeather().then();
    });
</script>

<h1>Wind Chart</h1>

<div class="location-input">
    <input
        type="number"
        bind:value={location.latitude}
        placeholder="Latitude"
        step="0.01"
    />
    <input
        type="number"
        bind:value={location.longitude}
        placeholder="Longitude"
        step="0.01"
    />
    <button on:click={updateWeather}>Update Chart</button>
</div>


{#if weatherData}
    <WindChart {weatherData} />
{/if}

<style>
    .location-input {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
    }
    input {
        width: 150px;
        padding: 5px;
    }
    button {
        padding: 5px 10px;
    }
</style>
