<script lang="ts">
    import { onMount } from 'svelte';
    import WindChart from './WindChart.svelte';
    import { fetchWeatherData, type Location, type WeatherDataType, type WeatherModel } from '$lib/api';
    import '../utils/dateExtensions';

    let location: Location = { latitude: 44.52, longitude: 9.41 };
    let selectedModel: WeatherModel = 'icon_seamless';
    let selectedDay: number = 1;

    $: startDate = (new Date()).addDays(selectedDay - 1);

    let weatherData: WeatherDataType | null = null;
    let error: string | null = null;

    async function updateWeather() {
        try {
            error = null;
            weatherData = await fetchWeatherData(location, selectedModel, startDate);
        } catch (err) {
            console.error(err);
            error = 'Failed to fetch weather data. Please try again.';
        }
    }

    onMount(() => {
        updateWeather().then();
    });
</script>

<div class="min-h-screen bg-gray-100 p-6">
    <div class="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6">
        <h1 class="text-2xl font-bold mb-6 text-center">Wind Chart</h1>

        <!-- Error Message -->
        {#if error}
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
                <span class="block sm:inline">{error}</span>
            </div>
        {/if}

        <!-- Input Form -->
        <div class="space-y-6">
            <!-- Location Inputs -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label for="latitude" class="block text-sm font-medium text-gray-700">Latitude</label>
                    <input
                        id="latitude"
                        type="number"
                        bind:value={location.latitude}
                        placeholder="e.g., 44.52"
                        step="0.01"
                        class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label for="longitude" class="block text-sm font-medium text-gray-700">Longitude</label>
                    <input
                        id="longitude"
                        type="number"
                        bind:value={location.longitude}
                        placeholder="e.g., 9.41"
                        step="0.01"
                        class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <!-- Update Button -->
                <div class="flex items-end">
                    <button
                        on:click={updateWeather}
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        Update Chart
                    </button>
                </div>
            </div>

            <!-- Model Selection -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label for="model" class="block text-sm font-medium text-gray-700">Weather Model</label>
                    <select
                        id="model"
                        bind:value={selectedModel}
                        class="mt-1 block w-full border border-gray-300 bg-white rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="icon_seamless">ICON Seamless</option>
                        <option value="icon_d2">ICON D2</option>
                        <option value="icon_eu">ICON EU</option>
                        <option value="icon_global">ICON Global</option>
                    </select>
                </div>

                <!-- Forecast Day Selection -->
                <div>
                    <label for="forecast-day" class="block text-sm font-medium text-gray-700">Forecast Day</label>
                    <input
                        id="forecast-day"
                        type="number"
                        bind:value={selectedDay}
                        class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                        max=16
                    />
                </div>
            </div>
        </div>

        <!-- Wind Chart Display -->
        {#if weatherData}
            <div class="mt-8">
                <WindChart {weatherData} />
            </div>
        {/if}
    </div>
</div>
