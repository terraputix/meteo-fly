<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import * as Plot from '@observablehq/plot';
	import type { WeatherDataType } from '$lib/api';
	import { getCloudCoverData } from '$lib/charts/clouds';
	import { getWindFieldAllLevels } from '$lib/charts/wind';
	import { colorScale, strokeWidthScale } from '$lib/charts/scales';

	export let weatherData: WeatherDataType | null = null;
	let chartContainer: HTMLDivElement;

	$: if (weatherData) {
		updateChart();
	}

	function updateChart() {
		if (!chartContainer) {
			console.log('chartContainer missing, cannot draw');
			return;
		}
		if (!weatherData) {
			console.log('weatherData missing, cannot draw');
			return;
		}
		chartContainer.innerHTML = '';

		// Process data for plotting
		const cloudData = getCloudCoverData(weatherData);
		const windData = getWindFieldAllLevels(weatherData);

		// Create the Plot
		const plot = Plot.plot({
			height: 600,
			x: { type: 'time', label: 'Time' },
			y: { label: 'Height (m)' },
			marks: [
				// Cloud cover heatmap
				Plot.rect(cloudData, {
					x1: 'x1',
					x2: 'x2',
					y1: 'y1',
					y2: 'y2',
					fill: 'value',
					title: (d) => `Cloud Cover: ${d.value}%`,
					opacity: 0.8
				}),
				// Wind barbs
				Plot.vector(windData, {
					x: 'time',
					y: 'height',
					rotate: (d) => d.direction,
					length: 15,
					strokeWidth: (d) => strokeWidthScale(d.speed),
					stroke: (d) => colorScale(d.speed),
					title: (d) => `Wind Speed: ${d.speed} m/s\nDirection: ${d.direction}°`
				})
			],
			color: {
				type: 'sequential',
				domain: [0, 100],
				range: ['white', 'gray'],
				legend: true,
				label: 'Cloud Cover (%)'
			}
		});

		// Append the plot to the container
		chartContainer.appendChild(plot);
	}

	onDestroy(() => {
		if (chartContainer) {
			chartContainer.innerHTML = '';
		}
	});

	onMount(() => {
		updateChart();
	});
</script>

<div bind:this={chartContainer}></div>

<style>
	div {
		width: 100%;
		margin: 20px auto;
	}
</style>
