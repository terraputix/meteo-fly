<script lang="ts">
  import * as Plot from '@observablehq/plot';
  import * as d3 from 'd3';
  import { getCloudCoverData, type CloudCoverData } from '$lib/charts/clouds';
  import { getWindFieldAllLevels, type WindFieldLevel } from '$lib/charts/wind';
  import { windColorScale, strokeWidthScale, windDomains, windColors } from '$lib/charts/scales';
  import { calculateCloudBaseWeather } from '$lib/meteo/cloudBase';
  import { getRainSymbol } from '$lib/icons/RainIcons';
  import type { WeatherDataType } from '$lib/api/types';

  export let weatherData: WeatherDataType | null = null;

  // --- Plot Creation Helper Functions ---

  function createTemperaturePlot(data: WeatherDataType, xDomain: [Date, Date], chartSettings: object) {
    const tempAxisMin = (d3.min(data.hourly.dewpoint_2m) ?? 0) - 5;
    const tempAxisMax = (d3.max(data.hourly.temperature_2m) ?? 0) + 5;
    const humidityScale = d3.scaleLinear([0, 100], [tempAxisMin, tempAxisMax]);
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
      x: { type: 'time', domain: xDomain, tickFormat: d3.timeFormat('%H:%M') },
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
        Plot.axisY(d3.ticks(0, 4500, 9), { label: 'Height', tickFormat: (d) => `${d} m` }),
        Plot.axisX({ label: `Time [${data.timezoneAbbr}]`, tickFormat: d3.timeFormat('%H:%M') }),
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
            const formattedTime = d3.timeFormat('%H:%M')(d.time);
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
          stroke: '#8B4513', // A clearer, saddle-brown color
          strokeWidth: 2,
          strokeDasharray: '5,5', // Dashed line to indicate it's a reference
        }),
        Plot.text(
          // The data is an array with a single point for our label
          [{ y: data.elevation, text: `Surface Elevation (${data.elevation}m)` }],
          {
            x: xDomain[0], // Anchor the text to the left edge of the plot
            y: 'y',
            text: 'text',
            dx: +10, // Nudge the text 10px to the right from the edge
            dy: +10, // Nudge the text 10px down from the line to avoid overlap
            fill: '#8B4513', // Use the same color as the line
            fontWeight: 'bold',
            textAnchor: 'start', // Align the start of the text to the (x,y) coordinate
          }
        ),
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

  /**
   * Svelte Action to render the Observable Plot.
   */
  function renderPlot(node: HTMLElement, data: WeatherDataType | null) {
    function draw(currentData: WeatherDataType) {
      node.innerHTML = '';

      // 1. Process data and define shared configurations
      const cloudData = getCloudCoverData(currentData);
      const windData = getWindFieldAllLevels(currentData);

      const xMin = (d3.min(windData, (d) => d.time) as Date).addSeconds(-1800);
      const xMax = (d3.max(windData, (d) => d.time) as Date).addSeconds(1800);
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

      // 2. Create each plot element by calling the helper functions
      const temperaturePlot = createTemperaturePlot(currentData, xDomain, chartSettings);
      const rainPlot = createRainAndCloudPlot(currentData, xDomain, chartSettings);
      const windPlot = createWindPlot(currentData, windData, cloudData, xDomain, chartSettings, cloudCoverScaleOptions);
      const legendContainer = createLegends(cloudCoverScaleOptions, windSpeedScaleOptions);

      // 3. Assemble the final DOM structure
      const plotContainer = document.createElement('div');
      plotContainer.appendChild(temperaturePlot);
      plotContainer.appendChild(rainPlot);
      plotContainer.appendChild(windPlot);

      node.appendChild(plotContainer);
      node.appendChild(legendContainer);
    }

    if (data) {
      draw(data);
    }

    return {
      update(newData: WeatherDataType | null) {
        if (newData) {
          draw(newData);
        } else {
          node.innerHTML = '';
        }
      },
      destroy() {
        node.innerHTML = '';
      },
    };
  }
</script>

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
    margin: 1 rem;
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
