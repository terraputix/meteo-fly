<script lang="ts">
  import * as Plot from '@observablehq/plot';
  import { timeFormat } from 'd3-time-format';
  import { windColorScale, strokeWidthScale, cloudCoverScaleOptions } from '$lib/charts/scales';
  import { getRainSymbol } from '$lib/icons/RainIcons';
  import Legend from './Legend.svelte';
  import type { WeatherDataType } from '$lib/api/types';
  import type {
    ChartWorkerInput,
    ChartWorkerOutput,
    TemperatureChartData,
    RainCloudChartData,
    WindChartData,
  } from '$lib/workers/chartWorker.types';
  import type { CloudCoverData } from '$lib/charts/clouds';
  import type { WindFieldLevel } from '$lib/charts/wind';

  export let weatherData: WeatherDataType | null = null;

  let isRendering = false;

  function createTemperaturePlot(
    chartData: TemperatureChartData,
    xDomain: [Date, Date],
    chartSettings: object
  ): Element {
    const { tempAxisMin, tempAxisMax, humidityScale, temperatureData, dewpointData, humidityData, sunrise, sunset } =
      chartData;

    const interpolatedLinePlotSettings: Plot.LineOptions = {
      x: 'time',
      curve: 'catmull-rom',
      strokeWidth: 2,
      tip: true,
    };

    return Plot.plot({
      height: 160,
      ...chartSettings,
      marginBottom: 30,
      x: { type: 'time', domain: xDomain, tickFormat: timeFormat('%H:%M') },
      y: { domain: [tempAxisMin, tempAxisMax], label: 'Temperature (°C)' },
      marks: [
        Plot.frame(),
        Plot.rect([{ x1: sunrise, x2: sunset, y1: tempAxisMin, y2: tempAxisMax }], {
          x1: 'x1',
          x2: 'x2',
          y1: 'y1',
          y2: 'y2',
          fill: () => 'rgba(255, 255, 0, 0.15)',
        }),
        Plot.gridX({ stroke: '#ddd', strokeOpacity: 0.5 }),
        Plot.gridY({ stroke: '#ddd', strokeOpacity: 0.5 }),
        Plot.axisY({ label: 'Temperature (°C)' }),
        Plot.axisY(humidityScale.ticks, {
          anchor: 'right',
          label: 'Humidity (%)',
          y: (d: number) =>
            humidityScale.range[0] +
            ((d - humidityScale.domain[0]) / (humidityScale.domain[1] - humidityScale.domain[0])) *
              (humidityScale.range[1] - humidityScale.range[0]),
          tickFormat: (d: number) => `${d}%`,
        }),
        Plot.line(temperatureData, {
          y: 'value',
          stroke: 'red',
          title: (d) => `Temperature: ${d.value.toFixed(1)}°C`,
          ...interpolatedLinePlotSettings,
        }),
        Plot.line(dewpointData, {
          y: 'value',
          stroke: 'green',
          title: (d) => `Dewpoint: ${d.value.toFixed(1)}°C`,
          ...interpolatedLinePlotSettings,
        }),
        Plot.line(humidityData, {
          y: (d) =>
            humidityScale.range[0] +
            ((d.value - humidityScale.domain[0]) / (humidityScale.domain[1] - humidityScale.domain[0])) *
              (humidityScale.range[1] - humidityScale.range[0]),
          stroke: 'blue',
          title: (d) => `Humidity: ${d.value.toFixed(0)}%`,
          ...interpolatedLinePlotSettings,
        }),
      ],
    });
  }

  function createRainAndCloudPlot(
    chartData: RainCloudChartData,
    xDomain: [Date, Date],
    chartSettings: object
  ): Element {
    const { cloudRects, rainDots, xMin, xMax } = chartData;

    return Plot.plot({
      height: 110,
      ...chartSettings,
      marginBottom: 10,
      x: { type: 'time', domain: xDomain, axis: null },
      y: { domain: [0, 1], axis: 'left', ticks: 0, label: 'Rain' },
      marks: [
        Plot.axisY([0, 1], { anchor: 'right', label: 'Cloud Cover (%)', dx: 100 }),
        Plot.text(
          [
            { x: xMax, y: 1 / 6, text: 'Low' },
            { x: xMax, y: 3 / 6, text: 'Mid' },
            { x: xMax, y: 5 / 6, text: 'High' },
          ],
          { x: 'x', y: 'y', text: 'text', dx: 15 }
        ),
        Plot.rect(
          [
            { x1: xMin, x2: xMax, y1: 0, y2: 1 / 3 },
            { x1: xMin, x2: xMax, y1: 1 / 3, y2: 2 / 3 },
            { x1: xMin, x2: xMax, y1: 2 / 3, y2: 1 },
          ],
          { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', fill: '#fafafa' }
        ),
        Plot.rect(cloudRects, {
          x1: 'x1',
          x2: 'x2',
          y1: 'y1',
          y2: 'y2',
          fill: (d) => `rgba(128, 128, 128, ${d.cloudCover / 100})`,
          title: (d) => `Cloud Cover: ${d.cloudCover}%`,
        }),
        Plot.dot(rainDots, {
          x: 'time',
          y: 'y',
          fill: 'blue',
          symbol: (d) => getRainSymbol(d.rain),
          r: 6,
          title: (d) => `Rain: ${d.rain.toFixed(1)} mm/h`,
          opacity: 0.6,
        }),
        Plot.frame(),
      ],
    });
  }

  function createWindPlot(
    windData: WindFieldLevel[],
    cloudData: CloudCoverData[],
    cloudBase: Array<{ x: Date; y: number }>,
    windChartData: WindChartData,
    xDomain: [Date, Date],
    chartSettings: object,
    cloudCoverScaleOptions: Plot.ScaleOptions
  ): Element {
    const { yDomain, elevation, timezoneAbbr, tickValues } = windChartData;

    return Plot.plot({
      height: 700,
      ...chartSettings,
      marginTop: 0,
      x: { type: 'time', domain: xDomain },
      y: { domain: yDomain },
      color: cloudCoverScaleOptions,
      marks: [
        Plot.frame(),
        Plot.axisY(tickValues, { label: 'Height', tickFormat: (d) => `${d} m` }),
        Plot.axisX({ label: `Time [${timezoneAbbr}]`, tickFormat: timeFormat('%H:%M') }),
        Plot.gridY({ stroke: '#ddd', strokeOpacity: 0.5 }),
        Plot.raster(cloudData, {
          x: 'x1',
          y: 'y1',
          interpolate: 'nearest',
          opacity: 0.9,
          fill: 'value',
          title: (d) => `Cloud Cover: ${d.value}%`,
          tip: false,
        }),
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
            const formattedTime = timeFormat('%H:%M')(d.time);
            const formattedHeight = `${Math.round(d.height)}m`;
            const cloudPoint = cloudData.find(
              (c) => c.x1.getTime() === d.time.getTime() && Math.abs(c.y1 - d.height) < 50
            );
            return cloudPoint
              ? `Time: ${formattedTime}\nHeight: ${formattedHeight}\nWind Speed: ${d.speed} km/h\nDirection: ${d.direction}°\nCloud Cover: ${cloudPoint.value}%`
              : `Time: ${formattedTime}\nHeight: ${formattedHeight}\nWind Speed: ${d.speed} km/h\nDirection: ${d.direction}°`;
          },
          tip: true,
        }),
        Plot.ruleY([elevation], {
          stroke: '#8B4513',
          strokeWidth: 2,
          strokeDasharray: '5,5',
        }),
        Plot.text([{ y: elevation, text: `Surface Elevation (${elevation}m)` }], {
          x: xDomain[0],
          y: 'y',
          text: 'text',
          dx: +10,
          dy: +10,
          fill: '#8B4513',
          fontWeight: 'bold',
          textAnchor: 'start',
        }),
        Plot.line(cloudBase, {
          x: 'x',
          y: 'y',
          stroke: 'purple',
          title: (d) => `Potential Cloud Base: ${d.y.toFixed(0)}m`,
          curve: 'catmull-rom',
          strokeWidth: 2,
          tip: true,
        }),
      ],
    });
  }

  function renderPlot(node: HTMLElement, data: WeatherDataType | null) {
    let currentWorker: Worker | null = null;

    function draw(currentData: WeatherDataType): void {
      isRendering = true;
      node.innerHTML = '';

      // Terminate any existing worker
      if (currentWorker) {
        currentWorker.terminate();
      }

      // Create worker for heavy data processing
      currentWorker = new Worker(new URL('$lib/workers/chartWorker.ts', import.meta.url), {
        type: 'module',
      });

      currentWorker.onmessage = function (e: MessageEvent<ChartWorkerOutput>) {
        const response = e.data;

        if (response.success) {
          try {
            // Type-safe access to processed data
            const { cloudData, windData, cloudBase, temperatureChartData, rainCloudChartData, windChartData, xDomain } =
              response.data;

            const chartSettings = { width: 1000, marginLeft: 50, marginRight: 40 };

            // Create plots using pre-processed data
            const temperaturePlot = createTemperaturePlot(temperatureChartData, xDomain, chartSettings);
            const rainPlot = createRainAndCloudPlot(rainCloudChartData, xDomain, chartSettings);
            const windPlot = createWindPlot(
              windData,
              cloudData,
              cloudBase,
              windChartData,
              xDomain,
              chartSettings,
              cloudCoverScaleOptions
            );
            const plotContainer = document.createElement('div');
            plotContainer.appendChild(temperaturePlot);
            plotContainer.appendChild(rainPlot);
            plotContainer.appendChild(windPlot);

            node.appendChild(plotContainer);
          } catch (plotError) {
            console.error('Error creating plots:', plotError);
          }
        } else {
          // TypeScript knows this is an error response
          console.error('Chart worker error:', response.error);
        }

        isRendering = false;
        currentWorker?.terminate();
        currentWorker = null;
      };

      currentWorker.onerror = function (error: ErrorEvent) {
        console.error('Worker error:', error);
        isRendering = false;
        currentWorker?.terminate();
        currentWorker = null;
      };

      // Type-safe message to worker
      const workerInput: ChartWorkerInput = {
        weatherData: currentData,
      };

      currentWorker.postMessage(workerInput);
    }

    if (data) {
      draw(data);
    }

    return {
      update(newData: WeatherDataType | null) {
        if (newData) {
          draw(newData);
        } else {
          // Terminate worker if no data
          if (currentWorker) {
            currentWorker.terminate();
            currentWorker = null;
          }
          node.innerHTML = '';
          isRendering = false;
        }
      },
      destroy() {
        // Clean up worker on destroy
        if (currentWorker) {
          currentWorker.terminate();
          currentWorker = null;
        }
        node.innerHTML = '';
      },
    };
  }
</script>

<div class="chart-container">
  {#if isRendering}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Processing weather data...</p>
    </div>
  {/if}
  <div use:renderPlot={weatherData} class="chart-content" style="opacity: {isRendering ? 0 : 1}"></div>
</div>

<Legend />

<style>
  .chart-container {
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    aspect-ratio: 900 / 850;
    padding: 0 20px;
  }

  .chart-content {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: opacity 0.3s ease;
  }

  .chart-content :global(svg) {
    width: 100%;
    height: auto;
  }

  .loading-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4f46e5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 768px) {
    .chart-container {
      padding: 0 10px;
    }
  }
</style>
