<script lang="ts">
  import * as Plot from '@observablehq/plot';
  import { min as d3Min, max as d3Max } from 'd3-array';
  import { ticks as d3Ticks } from 'd3-array';
  import { scaleLinear } from 'd3-scale';
  import { timeFormat } from 'd3-time-format';
  import { getCloudCoverData, type CloudCoverData } from '$lib/charts/clouds';
  import { getWindFieldAllLevels, type WindFieldLevel } from '$lib/charts/wind';
  import { windColorScale, strokeWidthScale, windDomains, windColors } from '$lib/charts/scales';
  import { calculateCloudBaseWeather } from '$lib/meteo/cloudBase';
  import { getRainSymbol } from '$lib/icons/RainIcons';
  import type { WeatherDataType } from '$lib/api/types';

  export let weatherData: WeatherDataType | null = null;

  let chartContainer: HTMLElement;
  let isRendering = false;
  let renderProgress = 0;

  // Performance optimization: Use requestIdleCallback for non-blocking rendering
  function scheduleWork(callback: () => void) {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(callback, { timeout: 16 });
    } else {
      setTimeout(callback, 0);
    }
  }

  function createTemperaturePlot(data: WeatherDataType, xDomain: [Date, Date], chartSettings: object) {
    const tempAxisMin = (d3Min(data.hourly.dewpoint_2m) ?? 0) - 5;
    const tempAxisMax = (d3Max(data.hourly.temperature_2m) ?? 0) + 5;
    const humidityScale = scaleLinear([0, 100], [tempAxisMin, tempAxisMax]);
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
        Plot.rect([{ x1: data.sunrise, x2: data.sunset, y1: tempAxisMin, y2: tempAxisMax }], {
          x1: 'x1',
          x2: 'x2',
          y1: 'y1',
          y2: 'y2',
          fill: () => 'rgba(255, 255, 0, 0.15)',
        }),
        Plot.gridX({ stroke: '#ddd', strokeOpacity: 0.5 }),
        Plot.gridY({ stroke: '#ddd', strokeOpacity: 0.5 }),
        Plot.axisY({ label: 'Temperature (°C)' }),
        Plot.axisY(humidityScale.ticks(4), {
          anchor: 'right',
          label: 'Humidity (%)',
          y: humidityScale,
          tickFormat: humidityScale.tickFormat(),
        }),
        Plot.line(
          data.hourly.time.map((time, i) => ({ time, value: data.hourly.temperature_2m[i] })),
          {
            y: 'value',
            stroke: 'red',
            title: (d) => `Temperature: ${d.value.toFixed(1)}°C`,
            ...interpolatedLinePlotSettings,
          }
        ),
        Plot.line(
          data.hourly.time.map((time, i) => ({ time, value: data.hourly.dewpoint_2m[i] })),
          {
            y: 'value',
            stroke: 'green',
            title: (d) => `Dewpoint: ${d.value.toFixed(1)}°C`,
            ...interpolatedLinePlotSettings,
          }
        ),
        Plot.line(
          data.hourly.time.map((time, i) => ({ time, value: data.hourly.relativeHumidity_2m[i] })),
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
  }

  function createRainAndCloudPlot(data: WeatherDataType, xDomain: [Date, Date], chartSettings: object) {
    const [xMin, xMax] = xDomain;
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
        Plot.rect(
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
        Plot.dot(
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
        Plot.frame(),
      ],
    });
  }

  function createWindPlot(
    data: WeatherDataType,
    windData: Array<WindFieldLevel>,
    cloudData: Array<CloudCoverData>,
    xDomain: [Date, Date],
    chartSettings: object,
    cloudCoverScaleOptions: Plot.ScaleOptions
  ) {
    const yDomain: [number, number] = [0, 4350];
    const cloudBase = calculateCloudBaseWeather(data);

    return Plot.plot({
      height: 700,
      ...chartSettings,
      marginTop: 0,
      x: { type: 'time', domain: xDomain },
      y: { domain: yDomain },
      color: cloudCoverScaleOptions,
      marks: [
        Plot.frame(),
        Plot.axisY(d3Ticks(0, 4500, 9), { label: 'Height', tickFormat: (d) => `${d} m` }),
        Plot.axisX({ label: `Time [${data.timezoneAbbr}]`, tickFormat: timeFormat('%H:%M') }),
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
        Plot.ruleY([data.elevation], {
          stroke: '#8B4513',
          strokeWidth: 2,
          strokeDasharray: '5,5',
        }),
        Plot.text([{ y: data.elevation, text: `Surface Elevation (${data.elevation}m)` }], {
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

  function createLegends(cloudCoverScaleOptions: Plot.ScaleOptions, windSpeedScaleOptions: Plot.ScaleOptions) {
    const cloudLegend = Plot.legend({ color: cloudCoverScaleOptions });
    const windLegend = Plot.legend({ color: windSpeedScaleOptions });

    const legendContainer = document.createElement('div');
    legendContainer.className = 'legend-container';
    legendContainer.appendChild(cloudLegend);
    legendContainer.appendChild(windLegend);
    return legendContainer;
  }

  function renderPlot(node: HTMLElement, data: WeatherDataType | null) {
    let renderCancelled = false;

    function drawProgressively(currentData: WeatherDataType) {
      if (renderCancelled) return;

      isRendering = true;
      renderProgress = 0;
      node.innerHTML = '';

      const cloudData = getCloudCoverData(currentData);
      const windData = getWindFieldAllLevels(currentData);

      const xMin = (d3Min(windData, (d) => d.time) as Date).addSeconds(-1800);
      const xMax = (d3Max(windData, (d) => d.time) as Date).addSeconds(1800);
      const xDomain: [Date, Date] = [xMin, xMax];

      const chartSettings = { width: 1000, marginLeft: 50, marginRight: 40 };
      const cloudCoverScaleOptions: Plot.ScaleOptions = {
        domain: [0, 100],
        range: ['white', 'gray'],
        type: 'sequential',
        label: 'Cloud Cover (%)',
      };
      const windSpeedScaleOptions: Plot.ScaleOptions = {
        domain: windDomains,
        range: windColors,
        type: 'pow',
        label: 'Wind Speed (km/h)',
      };

      const plotContainer = document.createElement('div');
      node.appendChild(plotContainer);

      // Step 1: Temperature plot (lightweight, renders first for LCP)
      scheduleWork(() => {
        if (renderCancelled) return;
        const temperaturePlot = createTemperaturePlot(currentData, xDomain, chartSettings);
        plotContainer.appendChild(temperaturePlot);
        renderProgress = 33;

        // Step 2: Rain and cloud plot
        scheduleWork(() => {
          if (renderCancelled) return;
          const rainPlot = createRainAndCloudPlot(currentData, xDomain, chartSettings);
          plotContainer.appendChild(rainPlot);
          renderProgress = 66;

          // Step 3: Wind plot (heaviest, renders last)
          scheduleWork(() => {
            if (renderCancelled) return;
            const windPlot = createWindPlot(
              currentData,
              windData,
              cloudData,
              xDomain,
              chartSettings,
              cloudCoverScaleOptions
            );
            plotContainer.appendChild(windPlot);
            renderProgress = 90;

            // Step 4: Legends
            scheduleWork(() => {
              if (renderCancelled) return;
              const legendContainer = createLegends(cloudCoverScaleOptions, windSpeedScaleOptions);
              node.appendChild(legendContainer);
              renderProgress = 100;
              isRendering = false;
            });
          });
        });
      });
    }

    if (data) {
      drawProgressively(data);
    }

    return {
      update(newData: WeatherDataType | null) {
        renderCancelled = true;
        scheduleWork(() => {
          renderCancelled = false;
          if (newData) {
            drawProgressively(newData);
          } else {
            node.innerHTML = '';
            isRendering = false;
            renderProgress = 0;
          }
        });
      },
      destroy() {
        renderCancelled = true;
        node.innerHTML = '';
      },
    };
  }
</script>

<div bind:this={chartContainer} use:renderPlot={weatherData} class="chart-container">
  {#if isRendering}
    <div class="skeleton-loader">
      <div class="skeleton-item" style="height: 160px; opacity: {renderProgress >= 33 ? 0 : 1}"></div>
      <div class="skeleton-item" style="height: 110px; opacity: {renderProgress >= 66 ? 0 : 1}"></div>
      <div class="skeleton-item main-chart" style="height: 700px; opacity: {renderProgress >= 90 ? 0 : 1}"></div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {renderProgress}%"></div>
      </div>
    </div>
  {/if}
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

  .skeleton-loader {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
  }

  .skeleton-item {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: 4px;
    transition: opacity 0.3s ease;
  }

  .skeleton-item.main-chart {
    background: linear-gradient(90deg, #f8f9fa 25%, #e9ecef 50%, #f8f9fa 75%);
    background-size: 200% 100%;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: #e0e0e0;
    border-radius: 2px;
    overflow: hidden;
    margin-top: 20px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4f46e5, #7c3aed);
    transition: width 0.3s ease;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
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
