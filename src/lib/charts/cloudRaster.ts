import type { CloudCoverData } from '#lib/charts/clouds.js';
import type { WeatherModel } from '#lib/api/types.js';
import type { MaxAltitude } from '#lib/meteo/types.js';
import { getNativeLevelsForModel, metersToHPaExact } from '#lib/meteo/pressureLevels.js';
import { CHART_COLORS } from '#lib/charts/chartColors.js';

const CONTOUR_BANDS = [
  { minimum: 0, alpha: 26 },
  { minimum: 25, alpha: 51 },
  { minimum: 50, alpha: 102 },
  { minimum: 75, alpha: 179 },
] as const;

export interface CloudRaster {
  width: number;
  height: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
  pressureTop: number;
  pressureBottom: number;
}

function bracket(values: number[], value: number) {
  let upper = values.findIndex((candidate) => candidate >= value);
  if (upper < 0) upper = values.length - 1;
  const lower = upper === 0 || value >= values.at(-1)! ? upper : upper - 1;
  const fraction = lower === upper ? 0 : (value - values[lower]) / (values[upper] - values[lower]);
  return { lower, upper, fraction, nearest: fraction <= 0.5 ? lower : upper };
}

function cellNoise(x: number, y: number): number {
  let seed = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  seed = Math.imul(seed ^ (seed >>> 13), 1274126177);
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
}

function cloudHoleOpacity(x: number, y: number, cover: number): number {
  if (cover >= 100 - 1e-6) return 1;
  const spacing = 44;
  const warpedX = x + 0.5 + spacing * 0.2 * Math.sin((y / spacing) * 2.1);
  const warpedY = y + 0.5 + spacing * 0.2 * Math.sin((warpedX / spacing) * 1.7 + 1.3);
  const cellX = Math.floor(warpedX / spacing);
  const cellY = Math.floor(warpedY / spacing);
  const radius = spacing * Math.sqrt((1 - cover / 100) / Math.PI);
  let distanceSquared = Infinity;
  for (let row = cellY - 1; row <= cellY + 1; row++) {
    for (let column = cellX - 1; column <= cellX + 1; column++) {
      const centerX = (column + 0.5 + (cellNoise(column, row) - 0.5) * 0.35) * spacing;
      const centerY = (row + 0.5 + (cellNoise(column + 193, row - 71) - 0.5) * 0.35) * spacing;
      const size = 0.85 + cellNoise(column - 53, row + 127) * 0.3;
      distanceSquared = Math.min(distanceSquared, ((warpedX - centerX) ** 2 + (warpedY - centerY) ** 2) / size ** 2);
    }
  }
  return Math.max(0, Math.min(1, Math.sqrt(distanceSquared) - radius + 0.5));
}

export function buildCloudRaster(
  clouds: CloudCoverData[],
  hourlyTimes: Date[],
  xDomain: [Date, Date],
  model: WeatherModel,
  maxAltitude: MaxAltitude
): CloudRaster | null {
  if (!clouds.length) return null;
  const times = [...new Set(hourlyTimes.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  const pressures = getNativeLevelsForModel(model, maxAltitude)
    .map((level) => level.hPa)
    .sort((a, b) => a - b);
  if (!times.length || !pressures.length) return null;
  const pressureTop = Math.min(metersToHPaExact(maxAltitude), pressures[0]);
  const last = pressures.length - 1;
  const pressureBottom = Math.min(
    metersToHPaExact(0),
    pressures[last] + (last > 0 ? (pressures[last] - pressures[last - 1]) / 2 : 0)
  );
  if (pressureBottom <= pressureTop) return null;
  const width = 512;
  const height = 512;
  const pixels = new Uint8ClampedArray(width * height * 4);
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
  const columns = Array.from({ length: width }, (_, x) =>
    bracket(times, +xDomain[0] + ((x + 0.5) / width) * (+xDomain[1] - +xDomain[0]))
  );
  for (let y = 0; y < height; y++) {
    const row = bracket(pressures, pressureTop + ((y + 0.5) / height) * (pressureBottom - pressureTop));
    for (let x = 0; x < width; x++) {
      const column = columns[x];
      // Keep the nearest observation's missing-data cell transparent, including absent levels/hours.
      if (!Number.isFinite(values[row.nearest * times.length + column.nearest])) continue;
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
      if (!weight) continue;
      const offset = (y * width + x) * 4;
      pixels.set(CHART_COLORS.windCloudRgb, offset);
      const cloudCover = cover / weight;
      if (cloudCover <= 0) continue;
      const holeOpacity = cloudHoleOpacity(x, y, cloudCover);
      for (const band of CONTOUR_BANDS) {
        if (cloudCover + 1e-6 < band.minimum) break;
        pixels[offset + 3] = band.alpha * holeOpacity;
      }
    }
  }
  return { width, height, pixels, pressureTop, pressureBottom };
}
