<script lang="ts">
  import {
    plot,
    frame,
    rect,
    gridX,
    gridY,
    axisX,
    axisY,
    line,
    mapY,
    text,
    dot,
    raster,
    vector,
    ruleY,
    legend,
    type LineOptions,
    type ScaleOptions,
  } from '@observablehq/plot';
  import { min as d3Min, max as d3Max } from 'd3-array';
  import { ticks as d3Ticks } from 'd3-array';
  import { scaleLinear } from 'd3-scale';
  import { timeFormat } from 'd3-time-format';
  import { windColorScale, strokeWidthScale, windDomains, windColors } from '$lib/charts/scales';
  import { calculateCloudBaseWeather } from '$lib/meteo/cloudBase';
  import { getRainSymbol } from '$lib/icons/RainIcons';
  import type { WeatherDataType } from '$lib/api/types';
  import type { ChartWorkerInput, ChartWorkerOutput } from '$lib/workers/chartWorker.types';
  import type { WindFieldLevel } from '$lib/charts/wind';
  import type { CloudCoverData } from '$lib/charts/clouds';

  export let weatherData: WeatherDataType | null = null;

  let isRendering = false;

  function createTemperaturePlot(data: WeatherDataType, xDomain: [Date, Date], chartSettings: object) {
    const tempAxisMin = (d3Min(data.hourly.dewpoint_2m) ?? 0) - 5;
    const tempAxisMax = (d3Max(data.hourly.temperature_2m) ?? 0) + 5;
    const humidityScale = scaleLinear([0, 100], [tempAxisMin, tempAxisMax]);
    const interpolatedLinePlotSettings: LineOptions = {
      x: 'time',
      curve: 'catmull-rom',
      strokeWidth: 2,
      tip: true,
    };

    return plot({
      height: 160,
      ...chartSettings,
      marginBottom: 30,
      x: { type: 'time', domain: xDomain, tickFormat: timeFormat('%H:%M') },
      y: { domain: [tempAxisMin, tempAxisMax], label: 'Temperature (°C)' },
      marks: [
        frame(),
        rect([{ x1: data.sunrise, x2: data.sunset, y1: tempAxisMin, y2: tempAxisMax }], {
          x1: 'x1',
          x2: 'x2',
          y1: 'y1',
          y2: 'y2',
          fill: () => 'rgba(255, 255, 0, 0.15)',
        }),
        gridX({ stroke: '#ddd', strokeOpacity: 0.5 }),
        gridY({ stroke: '#ddd', strokeOpacity: 0.5 }),
        axisY({ label: 'Temperature (°C)' }),
        axisY(humidityScale.ticks(4), {
          anchor: 'right',
          label: 'Humidity (%)',
          y: humidityScale,
          tickFormat: humidityScale.tickFormat(),
        }),
        line(
          data.hourly.time.map((time, i) => ({ time, value: data.hourly.temperature_2m[i] })),
          {
            y: 'value',
            stroke: 'red',
            title: (d) => `Temperature: ${d.value.toFixed(1)}°C`,
            ...interpolatedLinePlotSettings,
          }
        ),
        line(
          data.hourly.time.map((time, i) => ({ time, value: data.hourly.dewpoint_2m[i] })),
          {
            y: 'value',
            stroke: 'green',
            title: (d) => `Dewpoint: ${d.value.toFixed(1)}°C`,
            ...interpolatedLinePlotSettings,
          }
        ),
        line(
          data.hourly.time.map((time, i) => ({ time, value: data.hourly.relativeHumidity_2m[i] })),
          // @ts-expect-error - TS doesn't know about the y property
          mapY((D) => D.map(humidityScale), {
            y: (d) => d.value,
            stroke: 'blue',
            title: (d) => `Humidity: ${d.value.toFixed(0)}%`,
            ...interpolatedLinePlotSettings,
          })
        ),
      ],
    });
  }

  function createRainAndCloudPlot(data: WeatherDataType, xDomain: [Date, Date], chartSettings: object) {
    const [xMin, xMax] = xDomain;
    return plot({
      height: 110,
      ...chartSettings,
      marginBottom: 10,
      x: { type: 'time', domain: xDomain, axis: null },
      y: { domain: [0, 1], axis: 'left', ticks: 0, label: 'Rain' },
      marks: [
        axisY([0, 1], { anchor: 'right', label: 'Cloud Cover (%)', dx: 100 }),
        text(
          [
            { x: xMax, y: 1 / 6, text: 'Low' },
            { x: xMax, y: 3 / 6, text: 'Mid' },
            { x: xMax, y: 5 / 6, text: 'High' },
          ],
          { x: 'x', y: 'y', text: 'text', dx: 15 }
        ),
        rect(
          [
            { x1: xMin, x2: xMax, y1: 0, y2: 1 / 3 },
            { x1: xMin, x2: xMax, y1: 1 / 3, y2: 2 / 3 },
            { x1: xMin, x2: xMax, y1: 2 / 3, y2: 1 },
          ],
          { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', fill: '#fafafa' }
        ),
        rect(
          data.hourly.time.flatMap((time, i) => [
            {
              x1: time.addSeconds(-1800),
              x2: time.addSeconds(1800),
              y1: 0,
              y2: 1 / 3,
              cloudCover: data.hourly.cloudCoverLow[i],
            },
            {
              x1: time.addSeconds(-1800),
              x2: time.addSeconds(1800),
              y1: 1 / 3,
              y2: 2 / 3,
              cloudCover: data.hourly.cloudCoverMid[i],
            },
            {
              x1: time.addSeconds(-1800),
              x2: time.addSeconds(1800),
              y1: 2 / 3,
              y2: 1,
              cloudCover: data.hourly.cloudCoverHigh[i],
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
        dot(
          data.hourly.time
            .map((time, i) => ({ time, y: 0.2, rain: data.hourly.precipitation[i] }))
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
        frame(),
      ],
    });
  }

  function createWindPlot(
    data: WeatherDataType,
    windData: Array<WindFieldLevel>,
    cloudData: Array<CloudCoverData>,
    xDomain: [Date, Date],
    chartSettings: object,
    cloudCoverScaleOptions: ScaleOptions
  ) {
    const yDomain: [number, number] = [0, 4350];
    const cloudBase = calculateCloudBaseWeather(data);

    return plot({
      height: 700,
      ...chartSettings,
      marginTop: 0,
      x: { type: 'time', domain: xDomain },
      y: { domain: yDomain },
      color: cloudCoverScaleOptions,
      marks: [
        frame(),
        axisY(d3Ticks(0, 4500, 9), { label: 'Height', tickFormat: (d) => `${d} m` }),
        axisX({ label: `Time [${data.timezoneAbbr}]`, tickFormat: timeFormat('%H:%M') }),
        gridY({ stroke: '#ddd', strokeOpacity: 0.5 }),
        raster(cloudData, {
          x: 'x1',
          y: 'y1',
          interpolate: 'nearest',
          opacity: 0.9,
          fill: 'value',
          title: (d) => `Cloud Cover: ${d.value}%`,
          tip: false,
        }),
        vector(windData, {
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
        ruleY([data.elevation], {
          stroke: '#8B4513',
          strokeWidth: 2,
          strokeDasharray: '5,5',
        }),
        text([{ y: data.elevation, text: `Surface Elevation (${data.elevation}m)` }], {
          x: xDomain[0],
          y: 'y',
          text: 'text',
          dx: +10,
          dy: +10,
          fill: '#8B4513',
          fontWeight: 'bold',
          textAnchor: 'start',
        }),
        line(cloudBase, {
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

  function createLegends(cloudCoverScaleOptions: ScaleOptions, windSpeedScaleOptions: ScaleOptions) {
    const cloudLegend = legend({ color: cloudCoverScaleOptions });
    const windLegend = legend({ color: windSpeedScaleOptions });

    const legendContainer = document.createElement('div');
    legendContainer.className = 'legend-container';
    legendContainer.appendChild(cloudLegend);
    legendContainer.appendChild(windLegend);
    return legendContainer;
  }

  function renderPlot(node: HTMLElement, data: WeatherDataType | null) {
    let currentWorker: Worker | null = null;

    function draw(currentData: WeatherDataType) {
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
            const { cloudData, windData, weatherData } = response.data;

            const xMin = (d3Min(windData, (d) => d.time) as Date).addSeconds(-1800);
            const xMax = (d3Max(windData, (d) => d.time) as Date).addSeconds(1800);
            const xDomain: [Date, Date] = [xMin, xMax];

            const chartSettings = { width: 1000, marginLeft: 50, marginRight: 40 };
            const cloudCoverScaleOptions: ScaleOptions = {
              domain: [0, 100],
              range: ['white', 'gray'],
              type: 'sequential',
              label: 'Cloud Cover (%)',
            };
            const windSpeedScaleOptions: ScaleOptions = {
              domain: windDomains,
              range: windColors,
              type: 'pow',
              label: 'Wind Speed (km/h)',
            };

            const temperaturePlot = createTemperaturePlot(weatherData, xDomain, chartSettings);
            const rainPlot = createRainAndCloudPlot(weatherData, xDomain, chartSettings);
            const windPlot = createWindPlot(
              weatherData,
              windData,
              cloudData,
              xDomain,
              chartSettings,
              cloudCoverScaleOptions
            );
            const legendContainer = createLegends(cloudCoverScaleOptions, windSpeedScaleOptions);

            const plotContainer = document.createElement('div');
            plotContainer.appendChild(temperaturePlot);
            plotContainer.appendChild(rainPlot);
            plotContainer.appendChild(windPlot);

            node.appendChild(plotContainer);
            node.appendChild(legendContainer);
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

<div class="chart-container" style="min-height: 1000px;">
  {#if isRendering}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading weather charts...</p>
    </div>
  {/if}
  <div use:renderPlot={weatherData} class="chart-content" style="opacity: {isRendering ? 0 : 1}"></div>
</div>

<style>
  .chart-container {
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
  }

  .chart-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: opacity 0.3s ease;
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

  :global(.legend-container) {
    display: flex;
    margin: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
    align-items: center;
    margin-top: 1rem;
  }

  :global(.legend-container > *) {
    flex: 1 1 auto;
    min-width: 200px;
    max-width: 60%;
    margin: 0 1rem;
  }
</style>
