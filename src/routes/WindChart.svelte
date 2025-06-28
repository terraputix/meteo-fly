<script lang="ts">
  // No longer need onMount or onDestroy, the action handles the lifecycle.
  import * as Plot from '@observablehq/plot';
  import * as d3 from 'd3';
  import { getCloudCoverData } from '$lib/charts/clouds';
  import { getWindFieldAllLevels } from '$lib/charts/wind';
  import { windColorScale, strokeWidthScale, windDomains, windColors } from '$lib/charts/scales';
  import { calculateCloudBaseWeather } from '$lib/meteo/cloudBase';
  import { getRainSymbol } from '$lib/icons/RainIcons';
  import type { WeatherDataType } from '$lib/api/types';

  export let weatherData: WeatherDataType | null = null;

  /**
   * Svelte Action to render the Observable Plot.
   * This is the recommended way to integrate libraries that manipulate the DOM.
   *
   * @param {HTMLElement} node - The container element the action is applied to.
   * @param {WeatherDataType | null} data - The weather data passed to the action.
   */
  function renderPlot(node: HTMLElement, data: WeatherDataType | null) {
    // This function runs once when the element is created.
    // It's responsible for drawing the plot and setting up updates/cleanup.

    function draw(currentData: WeatherDataType) {
      // Clear the container before drawing. This is safe inside an action.
      node.innerHTML = '';

      // --- All your existing chart generation logic goes here ---
      // Process data for plotting
      const cloudData = getCloudCoverData(currentData);
      const windData = getWindFieldAllLevels(currentData);
      const cloudBase = calculateCloudBaseWeather(currentData);

      // Define X-axis domain
      const xMin = (d3.min(windData, (d) => d.time) as Date).addSeconds(-1800);
      const xMax = (d3.max(windData, (d) => d.time) as Date).addSeconds(1800);
      const xDomain: [Date, Date] = [xMin, xMax];

      const tempAxisMin = (d3.min(currentData.hourly.dewpoint_2m) ?? 0) - 5;
      const tempAxisMax = (d3.max(currentData.hourly.temperature_2m) ?? 0) + 5;
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
          tickFormat: d3.timeFormat('%H:%M'),
        },
        y: {
          domain: [tempAxisMin, tempAxisMax],
          label: 'Temperature (°C)',
        },
        marks: [
          Plot.frame(),
          Plot.rect(
            [
              {
                x1: currentData.sunrise,
                x2: currentData.sunset,
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
            currentData.hourly.time.map((time, i) => ({
              time,
              value: currentData.hourly.temperature_2m[i],
            })),
            {
              y: 'value',
              stroke: 'red',
              title: (d) => `Temperature: ${d.value.toFixed(1)}°C`,
              ...interpolatedLinePlotSettings,
            }
          ),
          Plot.line(
            currentData.hourly.time.map((time, i) => ({
              time,
              value: currentData.hourly.dewpoint_2m[i],
            })),
            {
              y: 'value',
              stroke: 'green',
              title: (d) => `Dewpoint: ${d.value.toFixed(1)}°C`,
              ...interpolatedLinePlotSettings,
            }
          ),
          Plot.line(
            currentData.hourly.time.map((time, i) => ({
              time,
              value: currentData.hourly.relativeHumidity_2m[i],
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

      const windSpeedScaleOptions: Plot.ScaleOptions = {
        domain: windDomains,
        range: windColors,
        type: 'pow',
        label: 'Wind Speed (km/h)',
      };

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
            dx: 100,
          }),
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
              { x1: xMin, x2: xMax, y1: 0, y2: 1 / 3, layer: 'low' },
              { x1: xMin, x2: xMax, y1: 1 / 3, y2: 2 / 3, layer: 'mid' },
              { x1: xMin, x2: xMax, y1: 2 / 3, y2: 1, layer: 'high' },
            ],
            { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', fill: '#fafafa', opacity: 1.0 }
          ),
          Plot.rect(
            currentData.hourly.time.flatMap((time, i) => [
              {
                x1: time.addSeconds(-1800),
                x2: time.addSeconds(1800),
                y1: 0,
                y2: 1 / 3,
                cloudCover: currentData.hourly.cloudCoverLow[i],
              },
              {
                x1: time.addSeconds(-1800),
                x2: time.addSeconds(1800),
                y1: 1 / 3,
                y2: 2 / 3,
                cloudCover: currentData.hourly.cloudCoverMid[i],
              },
              {
                x1: time.addSeconds(-1800),
                x2: time.addSeconds(1800),
                y1: 2 / 3,
                y2: 1,
                cloudCover: currentData.hourly.cloudCoverHigh[i],
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
            currentData.hourly.time
              .map((time, i) => ({
                time,
                y: 0.2,
                rain: currentData.hourly.precipitation[i],
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
          Plot.axisY(yTicks, { label: 'Height', tickFormat: (d) => `${d} m` }),
          Plot.axisX({
            label: `Time [${currentData.timezoneAbbr}]`,
            tickFormat: d3.timeFormat('%H:%M'),
          }),
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
              const timeFormat = d3.timeFormat('%H:%M');
              const formattedTime = timeFormat(d.time);
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
          Plot.ruleY([yDomain[0], currentData.elevation, yDomain[1]]),
          Plot.rect(
            [
              {
                x1: xMin,
                x2: xMax,
                y1: 0,
                y2: currentData.elevation,
                value: 100,
              },
            ],
            { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', fill: '#7a6552', opacity: 1.0 }
          ),
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

      const cloudLegend = Plot.legend({ color: cloudCoverScaleOptions });
      const windLegend = Plot.legend({ color: windSpeedScaleOptions });

      const legendContainer = document.createElement('div');
      legendContainer.className = 'legend-container';
      legendContainer.appendChild(cloudLegend);
      legendContainer.appendChild(windLegend);

      const plotContainer = document.createElement('div');
      plotContainer.appendChild(temperaturePlot);
      plotContainer.appendChild(rainPlot);
      plotContainer.appendChild(windPlot);

      // Append the final elements to the node provided by the action
      node.appendChild(plotContainer);
      node.appendChild(legendContainer);
    }

    // Initial draw if data is available
    if (data) {
      draw(data);
    }

    return {
      // This method is called by Svelte when the parameter to the action changes.
      update(newData: WeatherDataType | null) {
        if (newData) {
          draw(newData);
        } else {
          // If data becomes null, clear the container.
          node.innerHTML = '';
        }
      },
      // This method is called by Svelte when the component is about to be unmounted.
      destroy() {
        // Clean up the container.
        node.innerHTML = '';
      },
    };
  }
</script>

<!--
  Apply the action using the `use:` directive.
  We pass `weatherData` as a parameter. The action's `update` method
  will be called automatically whenever `weatherData` changes.
-->
<div use:renderPlot={weatherData} class="chart-container"></div>

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
