import type { SeriesOptionsType } from 'highcharts';
import type { WeatherDataType } from '$lib/api';
import type { PressureLevel } from '$lib/meteo/types';
import { interpolateWind } from '$lib/meteo/wind';
import { getWindColor } from '$lib/charts/colors';

type HourlyKeys = keyof WeatherDataType['hourly'];
type WindSpeedKey = Extract<HourlyKeys, `windSpeed${number}hPa`>;
type WindDirectionKey = Extract<HourlyKeys, `windDirection${number}hPa`>;

function getWindSpeed(data: WeatherDataType, pressure: number): Float32Array {
    return data.hourly[`windSpeed${pressure}hPa` as WindSpeedKey];
}

function getWindDirection(data: WeatherDataType, pressure: number): Float32Array {
    return data.hourly[`windDirection${pressure}hPa` as WindDirectionKey];
}

const pressureLevels: PressureLevel[] = [
    { hPa: 1000, heightMeters: 110 },
    { hPa: 975, heightMeters: 320 },
    { hPa: 950, heightMeters: 540 },
    { hPa: 925, heightMeters: 770 },
    { hPa: 900, heightMeters: 1000 },
    { hPa: 850, heightMeters: 1500 },
    { hPa: 800, heightMeters: 2000 },
    { hPa: 700, heightMeters: 3000 },
    { hPa: 600, heightMeters: 4200 },
];

const interpolatedLevels: PressureLevel[] = [
    { hPa: -1, heightMeters: 1250 },
    { hPa: -1, heightMeters: 1750 },
    { hPa: -1, heightMeters: 2250 },
    { hPa: -1, heightMeters: 2500 },
    { hPa: -1, heightMeters: 2750 },
    { hPa: -1, heightMeters: 3250 },
    { hPa: -1, heightMeters: 3500 },
    { hPa: -1, heightMeters: 3750 },
    { hPa: -1, heightMeters: 4000 },
];

const allLevels: PressureLevel[] = [
    ...pressureLevels,
    ...interpolatedLevels
].sort((a, b) => a.heightMeters - b.heightMeters);

export function getWindFieldAllLevels(weatherData: WeatherDataType): SeriesOptionsType[] {
    return allLevels.map(level => {
        if (level.hPa === -1) {
            return {
                name: `${level.heightMeters}m`,
                type: 'windbarb',
                data: weatherData.hourly.time.map((time: Date, i: number) => {
                    const lowerLevel = pressureLevels.reverse().find(p => (p.heightMeters <= level.heightMeters && p.hPa !== -1))!;
                    const upperLevel = pressureLevels.find(p => (p.heightMeters > level.heightMeters && p.hPa !== -1))!;

                    const lowerWind = {
                        speed: getWindSpeed(weatherData, lowerLevel.hPa)[i],
                        direction: getWindDirection(weatherData, lowerLevel.hPa)[i]
                    };
                    const upperWind = {
                        speed: getWindSpeed(weatherData, upperLevel.hPa)[i],
                        direction: getWindDirection(weatherData, upperLevel.hPa)[i]
                    };

                    const interpolated = interpolateWind(
                        level.heightMeters,
                        lowerLevel,
                        upperLevel,
                        lowerWind,
                        upperWind
                    );

                    return {
                        x: time.getTime(),
                        y: level.heightMeters,
                        value: parseFloat((interpolated.speed / 3.6).toFixed(2)), // km/h to m/s
                        direction: interpolated.direction,
                        color: getWindColor(interpolated.speed)
                    };
                }),
                lineWidth: 4,
                yOffset: 0,
                showInLegend: false
            };
        } else {
            const speed = getWindSpeed(weatherData, level.hPa);
            const direction = getWindDirection(weatherData, level.hPa);

            return {
                name: level.hPa === -1 ? `${level.heightMeters}m` : `${level.hPa}hPa`,
                type: 'windbarb',
                data: weatherData.hourly.time.map((time: Date, i: number) => ({
                    x: time.getTime(),
                    y: level.heightMeters,
                    value: parseFloat((speed[i] / 3.6).toFixed(2)), // km/h to m/s
                    direction: direction[i],
                    color: getWindColor(speed[i])
                })),
                lineWidth: 4,
                yOffset: 0,
                showInLegend: false
            };
        }
    });
}
