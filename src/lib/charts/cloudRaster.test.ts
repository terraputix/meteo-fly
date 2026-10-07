import { describe, expect, it } from 'vitest';
import { buildCloudRaster, type CloudRaster } from '#lib/charts/cloudRaster.js';
import { getNativeLevelsForModel, metersToHPaExact } from '#lib/meteo/pressureLevels.js';
import { CHART_COLORS } from '#lib/charts/chartColors.js';

const times = [0, 1, 2].map((hour) => new Date(Date.UTC(2026, 6, 16, hour)));
const domain: [Date, Date] = [new Date(+times[0] - 1800000), new Date(+times[2] + 1800000)];
const pressures = getNativeLevelsForModel('icon_seamless', 4000)
  .map((level) => level.hPa)
  .sort((a, b) => a - b);
const clouds = times.flatMap((time, i) => pressures.map((pressure) => ({ time, pressure, value: i * 50 })));
const build = (points = clouds) => buildCloudRaster(points, times, domain, 'icon_seamless', 4000)!;

function alphaAt(raster: CloudRaster, time: number, pressure: number) {
  const x = Math.max(
    0,
    Math.min(raster.width - 1, Math.floor(((time - +domain[0]) / (+domain[1] - +domain[0])) * raster.width))
  );
  const y = Math.max(
    0,
    Math.min(
      raster.height - 1,
      Math.floor(((pressure - raster.pressureTop) / (raster.pressureBottom - raster.pressureTop)) * raster.height)
    )
  );
  return raster.pixels[(y * raster.width + x) * 4 + 3];
}

describe('cloud raster', () => {
  it.each([
    [0, 0],
    [0.1, 26],
    [24, 26],
    [25, 51],
    [49, 51],
    [50, 102],
    [74, 102],
    [75, 179],
    [100, 179],
  ])('assigns %i percent cloud to its contour band', (cover, alpha) => {
    const raster = build(clouds.map((cloud) => ({ ...cloud, value: cover })));
    expect(new Set(raster.pixels.filter((_, index) => index % 4 === 3))).toEqual(new Set([alpha]));
    expect([...raster.pixels.slice(0, 3)]).toEqual(CHART_COLORS.windCloudRgb);
    expect(raster.pixels.length).toBe(raster.width * raster.height * 4);
  });

  it('computes contours from interpolated cloud percentages rather than styled opacity', () => {
    const raster = build();
    expect(alphaAt(raster, +times[0] + 0.7 * 3600000, 850)).toBe(51);
    expect(alphaAt(raster, +times[1] + 0.2 * 3600000, 850)).toBe(102);
    expect(alphaAt(raster, +times[1] + 0.7 * 3600000, 850)).toBe(179);
  });

  it('creates filled contour regions across uneven pressure levels', () => {
    const level = 850;
    const next = pressures[pressures.indexOf(level) + 1];
    const gap = next - level;
    const raster = build(clouds.map((cloud) => ({ ...cloud, value: cloud.pressure === level ? 100 : 0 })));
    expect(alphaAt(raster, +times[1], level + gap * 0.1)).toBe(179);
    expect(alphaAt(raster, +times[1], level + gap * 0.4)).toBe(102);
    expect(alphaAt(raster, +times[1], level + gap * 0.65)).toBe(51);
    expect(alphaAt(raster, +times[1], level + gap * 0.85)).toBe(26);
    expect(alphaAt(raster, +times[1], level + gap * 0.97)).toBe(26);
    expect(alphaAt(raster, +times[1], level + gap * 1.1)).toBe(0);
  });

  it('leaves clouds below model ground elevation transparent', () => {
    const groundElevation = 1200;
    const groundPressure = metersToHPaExact(groundElevation);
    const raster = buildCloudRaster(
      clouds.map((cloud) => ({ ...cloud, value: 50 })),
      times,
      domain,
      'icon_seamless',
      4000,
      groundElevation
    )!;
    const bottomRow = Math.floor(
      ((groundPressure - raster.pressureTop) / (raster.pressureBottom - raster.pressureTop)) * raster.height - 0.5
    );
    for (let x = 0; x < raster.width; x++) {
      expect(raster.pixels[(bottomRow * raster.width + x) * 4 + 3]).toBe(102);
      expect(raster.pixels[((bottomRow + 1) * raster.width + x) * 4 + 3]).toBe(0);
    }
  });

  it('keeps missing hours and levels transparent instead of bridging them', () => {
    const missingHour = build(clouds.filter((cloud) => +cloud.time !== +times[1]));
    expect(alphaAt(missingHour, +times[1], 850)).toBe(0);
    expect(alphaAt(missingHour, +times[2], 850)).toBeGreaterThan(0);
    const missingLevel = build(clouds.filter((cloud) => cloud.pressure !== 850));
    expect(alphaAt(missingLevel, +times[2], 850)).toBe(0);
    expect(alphaAt(missingLevel, +times[2], 925)).toBeGreaterThan(0);
  });

  it('treats zero cloud cover as clear and rejects non-finite cover', () => {
    const raster = build(clouds.map((cloud) => ({ ...cloud, value: +cloud.time === +times[1] ? NaN : 0 })));
    expect(alphaAt(raster, +times[0], 850)).toBe(0);
    expect(alphaAt(raster, +times[1], 850)).toBe(0);
    expect(buildCloudRaster([], times, domain, 'icon_seamless', 4000)).toBeNull();
  });
});
