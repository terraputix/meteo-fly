import { describe, it, expect } from 'vitest';
import type { SkewTWeatherData } from '$lib/api/types';
import { buildSkewTData } from './skewT';
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
      surfacePressure: new Float32Array([950, 950, 950]),
      boundaryLayerHeight: new Float32Array([1500, 1600, 1700]),
      sensibleHeatFlux: new Float32Array([200, 220, 240]),
      latentHeatFlux: new Float32Array([100, 110, 120]),
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
      cloudCoverProfile: {
        _1000hPa: new Float32Array([20, 30, 40]),
        _925hPa: new Float32Array([40, 50, 60]),
        _850hPa: new Float32Array([60, 70, 80]),
        _700hPa: new Float32Array([80, 90, 100]),
        _600hPa: new Float32Array([50, 60, 70]),
        _500hPa: new Float32Array([30, 40, 50]),
        _400hPa: new Float32Array([20, 30, 40]),
        _300hPa: new Float32Array([10, 20, 30]),
      } as SkewTWeatherData['hourly']['cloudCoverProfile'],
      geopotentialHeightProfile: {},
    },
    modelGridElevation: 500,
    timezone: 'UTC',
    timezoneAbbr: 'UTC',
  };
}

describe('Skew-T data building', () => {
  it('builds skew-t data for icon_d2 model', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    expect(result.traces).toHaveLength(3);
    expect(result.modelGridElevation).toBe(500);
    expect(result.timezone).toBe('UTC');
    expect(result.timezoneAbbr).toBe('UTC');
  });

  it('uses the raw model-grid elevation and profile pressure for the LCL', () => {
    const weatherData = createMockSkewTData();
    weatherData.hourly.geopotentialHeightProfile = {
      _900hPa: new Float32Array([1000, 1000, 1000]),
      _850hPa: new Float32Array([1500, 1500, 1500]),
    };
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    expect(result.traces[0].lcl).toBe(1125);
    expect(result.traces[0].lclPressure).toBeCloseTo(Math.exp(Math.log(900) + (Math.log(850) - Math.log(900)) * 0.25));
  });

  it('returns correct number of levels per trace (native + interpolated)', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    result.traces.forEach((trace: SkewTTrace) => {
      expect(trace.levels).toHaveLength(16);
    });
  });

  it('marks native vs interpolated levels correctly', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    result.traces.forEach((trace: SkewTTrace) => {
      const nativeCount = trace.levels.filter((l: SkewTLevelData) => !l.isInterpolated).length;
      const interpCount = trace.levels.filter((l: SkewTLevelData) => l.isInterpolated).length;
      expect(nativeCount + interpCount).toBe(16);
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

  it('includes surface temperature and dewpoint for each trace', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    result.traces.forEach((trace: SkewTTrace, i: number) => {
      expect(trace.surfaceTemp).toBe(20 + 2 * i);
      expect(trace.surfaceDewpoint).toBe(15 + i);
    });
  });

  it('builds thermal diagnostics from native levels and surface pressure', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    expect(result.traces[0].surfacePressure).toBe(950);
    expect(result.traces[0].thermal.levels.some((level) => level.pressure === 875)).toBe(false);
    expect(result.traces[0].thermal.levels.length).toBeLessThan(result.traces[0].levels.length);
  });

  it('builds a GFS thermal-strength estimate and omits it for other models', () => {
    const weatherData = createMockSkewTData();

    const gfs = buildSkewTData(weatherData, 'gfs_seamless', 4000);
    const icon = buildSkewTData(weatherData, 'icon_d2', 4000);

    expect(gfs.traces[0].thermalStrength?.convectiveVelocityScale).toBeGreaterThan(0);
    expect(gfs.traces[0].thermalStrength?.boundaryLayerHeightAglMeters).toBe(1500);
    expect(icon.traces[0].thermalStrength).toBeNull();
  });

  it('falls back to elevation-based surface pressure when the API value is missing', () => {
    const weatherData = createMockSkewTData();
    weatherData.hourly.surfacePressure.fill(NaN);

    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    expect(result.traces[0].surfacePressure).toBeGreaterThan(900);
    expect(result.traces[0].surfacePressure).toBeLessThan(1000);
  });

  it('uses actual profile temperature when available', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    // First trace at 1000hPa should use profile temperature (~18°C)
    const firstTrace = result.traces[0];
    const level1000 = firstTrace.levels.find((l: SkewTLevelData) => l.pressure === 1000);
    expect(level1000?.temperature).toBe(18);
  });

  it('uses actual profile dewpoint when available', () => {
    const weatherData = createMockSkewTData();
    const result = buildSkewTData(weatherData, 'icon_d2', 4000);

    const firstTrace = result.traces[0];
    const level1000 = firstTrace.levels.find((l: SkewTLevelData) => l.pressure === 1000);
    expect(level1000?.dewpoint).toBe(14);
  });
});
