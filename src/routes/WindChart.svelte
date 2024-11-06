<script lang="ts">
    import { Chart } from '@highcharts/svelte';
    import Highcharts, { type Options } from 'highcharts';
    import WindBarb from 'highcharts/modules/windbarb';
    import { transformWindData } from '$lib/meteo';
    import { weatherData } from '$lib/api'

    // Initialize WindBarb module
    if (typeof window !== 'undefined') {
        WindBarb(Highcharts);
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
            type: 'vector',
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
        plotOptions: {
            vector: {
                rotationOrigin: 'start',
                vectorLength: 15,
                enableMouseTracking: false,
                animation: false,
                showInLegend: false
            },
            windbarb: {
                animation: false,
                crisp: true,
                vectorLength: 15,
                enableMouseTracking: true
            }
        },
        series: transformWindData(weatherData)
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
