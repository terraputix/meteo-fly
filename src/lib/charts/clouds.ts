import type { WindChartData, WeatherModel } from '$lib/api/types';
import { getAtLevel } from '$lib/api/types';
import { getNativeLevelsForModel } from '$lib/meteo/pressureLevels';

export interface CloudCoverData {
  time: Date;
  height: number;
  value: number;
}

export function getCloudCoverData(
  windChartData: WindChartData,
  model: WeatherModel,
  maxAltitude: number = 4500
): Array<CloudCoverData> {
  const data: CloudCoverData[] = [];
  const times = windChartData.hourly.time;
  const levels = getNativeLevelsForModel(model, maxAltitude);

  levels.forEach((level) => {
    const values = getAtLevel(windChartData.hourly.cloudCoverProfile, level.hPa);
    if (!values) return;
    times.forEach((time, i) => {
      const value = values[i];
      if (!Number.isFinite(value)) return;
      data.push({
        time,
        height: level.heightMeters,
        value,
      });
    });
  });

  return data;
}
