import type { WeatherDataType, WeatherModel } from '$lib/api/types';
import { getAtLevel } from '$lib/api/types';
import { getNativeLevelsForModel } from '$lib/meteo/pressureLevels';

export interface CloudCoverData {
  time: Date;
  height: number;
  value: number;
}

export function getCloudCoverData(
  weatherData: WeatherDataType,
  model: WeatherModel,
  maxAltitude: number = 4500
): Array<CloudCoverData> {
  const data: CloudCoverData[] = [];
  const times = weatherData.hourly.time;
  const levels = getNativeLevelsForModel(model, maxAltitude);

  levels.forEach((level) => {
    const values = getAtLevel(weatherData.hourly.cloudCoverProfile, level.hPa);
    if (!values) return;
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
