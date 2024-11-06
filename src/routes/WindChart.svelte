<script lang="ts">
    import { Chart } from '@highcharts/svelte';
    import Highcharts, { type Options } from 'highcharts';
    import WindBarb from 'highcharts/modules/windbarb';
    import Heatmap from 'highcharts/modules/heatmap';
    import { getWindFieldAllLevels } from '$lib/charts/wind';
    import { weatherData } from '$lib/api'
	import { getCloudCoverData } from '$lib/charts/clouds';

    // Initialize WindBarb module
    if (typeof window !== 'undefined') {
        WindBarb(Highcharts);
        Heatmap(Highcharts);
        // Override the windArrow function to only draw simple arrows
        (Highcharts as any).seriesTypes.windbarb.prototype.windArrow = function(point: any) {
            const u = this.options.vectorLength / 20;

            if (point.isNull) {
                return [];
            }

            // Return only the basic arrow shape without barbs
            return [
                ['M', 0, 7 * u],      // Base of arrow
                ['L', -1.5 * u, 7 * u],
                ['L', 0, 10 * u],     // Arrow tip
                ['L', 1.5 * u, 7 * u],
                ['L', 0, 7 * u],
                ['L', 0, -10 * u]     // Stem
            ];
        };
    }

    $: chartOptions = {
        chart: {
            height: '600px',
            type: 'heatmap',
        },
        title: {
            text: 'Wind Profile'
        },
        xAxis: {
            type: 'datetime',
            tickInterval: 3600 * 1000,
            labels: {
                format: '{value:%H:%M}'
            }
        },
        yAxis: {
            title: { text: 'Height (m)' },
            min: 0,
            max: 5000,
            gridLineWidth: 1
        },
        colorAxis: {
            stops: [
                [0, '#ffffff'],
                [0.25, '#e0e0e0'],
                [0.5, '#c0c0c0'],
                [0.75, '#909090'],
                [1, '#606060']
            ],
            min: 0,
            max: 100,
            startOnTick: false,
            endOnTick: false,
            labels: {
                format: '{value}%'
            }
        },
        plotOptions: {
            windbarb: {
                animation: false,
                crisp: true,
                vectorLength: 15,
                enableMouseTracking: true,
                tooltip: {
                    valueSuffix: ' m/s'
                }
            },
            heatmap: {
                animation: false,
                nullColor: 'transparent',
                enableMouseTracking: true,
                borderWidth: 0,
                colsize: 3600 * 1000,
                rowsize: 250
            }
        },
        series: [
        {
            name: "Cloud Cover",
            type: 'heatmap',
            data: getCloudCoverData(weatherData),
            zIndex: 0
        },
        ...getWindFieldAllLevels(weatherData)
    ]
    } satisfies Options;
</script>

<div class="chart-container">
    <Chart options={chartOptions} />
</div>

<style>
    .chart-container {
        width: 100%;
        height: 600px;
        margin: 20px auto;
    }
</style>
