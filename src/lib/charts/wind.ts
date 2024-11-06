import type { SeriesOptionsType } from 'highcharts';
import type { WeatherDataType, WindDirectionKey, WindSpeedKey } from '$lib/api';
import { interpolateWind } from '$lib/meteo/wind';
import { getWindColor } from '$lib/charts/colors';
import { allLevels, pressureLevels } from './pressureLevels';

function getWindSpeed(data: WeatherDataType, pressure: number): Float32Array {
    return data.hourly[`windSpeed${pressure}hPa` as WindSpeedKey];
}

function getWindDirection(data: WeatherDataType, pressure: number): Float32Array {
    return data.hourly[`windDirection${pressure}hPa` as WindDirectionKey];
}

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
