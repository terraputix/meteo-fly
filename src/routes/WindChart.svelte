<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import * as Plot from '@observablehq/plot';
	import * as d3 from 'd3';
	import type { WeatherDataType } from '$lib/api';
	import { getCloudCoverData } from '$lib/charts/clouds';
	import { getWindFieldAllLevels } from '$lib/charts/wind';
	import {
		windColorScale,
		windMaxSpeed,
		strokeWidthScale,
		windDomains,
		windColors
	} from '$lib/charts/scales';
	import { calculateCloudBaseWeather } from '$lib/meteo/cloudBase';
	import { getRainSymbol } from '$lib/icons/RainIcons';

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
		const cloudBase = calculateCloudBaseWeather(weatherData);

		let yTicks = d3.ticks(0, 4500, 9);
		// Define y-axis domain
		const yDomain: [number, number] = [0, 4350];

		const xMin = (d3.min(windData, (d) => d.time) as Date).addSeconds(-1800);
		const xMax = (d3.max(windData, (d) => d.time) as Date).addSeconds(1800);
		const xDomain: [Date, Date] = [xMin, xMax];

		let cloudCoverScaleOptions: Plot.ScaleOptions = {
			domain: [0, 100],
			range: ['white', 'gray'],
			type: 'sequential',
			label: 'Cloud Cover (%)'
		};

		// Define wind speed scale options
		const windSpeedScaleOptions: Plot.ScaleOptions = {
			domain: windDomains,
			range: windColors,
			type: 'pow',
			label: 'Wind Speed (km/h)'
		};

		// Separate Plot box above the chart for rain indicators and cloud layers
		const rainPlot = Plot.plot({
			height: 90,
			width: 850,
			marginLeft: 50,
			marginRight: 40,
			marginBottom: 10,
			x: { type: 'time', domain: xDomain, axis: null },
			y: { domain: [0, 1], axis: 'left', ticks: 0, label: 'Rain' },
			marks: [
				Plot.axisY([0, 1], {
					anchor: 'right',
					label: 'Cloud Cover (%)',
					// tickSize: 0,
					// ticks: 3,
					dx: 100 // just move the label to the right
				}),
				// Labels for cloud layers
				Plot.text(
					[
						{ x: xMax, y: 1 / 6, text: 'Low' },
						{ x: xMax, y: 3 / 6, text: 'Mid' },
						{ x: xMax, y: 5 / 6, text: 'High' }
					],
					{
						x: 'x',
						y: 'y',
						text: 'text',
						dx: 15
					}
				),
				// Info bar background divided into three sections
				Plot.rect(
					[
						{ x1: xMin, x2: xMax, y1: 0, y2: 1 / 3, layer: 'low' },
						{ x1: xMin, x2: xMax, y1: 1 / 3, y2: 2 / 3, layer: 'mid' },
						{ x1: xMin, x2: xMax, y1: 2 / 3, y2: 1, layer: 'high' }
					],
					{
						x1: 'x1',
						x2: 'x2',
						y1: 'y1',
						y2: 'y2',
						fill: '#fafafa',
						opacity: 1.0
					}
				),
				// Cloud cover indicators for each layer
				Plot.rect(
					weatherData.hourly.time.flatMap((time, i) => [
						{
							x1: time.addSeconds(-1800),
							x2: time.addSeconds(1800),
							y1: 0,
							y2: 1 / 3,
							cloudCover: weatherData.hourly.cloudCoverLow[i]
						},
						{
							x1: time.addSeconds(-1800),
							x2: time.addSeconds(1800),
							y1: 1 / 3,
							y2: 2 / 3,
							cloudCover: weatherData.hourly.cloudCoverMid[i]
						},
						{
							x1: time.addSeconds(-1800),
							x2: time.addSeconds(1800),
							y1: 2 / 3,
							y2: 1,
							cloudCover: weatherData.hourly.cloudCoverHigh[i]
						}
					]),
					{
						x1: 'x1',
						x2: 'x2',
						y1: 'y1',
						y2: 'y2',
						fill: (d) => `rgba(128, 128, 128, ${d.cloudCover / 100})`,
						title: (d) => `Cloud Cover: ${d.cloudCover}%`
					}
				),
				// Rain indicators
				Plot.dot(
					weatherData.hourly.time
						.map((time, i) => ({
							time,
							y: 0.2,
							rain: weatherData.hourly.precipitation[i]
						}))
						.filter((d) => d.rain > 0),
					{
						x: 'time',
						y: 'y',
						fill: 'blue',
						symbol: (d) => getRainSymbol(d.rain),
						r: 6,
						title: (d) => `Rain: ${d.rain.toFixed(1)} mm/h`,
						opacity: 0.6
					}
				),
				Plot.frame()
			]
		});

		// Create the Plot
		const plot = Plot.plot({
			height: 600,
			width: 850,
			marginLeft: 50,
			marginRight: 40,
			marginTop: 0,
			x: { type: 'time', domain: xDomain },
			y: { domain: yDomain },
			marks: [
				Plot.frame(),
				Plot.axisY(yTicks, {
					label: 'Height',
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
				Plot.ruleX([xMin]),
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
					shape: 'arrow',
					r: 6,
					rotate: (d) => d.direction - 180,
					length: 18,
					strokeLinecap: 'round',
					strokeWidth: (d) => strokeWidthScale(d.speed),
					stroke: (d) => windColorScale(d.speed),
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
				}),
				// Plot elevation as brown rectangle from 0 to elevation
				Plot.rect(
					[
						{
							x1: xMin,
							x2: xMax,
							y1: 0,
							y2: weatherData.elevation,
							value: 100
						}
					],
					{
						x1: 'x1',
						x2: 'x2',
						y1: 'y1',
						y2: 'y2',
						fill: '#7a6552',
						opacity: 1.0
					}
				),
				// Plot cloud base as a red line
				Plot.line(cloudBase, {
					x: 'x',
					y: 'y',
					stroke: 'red',
					strokeWidth: 2
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

		// Combine plots
		const plotContainer = document.createElement('div');
		plotContainer.appendChild(rainPlot);
		plotContainer.appendChild(plot);

		// Append the plot to the container
		chartContainer.appendChild(plotContainer);
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
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: center;
		align-items: center;
		margin-top: 1rem;
	}

	:global(.legend-container > *) {
		flex: 1 1 auto;
		min-width: 200px;
		max-width: 100%;
	}
</style>
