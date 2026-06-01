import type { WindChartData, WeatherModel } from '$lib/api/types';
import { getAtLevel } from '$lib/api/types';
import { interpolateWind } from '$lib/meteo/wind';
import { getAllTaggedLevelsForModel, getNativeLevelsForFetch, type LevelSource } from '$lib/meteo/pressureLevels';
import type { MaxAltitude } from '$lib/meteo/types';

export interface WindFieldLevel {
  time: Date;
  height: number;
  speed: number;
  direction: number;
  source: LevelSource;
}

export function getWindFieldAllLevels(
  windChartData: WindChartData,
  model: WeatherModel,
  maxAltitude: MaxAltitude = 4000
): Array<WindFieldLevel> {
  const data: WindFieldLevel[] = [];
  const nativeLevels = getNativeLevelsForFetch(model, maxAltitude);
  const allLevels = getAllTaggedLevelsForModel(model, maxAltitude);

  windChartData.hourly.time.forEach((time: Date, i: number) => {
    allLevels.forEach((level) => {
      let speed: number | null = null;
      let direction: number | null = null;

      if (level.source === 'model') {
        const speedArr = getAtLevel(windChartData.hourly.windSpeedProfile, level.hPa);
        const dirArr = getAtLevel(windChartData.hourly.windDirectionProfile, level.hPa);
        if (speedArr && dirArr) {
          speed = speedArr[i];
          direction = dirArr[i];
        }
      } else {
        // Interpolated level: bracket with the two nearest native levels.
        const lowerLevel = [...nativeLevels].reverse().find((p) => p.heightMeters <= level.heightMeters);
        const upperLevel = nativeLevels.find((p) => p.heightMeters > level.heightMeters);

        if (lowerLevel && upperLevel) {
          const lowerSpeedArr = getAtLevel(windChartData.hourly.windSpeedProfile, lowerLevel.hPa);
          const lowerDirArr = getAtLevel(windChartData.hourly.windDirectionProfile, lowerLevel.hPa);
          const upperSpeedArr = getAtLevel(windChartData.hourly.windSpeedProfile, upperLevel.hPa);
          const upperDirArr = getAtLevel(windChartData.hourly.windDirectionProfile, upperLevel.hPa);

          if (lowerSpeedArr && lowerDirArr && upperSpeedArr && upperDirArr) {
            const result = interpolateWind(
              level.heightMeters,
              lowerLevel,
              upperLevel,
              { speed: lowerSpeedArr[i], direction: lowerDirArr[i] },
              { speed: upperSpeedArr[i], direction: upperDirArr[i] }
            );
            speed = result.speed;
            direction = result.direction;
          }
        }
      }

      if (speed != null && direction != null && !isNaN(speed) && !isNaN(direction)) {
        data.push({
          time,
          height: level.heightMeters,
          speed: parseFloat(speed.toFixed(2)),
          direction: parseFloat(direction.toFixed(0)),
          source: level.source,
        });
      }
    });
  });

  return data;
}
