<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import * as Plot from '@observablehq/plot';
	import * as d3 from 'd3';
	import type { WeatherDataType } from '$lib/api';
	import { getCloudCoverData } from '$lib/charts/clouds';
	import { getWindFieldAllLevels } from '$lib/charts/wind';
	import { colorScale, maxSpeed, strokeWidthScale } from '$lib/charts/scales';

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

		let yTicks = d3.ticks(0, 4500, 9);
		// Define y-axis domain
		const yDomain: [number, number] = [0, 4500];

		const xMin = d3.min(windData, (d) => d.time) as Date;
		const xMax = d3.max(windData, (d) => d.time) as Date;
		const xDomain: [Date, Date] = [xMin.addSeconds(-1800), xMax.addSeconds(1800)];

		let cloudCoverScaleOptions: Plot.ScaleOptions = {
			domain: [0, 100],
			range: ['white', 'gray'],
			type: 'sequential',
			label: 'Cloud Cover (%)'
		};

		// Define wind speed scale options
		const windSpeedScaleOptions: Plot.ScaleOptions = {
			domain: [0, maxSpeed],
			range: ['#00FF00', '#FFA500', '#FF0000'],
			type: 'sequential',
			label: 'Wind Speed (km/h)'
		};

		// Create the Plot
		const plot = Plot.plot({
			height: 600,
			width: 850,
			marginLeft: 60,
			x: { type: 'time', domain: xDomain },
			y: { domain: yDomain },
			marks: [
				Plot.axisY(yTicks, {
					label: 'Height (m)',
					// tickSize: 0,
					// dx: -7,
					tickFormat: (d) => `${d} m`
				}),
				Plot.axisX({
					label: 'Time',
					// tickSize: 0,
					// dy: 3,
					tickFormat: d3.timeFormat('%H:%M')
				}),
				Plot.ruleY([0]),
				Plot.ruleX([xMin.addSeconds(-1800)]),
				// Cloud cover heatmap
				Plot.raster(cloudData, {
					x: 'x1',
					// x2: 'x2',
					y: 'y1',
					// y2: 'y2',
					interpolate: 'nearest',
					opacity: 0.9,
					fill: 'value',
					title: (d) => `Cloud Cover: ${d.value}%`,
					tip: false
				}),
				// Wind barbs
				Plot.vector(windData, {
					x: 'time',
					y: 'height',
					rotate: (d) => d.direction - 180,
					length: 15,
					strokeWidth: (d) => strokeWidthScale(d.speed),
					stroke: (d) => colorScale(d.speed),
					title: (d) => {
						// Format time for display
						const timeFormat = d3.timeFormat('%H:%M');
						const formattedTime = timeFormat(d.time);

						// Format height with units
						const formattedHeight = `${Math.round(d.height)}m`;

						// Find matching cloud cover data
						const cloudPoint = cloudData.find(
							(c) => c.x1.getTime() === d.time.getTime() && Math.abs(c.y1 - d.height) < 50
						);

						return cloudPoint
							? `Time: ${formattedTime}\nHeight: ${formattedHeight}\nWind Speed: ${d.speed} km/h\nDirection: ${d.direction}°\nCloud Cover: ${cloudPoint.value}%`
							: `Time: ${formattedTime}\nHeight: ${formattedHeight}\nWind Speed: ${d.speed} km/h\nDirection: ${d.direction}°`;
					},
					tip: true
				})
			],
			color: cloudCoverScaleOptions
		});

		// Create legends
		const cloudLegend = Plot.legend({
			color: cloudCoverScaleOptions
		});

		const windLegend = Plot.legend({
			color: windSpeedScaleOptions
		});

		// Create legend container
		const legendContainer = document.createElement('div');
		legendContainer.className = 'legend-container';
		legendContainer.appendChild(cloudLegend);
		legendContainer.appendChild(windLegend);

		// Append the plot to the container
		chartContainer.appendChild(plot);
		chartContainer.appendChild(legendContainer);
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

<div bind:this={chartContainer} class="chart-container"></div>

<style>
	.chart-container {
		width: 100%;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	:global(.legend-container) {
		display: flex;
		gap: 2rem;
		margin-top: 1rem;
		justify-content: center;
	}
</style>
