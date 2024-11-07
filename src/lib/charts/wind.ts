import type { WeatherDataType, WindDirectionKey, WindSpeedKey } from '$lib/api';
import { interpolateWind } from '$lib/meteo/wind';
import { parse } from 'svelte/compiler';
import { allLevels, pressureLevels } from './pressureLevels';

function getWindSpeed(data: WeatherDataType, pressure: number): Float32Array {
    return data.hourly[`windSpeed${pressure}hPa` as WindSpeedKey];
}

function getWindDirection(data: WeatherDataType, pressure: number): Float32Array {
    return data.hourly[`windDirection${pressure}hPa` as WindDirectionKey];
}

export function getWindFieldAllLevels(weatherData: WeatherDataType): Array<{ time: Date; height: number; speed: number; direction: number }> {
    const data: { time: Date; height: number; speed: number; direction: number; }[] = [];

    weatherData.hourly.time.forEach((time: Date, i: number) => {
        allLevels.forEach((level) => {
            let speed: number | null = null;
            let direction: number | null = null;

            if (level.hPa === -1) {
                // Interpolated levels
                const lowerLevel = pressureLevels
                    .slice()
                    .reverse()
                    .find((p) => p.heightMeters <= level.heightMeters && p.hPa !== -1);
                const upperLevel = pressureLevels.find((p) => p.heightMeters > level.heightMeters && p.hPa !== -1);

                if (lowerLevel && upperLevel) {
                    const lowerWindSpeedArray = getWindSpeed(weatherData, lowerLevel.hPa);
                    const lowerWindDirectionArray = getWindDirection(weatherData, lowerLevel.hPa);
                    const upperWindSpeedArray = getWindSpeed(weatherData, upperLevel.hPa);
                    const upperWindDirectionArray = getWindDirection(weatherData, upperLevel.hPa);

                    if (
                        lowerWindSpeedArray &&
                        lowerWindDirectionArray &&
                        upperWindSpeedArray &&
                        upperWindDirectionArray
                    ) {
                        const lowerWind = {
                            speed: lowerWindSpeedArray[i],
                            direction: lowerWindDirectionArray[i],
                        };
                        const upperWind = {
                            speed: upperWindSpeedArray[i],
                            direction: upperWindDirectionArray[i],
                        };

                        const interpolated = interpolateWind(
                            level.heightMeters,
                            lowerLevel,
                            upperLevel,
                            lowerWind,
                            upperWind
                        );

                        speed = interpolated.speed;
                        direction = interpolated.direction;
                    }
                }
            } else {
                // Direct levels
                const speedArray = weatherData.hourly[`windSpeed${level.hPa}hPa` as WindSpeedKey];
                const directionArray = weatherData.hourly[`windDirection${level.hPa}hPa` as WindDirectionKey];

                if (speedArray && directionArray) {
                    speed = speedArray[i];
                    direction = directionArray[i];
                }
            }

            // Add data point if speed and direction are valid
            if (speed != null && direction != null && !isNaN(speed) && !isNaN(direction)) {
                data.push({
                    time,
                    height: level.heightMeters,
                    speed: parseFloat(speed.toFixed(2)),
                    direction: parseFloat(direction.toFixed(0)),
                });
            }
        });
    });

    return data;
}
