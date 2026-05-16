import { describe, it, expect } from 'vitest';
import type { SkewTWeatherData } from '$lib/api/types';
import { getAllTaggedLevelsForModel } from './pressureLevels';
import { dedupeLevels, buildSkewTData } from './skewT';
import type { SkewTTrace, SkewTLevelData } from './types';

function createMockSkewTData(): SkewTWeatherData {
  const times = Array.from({ length: 3 }, (_, i) => new Date(2024, 5, 15, 6 + i));
  const temps2m = new Float32Array([20, 22, 24]);
  const dewpoints2m = new Float32Array([15, 16, 17]);

  return {
    hourly: {
      time: times,
      temperature_2m: temps2m,
      dewpoint_2m: dewpoints2m,
      temperatureProfile: {
        _1000hPa: new Float32Array([18, 20, 22]),
        _925hPa: new Float32Array([14, 16, 18]),
        _850hPa: new Float32Array([10, 12, 14]),
        _700hPa: new Float32Array([-2, 0, 2]),
        _600hPa: new Float32Array([-14, -12, -10]),
        _500hPa: new Float32Array([-26, -24, -22]),
        _400hPa: new Float32Array([-38, -36, -34]),
        _300hPa: new Float32Array([-50, -48, -46]),
      } as SkewTWeatherData['hourly']['temperatureProfile'],
      dewpointProfile: {
        _1000hPa: new Float32Array([14, 15, 16]),
        _925hPa: new Float32Array([10, 11, 12]),
        _850hPa: new Float32Array([6, 7, 8]),
        _700hPa: new Float32Array([-8, -6, -4]),
        _600hPa: new Float32Array([-20, -18, -16]),
        _500hPa: new Float32Array([-32, -30, -28]),
        _400hPa: new Float32Array([-44, -42, -40]),
        _300hPa: new Float32Array([-56, -54, -52]),
      } as SkewTWeatherData['hourly']['dewpointProfile'],
      windSpeedProfile: {
        _1000hPa: new Float32Array([5, 6, 7]),
        _925hPa: new Float32Array([8, 9, 10]),
        _850hPa: new Float32Array([12, 14, 16]),
        _700hPa: new Float32Array([20, 22, 24]),
        _600hPa: new Float32Array([25, 27, 29]),
        _500hPa: new Float32Array([30, 32, 34]),
        _400hPa: new Float32Array([35, 37, 39]),
        _300hPa: new Float32Array([40, 42, 44]),
      } as SkewTWeatherData['hourly']['windSpeedProfile'],
      windDirectionProfile: {
        _1000hPa: new Float32Array([0, 10, 20]),
        _925hPa: new Float32Array([45, 55, 65]),
        _850hPa: new Float32Array([90, 100, 110]),
        _700hPa: new Float32Array([180, 190, 200]),
        _600hPa: new Float32Array([225, 235, 245]),
        _500hPa: new Float32Array([270, 280, 290]),
        _400hPa: new Float32Array([315, 325, 335]),
        _300hPa: new Float32Array([0, 10, 20]),
      } as SkewTWeatherData['hourly']['windDirectionProfile'],
    },
    elevation: 500,
    timezoneAbbr: 'UTC',
  };
}

// Returns the deduplicated level count (unique hPa values) used by buildSkewTData
function expectedLevelCount(): number {
  const allLevels = getAllTaggedLevelsForModel('icon_d2', 4000);
  return dedupeLevels(allLevels).length;
}

describe('Skew-T data building', () => {
  it('builds skew-t data for icon_d2 model', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    expect(result.traces).toHaveLength(3);
    expect(result.elevation).toBe(500);
    expect(result.timezoneAbbr).toBe('UTC');
  });

  it('returns correct number of levels per trace (native + interpolated)', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);
    const expected = expectedLevelCount();

    result.traces.forEach((trace: SkewTTrace) => {
      expect(trace.levels).toHaveLength(expected);
    });
  });

  it('marks native vs interpolated levels correctly', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);
    const expected = expectedLevelCount();

    result.traces.forEach((trace: SkewTTrace) => {
      const nativeCount = trace.levels.filter((l: SkewTLevelData) => l.isNative).length;
      const interpCount = trace.levels.filter((l: SkewTLevelData) => !l.isNative).length;
      expect(nativeCount + interpCount).toBe(expected);
      expect(nativeCount).toBeGreaterThan(0);
    });
  });

  it('includes LCL height for each trace', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    result.traces.forEach((trace: SkewTTrace) => {
      expect(trace.lcl).toBeGreaterThan(0);
      expect(typeof trace.lcl).toBe('number');
    });
  });

  it('includes parcel trace for each trace', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);
    const expected = expectedLevelCount();

    result.traces.forEach((trace: SkewTTrace) => {
      expect(trace.parcelTrace).toHaveLength(expected);
      trace.parcelTrace.forEach((t: number) => {
        expect(typeof t).toBe('number');
      });
    });
  });

  it('uses actual profile temperature when available', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    // First trace at 1000hPa should use profile temperature (~18°C)
    const firstTrace = result.traces[0];
    const level1000 = firstTrace.levels.find((l: SkewTLevelData) => l.pressure === 1000);
    expect(level1000?.temperature).toBeCloseTo(18, 0);
  });

  it('uses actual profile dewpoint when available', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    const firstTrace = result.traces[0];
    const level1000 = firstTrace.levels.find((l: SkewTLevelData) => l.pressure === 1000);
    expect(level1000?.dewpoint).toBeCloseTo(14, 0);
  });
});
