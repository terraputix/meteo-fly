import type { WeatherDataType } from '$lib/api/types';
import { interpolateWind } from '$lib/meteo/wind';
import { getPressureLevelsForAltitude, getAllLevelsForAltitude, getAtLevel } from './pressureLevels';

export interface WindFieldLevel {
  time: Date;
  height: number;
  speed: number;
  direction: number;
}

export function getWindFieldAllLevels(weatherData: WeatherDataType, maxAltitude: number = 4500): Array<WindFieldLevel> {
  const data: WindFieldLevel[] = [];
  const pressureLevels = getPressureLevelsForAltitude(maxAltitude);
  const levels = getAllLevelsForAltitude(maxAltitude);

  weatherData.hourly.time.forEach((time: Date, i: number) => {
    levels.forEach((level) => {
      let speed: number | null = null;
      let direction: number | null = null;

      if (level.hPa === -1) {
        // Interpolated level: find surrounding pressure levels
        const lowerLevel = pressureLevels
          .slice()
          .reverse()
          .find((p) => p.heightMeters <= level.heightMeters);
        const upperLevel = pressureLevels.find((p) => p.heightMeters > level.heightMeters);

        if (lowerLevel && upperLevel) {
          const lowerSpeedArr = getAtLevel(weatherData.hourly.windSpeedProfile, lowerLevel.hPa);
          const lowerDirArr = getAtLevel(weatherData.hourly.windDirectionProfile, lowerLevel.hPa);
          const upperSpeedArr = getAtLevel(weatherData.hourly.windSpeedProfile, upperLevel.hPa);
          const upperDirArr = getAtLevel(weatherData.hourly.windDirectionProfile, upperLevel.hPa);

          if (lowerSpeedArr && lowerDirArr && upperSpeedArr && upperDirArr) {
            const interpolated = interpolateWind(
              level.heightMeters,
              lowerLevel,
              upperLevel,
              { speed: lowerSpeedArr[i], direction: lowerDirArr[i] },
              { speed: upperSpeedArr[i], direction: upperDirArr[i] }
            );
            speed = interpolated.speed;
            direction = interpolated.direction;
          }
        }
      } else {
        // Direct pressure level
        const speedArr = getAtLevel(weatherData.hourly.windSpeedProfile, level.hPa);
        const dirArr = getAtLevel(weatherData.hourly.windDirectionProfile, level.hPa);
        if (speedArr && dirArr) {
          speed = speedArr[i];
          direction = dirArr[i];
        }
      }

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
