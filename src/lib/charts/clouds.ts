import type { WeatherDataType } from '$lib/api/types';
import { pressureLevels, getAtLevel } from './pressureLevels';

/**
 * A single cloud cover observation at a specific time and pressure-level height.
 * Mirrors the shape of WindFieldLevel so both datasets can be handled uniformly.
 */
export interface CloudCoverData {
  time: Date;
  height: number; // metres above sea level (pressure level centre)
  value: number; // cloud cover 0–100 %
}

/**
 * Returns one CloudCoverData point per (time × pressure level) combination.
 * Heights are the centre altitudes of each pressure level; the renderer is
 * responsible for deciding how much vertical space each band occupies.
 */
export function getCloudCoverData(weatherData: WeatherDataType): Array<CloudCoverData> {
  const data: CloudCoverData[] = [];
  const times = weatherData.hourly.time;

  pressureLevels.forEach((level) => {
    const values = getAtLevel(weatherData.hourly.cloudCoverProfile, level.hPa);
    times.forEach((time, i) => {
      data.push({
        time,
        height: level.heightMeters,
        value: parseFloat((values[i] ?? 0).toFixed(1)),
      });
    });
  });

  return data;
}
