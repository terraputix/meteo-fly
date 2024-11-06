import type { SeriesOptionsType } from 'highcharts';
import type { WeatherDataType } from './api';

export interface PressureLevel {
    hPa: number;
    heightMeters: number;
}

export const pressureLevels: PressureLevel[] = [
    { hPa: 1000, heightMeters: 110 },
    { hPa: 975, heightMeters: 320 },
    { hPa: 950, heightMeters: 540 },
    { hPa: 925, heightMeters: 770 },
    { hPa: 900, heightMeters: 1000 },
    { hPa: 850, heightMeters: 1500 },
    { hPa: 800, heightMeters: 2000 },
    { hPa: 700, heightMeters: 3000 },
    { hPa: 600, heightMeters: 4200 }
];

type HourlyKeys = keyof WeatherDataType['hourly'];
type WindSpeedKey = Extract<HourlyKeys, `windSpeed${number}hPa`>;
type WindDirectionKey = Extract<HourlyKeys, `windDirection${number}hPa`>;

function getWindSpeed(data: WeatherDataType, pressure: number): Float32Array {
    return data.hourly[`windSpeed${pressure}hPa` as WindSpeedKey];
}

function getWindDirection(data: WeatherDataType, pressure: number): Float32Array {
    return data.hourly[`windDirection${pressure}hPa` as WindDirectionKey];
}

function getWindColor(speed: number): string {
    if (speed < 5) return '#00B000';
    if (speed < 10) return '#83B000';
    if (speed < 15) return '#B3B000';
    if (speed < 20) return '#B37000';
    if (speed < 25) return '#C00000';
    return '#800000';
}

export function transformWindData(weatherData: WeatherDataType): SeriesOptionsType[] {
    return pressureLevels.map(level => ({
        name: `${level.hPa}hPa`,
        type: 'windbarb',
        data: weatherData.hourly.time.map((time: Date, i: number) => {
            const speed = getWindSpeed(weatherData, level.hPa)[i];
            console.log("speed", speed);
            return {
                x: time.getTime(),
                y: level.heightMeters,
                value: speed,
                direction: getWindDirection(weatherData, level.hPa)[i],
                color: getWindColor(speed)
            };
        }),
        lineWidth: 4,
        yOffset: 0,
        showInLegend: false
    }));
}
