<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import * as Plot from '@observablehq/plot';
  import * as d3 from 'd3';
  import { getCloudCoverData } from '$lib/charts/clouds';
  import { getWindFieldAllLevels } from '$lib/charts/wind';
  import { windColorScale, strokeWidthScale, windDomains, windColors } from '$lib/charts/scales';
  import { calculateCloudBaseWeather } from '$lib/meteo/cloudBase';
  import { getRainSymbol } from '$lib/icons/RainIcons';
  import type { WeatherDataType } from '$lib/api/types';

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
    console.log('Drawing chart');
    chartContainer.innerHTML = '';

    // Process data for plotting
    const cloudData = getCloudCoverData(weatherData);
    const windData = getWindFieldAllLevels(weatherData);
    const cloudBase = calculateCloudBaseWeather(weatherData);

    // Define X-axis domain
    const xMin = (d3.min(windData, (d) => d.time) as Date).addSeconds(-1800);
    const xMax = (d3.max(windData, (d) => d.time) as Date).addSeconds(1800);
    const xDomain: [Date, Date] = [xMin, xMax];

    const tempAxisMin = (d3.min(weatherData.hourly.dewpoint_2m) ?? 0) - 5;
    const tempAxisMax = (d3.max(weatherData.hourly.temperature_2m) ?? 0) + 5;
    const humidityScale = d3.scaleLinear([0, 100], [tempAxisMin, tempAxisMax]);
    const interpolatedLinePlotSettings: Plot.LineOptions = {
      x: 'time',
      curve: 'catmull-rom',
      strokeWidth: 2,
      tip: true,
    };

    const chartSettings = {
      width: 850,
      marginLeft: 50,
      marginRight: 40,
    };

    const temperaturePlot = Plot.plot({
      height: 150,
      ...chartSettings,
      marginBottom: 30,
      x: {
        type: 'time',
        domain: xDomain,
        // Add ticks but no label since it will be shared with wind plot
        tickFormat: d3.timeFormat('%H:%M'),
        // axis: null,
      },
      y: {
        domain: [tempAxisMin, tempAxisMax],
        label: 'Temperature (°C)',
      },
      marks: [
        Plot.frame(),
        // Add day/night shading first so it's behind everything else
        Plot.rect(
          [
            {
              x1: weatherData.sunrise,
              x2: weatherData.sunset,
              y1: tempAxisMin,
              y2: tempAxisMax,
            },
          ],
          {
            x1: 'x1',
            x2: 'x2',
            y1: 'y1',
            y2: 'y2',
            fill: () => 'rgba(255, 255, 0, 0.15)',
          }
        ),
        Plot.gridX({
          stroke: '#ddd',
          strokeOpacity: 0.5,
        }),
        Plot.gridY({
          stroke: '#ddd',
          strokeOpacity: 0.5,
        }),
        Plot.axisY({
          label: 'Temperature (°C)',
        }),
        Plot.axisY(humidityScale.ticks(4), {
          anchor: 'right',
          label: 'Humidity (%)',
          y: humidityScale,
          tickFormat: humidityScale.tickFormat(),
        }),
        // Temperature line
        Plot.line(
          weatherData.hourly.time.map((time, i) => ({
            time,
            value: weatherData.hourly.temperature_2m[i],
          })),
          {
            y: 'value',
            stroke: 'red',
            title: (d) => `Temperature: ${d.value.toFixed(1)}°C`,
            ...interpolatedLinePlotSettings,
          }
        ),
        // Dewpoint line
        Plot.line(
          weatherData.hourly.time.map((time, i) => ({
            time,
            value: weatherData.hourly.dewpoint_2m[i],
          })),
          {
            y: 'value',
            stroke: 'green',
            title: (d) => `Dewpoint: ${d.value.toFixed(1)}°C`,
            ...interpolatedLinePlotSettings,
          }
        ),
        // Relative humidity line (on secondary axis)
        Plot.line(
          weatherData.hourly.time.map((time, i) => ({
            time,
            value: weatherData.hourly.relativeHumidity_2m[i],
          })),
          // @ts-expect-error - TS doesn't know about the y property
          Plot.mapY((D) => D.map(humidityScale), {
            y: (d) => d.value,
            stroke: 'blue',
            title: (d) => `Humidity: ${d.value.toFixed(0)}%`,
            ...interpolatedLinePlotSettings,
          })
        ),
      ],
    });

    let cloudCoverScaleOptions: Plot.ScaleOptions = {
      domain: [0, 100],
      range: ['white', 'gray'],
      type: 'sequential',
      label: 'Cloud Cover (%)',
    };

    // Define wind speed scale options
    const windSpeedScaleOptions: Plot.ScaleOptions = {
      domain: windDomains,
      range: windColors,
      type: 'pow',
      label: 'Wind Speed (km/h)',
    };

    // Separate Plot box above the chart for rain indicators and cloud layers
    const rainPlot = Plot.plot({
      height: 90,
      ...chartSettings,
      marginBottom: 10,
      x: { type: 'time', domain: xDomain, axis: null },
      y: { domain: [0, 1], axis: 'left', ticks: 0, label: 'Rain' },
      marks: [
        Plot.axisY([0, 1], {
          anchor: 'right',
          label: 'Cloud Cover (%)',
          // tickSize: 0,
          // ticks: 3,
          dx: 100, // just move the label to the right
        }),
        // Labels for cloud layers
        Plot.text(
          [
            { x: xMax, y: 1 / 6, text: 'Low' },
            { x: xMax, y: 3 / 6, text: 'Mid' },
            { x: xMax, y: 5 / 6, text: 'High' },
          ],
          {
            x: 'x',
            y: 'y',
            text: 'text',
            dx: 15,
          }
        ),
        // Info bar background divided into three sections
        Plot.rect(
          [
            { x1: xMin, x2: xMax, y1: 0, y2: 1 / 3, layer: 'low' },
            { x1: xMin, x2: xMax, y1: 1 / 3, y2: 2 / 3, layer: 'mid' },
            { x1: xMin, x2: xMax, y1: 2 / 3, y2: 1, layer: 'high' },
          ],
          {
            x1: 'x1',
            x2: 'x2',
            y1: 'y1',
            y2: 'y2',
            fill: '#fafafa',
            opacity: 1.0,
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
              cloudCover: weatherData.hourly.cloudCoverLow[i],
            },
            {
              x1: time.addSeconds(-1800),
              x2: time.addSeconds(1800),
              y1: 1 / 3,
              y2: 2 / 3,
              cloudCover: weatherData.hourly.cloudCoverMid[i],
            },
            {
              x1: time.addSeconds(-1800),
              x2: time.addSeconds(1800),
              y1: 2 / 3,
              y2: 1,
              cloudCover: weatherData.hourly.cloudCoverHigh[i],
            },
          ]),
          {
            x1: 'x1',
            x2: 'x2',
            y1: 'y1',
            y2: 'y2',
            fill: (d) => `rgba(128, 128, 128, ${d.cloudCover / 100})`,
            title: (d) => `Cloud Cover: ${d.cloudCover}%`,
          }
        ),
        // Rain indicators
        Plot.dot(
          weatherData.hourly.time
            .map((time, i) => ({
              time,
              y: 0.2,
              rain: weatherData.hourly.precipitation[i],
            }))
            .filter((d) => d.rain > 0),
          {
            x: 'time',
            y: 'y',
            fill: 'blue',
            symbol: (d) => getRainSymbol(d.rain),
            r: 6,
            title: (d) => `Rain: ${d.rain.toFixed(1)} mm/h`,
            opacity: 0.6,
          }
        ),
        Plot.frame(),
      ],
    });

    // MARK: Wind Chart
    // Define y-axis domain for wind chart plot
    let yTicks = d3.ticks(0, 4500, 9);
    const yDomain: [number, number] = [0, 4350];

    const windPlot = Plot.plot({
      height: 600,
      ...chartSettings,
      marginTop: 0,
      x: { type: 'time', domain: xDomain },
      y: { domain: yDomain },
      marks: [
        Plot.frame(),
        Plot.axisY(yTicks, {
          label: 'Height',
          // tickSize: 0,
          // dx: -7,
          tickFormat: (d) => `${d} m`,
        }),
        Plot.axisX({
          label: `Time [${weatherData.timezoneAbbr}]`,
          // tickSize: 0,
          // dy: 3,
          tickFormat: d3.timeFormat('%H:%M'),
        }),
        Plot.gridY({
          stroke: '#ddd',
          strokeOpacity: 0.5,
        }),
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
          tip: false,
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
          tip: true,
        }),
        // Plot elevation as brown rectangle from 0 to elevation
        Plot.ruleY([yDomain[0], weatherData.elevation, yDomain[1]]),
        Plot.rect(
          [
            {
              x1: xMin,
              x2: xMax,
              y1: 0,
              y2: weatherData.elevation,
              value: 100,
            },
          ],
          {
            x1: 'x1',
            x2: 'x2',
            y1: 'y1',
            y2: 'y2',
            fill: '#7a6552',
            opacity: 1.0,
          }
        ),
        // Plot cloud base as a red line
        Plot.line(cloudBase, {
          ...interpolatedLinePlotSettings,
          x: 'x',
          y: 'y',
          stroke: 'purple',
          title: (d) => `Potential Cloud Base: ${d.y.toFixed(0)}m`,
        }),
      ],
      color: cloudCoverScaleOptions,
    });

    // Create legends
    const cloudLegend = Plot.legend({
      color: cloudCoverScaleOptions,
    });

    const windLegend = Plot.legend({
      color: windSpeedScaleOptions,
    });

    // Create legend container
    const legendContainer = document.createElement('div');
    legendContainer.className = 'legend-container';
    legendContainer.appendChild(cloudLegend);
    legendContainer.appendChild(windLegend);

    // Combine plots
    const plotContainer = document.createElement('div');
    plotContainer.appendChild(temperaturePlot);
    plotContainer.appendChild(rainPlot);
    plotContainer.appendChild(windPlot);

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
