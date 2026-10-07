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

function strongestAlpha(raster: CloudRaster, fixed: { time: number } | { pressure: number }) {
  let strongest = 0;
  for (let i = 0; i < 512; i++) {
    const time = 'time' in fixed ? fixed.time : +domain[0] + ((i + 0.5) / 512) * (+domain[1] - +domain[0]);
    const pressure =
      'pressure' in fixed
        ? fixed.pressure
        : raster.pressureTop + ((i + 0.5) / 512) * (raster.pressureBottom - raster.pressureTop);
    strongest = Math.max(strongest, alphaAt(raster, time, pressure));
  }
  return strongest;
}

describe('cloud raster', () => {
  it.each([
    [0, 0],
    [0.1, 26],
    [1, 26],
    [4, 26],
    [5, 26],
    [5.1, 26],
    [9, 26],
    [10, 26],
    [24, 26],
    [25, 51],
    [49, 51],
    [50, 102],
    [74, 102],
    [75, 179],
    [100, 179],
  ])('assigns %i percent cloud to its contour band', (cover, alpha) => {
    const raster = build(clouds.map((cloud) => ({ ...cloud, value: cover })));
    expect(strongestAlpha(raster, { time: +times[1] })).toBe(alpha);
    expect([...raster.pixels.slice(0, 3)]).toEqual(CHART_COLORS.windCloudRgb);
    expect(raster.pixels.length).toBe(raster.width * raster.height * 4);
  });

  it('computes contours from interpolated cloud percentages rather than styled opacity', () => {
    const raster = build();
    expect(strongestAlpha(raster, { time: +times[0] + 0.7 * 3600000 })).toBe(51);
    expect(strongestAlpha(raster, { time: +times[1] + 0.2 * 3600000 })).toBe(102);
    expect(strongestAlpha(raster, { time: +times[1] + 0.7 * 3600000 })).toBe(179);
  });

  it('creates filled contour regions across uneven pressure levels', () => {
    const level = 850;
    const next = pressures[pressures.indexOf(level) + 1];
    const gap = next - level;
    const raster = build(clouds.map((cloud) => ({ ...cloud, value: cloud.pressure === level ? 100 : 0 })));
    expect(strongestAlpha(raster, { pressure: level + gap * 0.1 })).toBe(179);
    expect(strongestAlpha(raster, { pressure: level + gap * 0.4 })).toBe(102);
    expect(strongestAlpha(raster, { pressure: level + gap * 0.65 })).toBe(51);
    expect(strongestAlpha(raster, { pressure: level + gap * 0.85 })).toBe(26);
    expect(strongestAlpha(raster, { pressure: level + gap * 0.97 })).toBe(26);
    expect(strongestAlpha(raster, { pressure: level + gap * 1.1 })).toBe(0);
  });

  it('keeps cloud shading continuous throughout filled contours', () => {
    const raster = build(clouds.map((cloud) => ({ ...cloud, value: 50 })));
    const alphas = raster.pixels.filter((_, index) => index % 4 === 3);
    expect(new Set(alphas)).toEqual(new Set([102]));
  });

  it('keeps a continuous lower edge on each contour', () => {
    const raster = build(clouds.map((cloud) => ({ ...cloud, value: cloud.pressure <= 850 ? 50 : 0 })));
    const clearPressure = pressures[pressures.indexOf(850) + 1];
    for (const [cover, alpha] of [
      [0, 26],
      [25, 51],
      [50, 102],
    ]) {
      const basePressure = clearPressure - (cover / 50) * (clearPressure - 850);
      const baseRow =
        Math.ceil(
          ((basePressure - raster.pressureTop) / (raster.pressureBottom - raster.pressureTop)) * raster.height - 0.5
        ) - 1;
      for (let x = 0; x < raster.width; x++) {
        for (let y = baseRow - 3; y <= baseRow; y++) {
          expect(raster.pixels[(y * raster.width + x) * 4 + 3]).toBe(alpha);
        }
        const lowerAlpha = cover === 0 ? 0 : cover === 25 ? 26 : 51;
        for (let y = baseRow + 1; y <= baseRow + 4; y++) {
          expect(raster.pixels[(y * raster.width + x) * 4 + 3]).toBe(lowerAlpha);
        }
      }
    }
    const interior = raster.pixels.filter((_, i) => i % 4 === 3).slice(0, raster.width * 100);
    expect(interior).not.toContain(0);
    expect(interior).toContain(102);
  });

  it('protects the visible cloud base at model ground elevation and leaves lower pixels transparent', () => {
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

  it('keeps both sides of neighbouring shading contours intact across time', () => {
    const raster = build();
    for (const [hourOffset, leftAlpha, rightAlpha] of [
      [0.5, 26, 51],
      [1, 51, 102],
      [1.5, 102, 179],
    ]) {
      const boundaryTime = +times[0] + hourOffset * 3600000;
      const firstColumn = Math.ceil(((boundaryTime - +domain[0]) / (+domain[1] - +domain[0])) * raster.width - 0.5);
      for (let y = 0; y < raster.height; y++) {
        for (let x = firstColumn - 4; x < firstColumn + 4; x++) {
          expect(raster.pixels[(y * raster.width + x) * 4 + 3]).toBe(x < firstColumn ? leftAlpha : rightAlpha);
        }
      }
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
