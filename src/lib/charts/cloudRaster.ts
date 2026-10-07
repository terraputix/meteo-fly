import { createCloudCoverSampler, type CloudCoverData } from '#lib/charts/clouds.js';
import type { WeatherModel } from '#lib/api/types.js';
import type { MaxAltitude } from '#lib/meteo/types.js';
import { getNativeLevelsForModel, metersToHPaExact } from '#lib/meteo/pressureLevels.js';
import { CHART_COLORS, WIND_CLOUD_BANDS, WIND_CLOUD_EDGE_ALPHA } from '#lib/charts/chartColors.js';

export interface CloudRaster {
  width: number;
  height: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
  pressureTop: number;
  pressureBottom: number;
}

export function buildCloudRaster(
  clouds: CloudCoverData[],
  hourlyTimes: Date[],
  xDomain: [Date, Date],
  model: WeatherModel,
  maxAltitude: MaxAltitude,
  groundElevation?: number
): CloudRaster | null {
  if (!clouds.length) return null;
  const pressures = getNativeLevelsForModel(model, maxAltitude)
    .map((level) => level.hPa)
    .sort((a, b) => a - b);
  if (!hourlyTimes.some((time) => Number.isFinite(+time)) || !pressures.length) return null;
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
  const groundPressure =
    groundElevation != null && Number.isFinite(groundElevation) ? metersToHPaExact(groundElevation) : Infinity;
  const cloudCoverAt = createCloudCoverSampler(clouds, hourlyTimes, pressures);
  for (let y = 0; y < height; y++) {
    const pressure = pressureTop + ((y + 0.5) / height) * (pressureBottom - pressureTop);
    if (pressure > groundPressure) continue;
    for (let x = 0; x < width; x++) {
      const time = +xDomain[0] + ((x + 0.5) / width) * (+xDomain[1] - +xDomain[0]);
      const cloudCover = cloudCoverAt(time, pressure);
      if (cloudCover == null) continue;
      const offset = (y * width + x) * 4;
      pixels.set(CHART_COLORS.windCloudRgb, offset);
      pixels[offset + 3] = (WIND_CLOUD_EDGE_ALPHA * cloudCover) / WIND_CLOUD_BANDS[0].minimum;
      for (const band of WIND_CLOUD_BANDS) {
        if (cloudCover + 1e-6 < band.minimum) break;
        pixels[offset + 3] = band.alpha;
      }
    }
  }
  return { width, height, pixels, pressureTop, pressureBottom };
}
