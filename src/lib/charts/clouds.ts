import type { WindChartData, WeatherModel } from '#lib/api/types.js';
import { getAtLevel } from '#lib/api/types.js';
import { getNativeLevelsForModel } from '#lib/meteo/pressureLevels.js';

export interface CloudCoverData {
  time: Date;
  pressure: number;
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
        pressure: level.hPa,
        value,
      });
    });
  });

  return data;
}

export function createCloudCoverSampler(
  clouds: CloudCoverData[],
  hourlyTimes: Date[],
  pressureLevels: number[] = clouds.map((cloud) => cloud.pressure)
): (time: number, pressure: number) => number | undefined {
  const times = [...new Set(hourlyTimes.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  const pressures = [...new Set(pressureLevels.filter(Number.isFinite))].sort((a, b) => a - b);
  const values = new Float32Array(times.length * pressures.length).fill(NaN);
  const timeIndices = new Map(times.map((time, index) => [time, index]));
  const pressureIndices = new Map(pressures.map((pressure, index) => [pressure, index]));
  for (const cloud of clouds) {
    const column = timeIndices.get(+cloud.time);
    const row = pressureIndices.get(cloud.pressure);
    if (column != null && row != null && Number.isFinite(cloud.value)) {
      values[row * times.length + column] = Math.max(0, Math.min(100, cloud.value));
    }
  }

  return (time, pressure) => {
    if (!times.length || !pressures.length || !Number.isFinite(time) || !Number.isFinite(pressure)) return undefined;
    const column = bracket(times, time);
    const row = bracket(pressures, pressure);
    if (!Number.isFinite(values[row.nearest * times.length + column.nearest])) return undefined;
    let cover = 0;
    let weight = 0;
    for (const [r, wy] of [
      [row.lower, 1 - row.fraction],
      [row.upper, row.fraction],
    ]) {
      for (const [c, wx] of [
        [column.lower, 1 - column.fraction],
        [column.upper, column.fraction],
      ]) {
        const value = values[r * times.length + c];
        if (!Number.isFinite(value)) continue;
        cover += value * wx * wy;
        weight += wx * wy;
      }
    }
    return weight ? cover / weight : undefined;
  };
}

function bracket(values: number[], value: number) {
  let lo = 0;
  let hi = values.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  const upper = lo;
  const lower = upper === 0 || value >= values.at(-1)! ? upper : upper - 1;
  const fraction = lower === upper ? 0 : (value - values[lower]) / (values[upper] - values[lower]);
  return { lower, upper, fraction, nearest: fraction <= 0.5 ? lower : upper };
}
