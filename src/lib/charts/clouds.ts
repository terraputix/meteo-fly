import type { WeatherDataType } from '$lib/api/types';
import { pressureLevels, getAtLevel } from './pressureLevels';

export function getCloudCoverData(weatherData: WeatherDataType) {
  const data: { x1: Date; x2: Date; y1: number; y2: number; value: number }[] = [];
  const levels = pressureLevels;
  const times = weatherData.hourly.time;

  const cloudCoverData = levels.map((level) => getAtLevel(weatherData.hourly.cloudCoverProfile, level.hPa));

  times.forEach((time, i) => {
    const nextTime = times[i + 1] || new Date(time.getTime() + 3600000); // Next time or +1 hour

    levels.forEach((level, j) => {
      const cloudCoverArray = cloudCoverData[j];
      const cloudCover = cloudCoverArray[i];
      const nextLevel = levels[j + 1];
      const y1 = level.heightMeters;
      const y2 = nextLevel ? nextLevel.heightMeters : level.heightMeters + 500; // Estimate next level

      data.push({
        x1: time,
        x2: nextTime,
        y1: y1,
        y2: y2,
        value: parseFloat(cloudCover.toFixed(0)),
      });
    });
  });

  // prepend an additional 0 value at a height below the first level for proper display of the first level
  times.forEach((time, i) => {
    data.push({
      x1: time,
      x2: times[i + 1] || new Date(time.getTime() + 3600000),
      y1: levels[0].heightMeters - 250,
      y2: levels[0].heightMeters,
      value: 0,
    });
  });
  return data;
}
