import type { WeatherDataType } from '$lib/api/types';
import { interpolateWind } from '$lib/meteo/wind';
import { allLevels, pressureLevels, getAtLevel } from './pressureLevels';

export interface WindFieldLevel {
  time: Date;
  height: number;
  speed: number;
  direction: number;
}

export function getWindFieldAllLevels(weatherData: WeatherDataType): Array<WindFieldLevel> {
  const data: { time: Date; height: number; speed: number; direction: number }[] = [];

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
          const lowerWindSpeedArray = getAtLevel(weatherData.hourly.windSpeedProfile, lowerLevel.hPa);
          const lowerWindDirectionArray = getAtLevel(weatherData.hourly.windDirectionProfile, lowerLevel.hPa);
          const upperWindSpeedArray = getAtLevel(weatherData.hourly.windSpeedProfile, upperLevel.hPa);
          const upperWindDirectionArray = getAtLevel(weatherData.hourly.windDirectionProfile, upperLevel.hPa);

          if (lowerWindSpeedArray && lowerWindDirectionArray && upperWindSpeedArray && upperWindDirectionArray) {
            const lowerWind = {
              speed: lowerWindSpeedArray[i],
              direction: lowerWindDirectionArray[i],
            };
            const upperWind = {
              speed: upperWindSpeedArray[i],
              direction: upperWindDirectionArray[i],
            };

            const interpolated = interpolateWind(level.heightMeters, lowerLevel, upperLevel, lowerWind, upperWind);

            speed = interpolated.speed;
            direction = interpolated.direction;
          }
        }
      } else {
        // Direct levels
        const speedArray = getAtLevel(weatherData.hourly.windSpeedProfile, level.hPa);
        const directionArray = getAtLevel(weatherData.hourly.windDirectionProfile, level.hPa);

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
