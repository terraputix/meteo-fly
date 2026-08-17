import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';
import { fetchWeatherApi } from 'openmeteo';
import type { VariablesWithTime } from '@openmeteo/sdk/variables-with-time';
import type { WeatherApiResponse } from '@openmeteo/sdk/weather-api-response';
import { getVariablesForModel } from './variables';
import {
  createHourlyParams,
  createQueryParams,
  createRainSpotCoordinates,
  fetchModelGridElevation,
  fetchRainSpotData,
  fetchSkewTData,
  fetchWindChartData,
} from '$lib/api/api';

vi.mock('openmeteo', () => ({
  fetchWeatherApi: vi.fn(),
}));

function createHourlySection(
  names: string[],
  valuesByName: Record<string, number[] | null>,
  length: number = 3,
  interval: number = 3600
): VariablesWithTime {
  const variables = names.map((name) => {
    const values = valuesByName[name];
    if (values === undefined) return null;
    return {
      valuesArray: () => (values === null ? null : new Float32Array(values)),
    };
  });

  return {
    time: () => 1_752_643_200n,
    timeEnd: () => 1_752_643_200n + BigInt(length * interval),
    interval: () => interval,
    variablesLength: () => variables.length,
    variables: (position: number) => variables[position] ?? null,
  } as unknown as VariablesWithTime;
}

function createDailySection(includeSunrise: boolean = true, includeSunset: boolean = true): VariablesWithTime {
  const values = [includeSunrise ? 1_752_657_600n : null, includeSunset ? 1_752_715_200n : null];
  return {
    variables: (position: number) => ({
      valuesInt64: () => values[position],
    }),
  } as unknown as VariablesWithTime;
}

function createResponse({
  hourly = null,
  daily = createDailySection(),
  latitude = 46.8,
  longitude = 8.2,
}: {
  hourly?: VariablesWithTime | null;
  daily?: VariablesWithTime | null;
  latitude?: number;
  longitude?: number;
}): WeatherApiResponse {
  return {
    timezoneAbbreviation: () => 'UTC',
    latitude: () => latitude,
    longitude: () => longitude,
    elevation: () => 500,
    hourly: () => hourly,
    daily: () => daily,
  } as unknown as WeatherApiResponse;
}

describe('API Configuration', () => {
  beforeEach(() => {
    vi.mocked(fetchWeatherApi).mockReset();
  });

  it('should generate correct parameters for ICON-D2 model', () => {
    const variables = getVariablesForModel('icon_d2');
    const params = createHourlyParams(variables);
    expect(params.hourly).toContain('temperature_2m');
    expect(params.hourly).toContain('cloud_cover_1000hPa');
    expect(params.hourly).toContain('wind_speed_1000hPa');
  });

  it('should combine default and model-specific variables', () => {
    const variables = getVariablesForModel('icon_d2');
    const defaultVarCount = getVariablesForModel('icon_global').length;
    expect(variables.length).toBeGreaterThanOrEqual(defaultVarCount);
  });

  it('creates a north-to-south 5×5 grid centred on the selected location', () => {
    const location = { latitude: 47, longitude: 8 };
    const coordinates = createRainSpotCoordinates(location);

    expect(coordinates).toHaveLength(25);
    expect(coordinates[12]).toEqual(location);
    expect(coordinates[0].latitude).toBeGreaterThan(location.latitude);
    expect(coordinates[0].longitude).toBeLessThan(location.longitude);
    expect(coordinates[24].latitude).toBeLessThan(location.latitude);
    expect(coordinates[24].longitude).toBeGreaterThan(location.longitude);
    expect((coordinates[0].latitude - coordinates[20].latitude) * 111.32).toBeCloseTo(40, 5);
  });

  it('fetches precipitation for all 25 rain spot coordinates', async () => {
    vi.mocked(fetchWeatherApi).mockImplementationOnce(async (_url, params) => {
      const latitudes = params.latitude as number[];
      const longitudes = params.longitude as number[];
      expect(latitudes).toHaveLength(25);
      expect(longitudes).toHaveLength(25);
      expect(params).toMatchObject({
        hourly: ['precipitation'],
        models: 'icon_seamless',
        cell_selection: 'nearest',
      });
      expect(params.elevation).toEqual(Array(25).fill('nan'));
      return latitudes.map((latitude, index) =>
        createResponse({
          latitude,
          longitude: longitudes[index],
          daily: null,
          hourly: createHourlySection(['precipitation'], { precipitation: [index, index + 1, index + 2] }),
        })
      );
    });

    const result = await fetchRainSpotData(
      { latitude: 47, longitude: 8 },
      'icon_seamless',
      new Date('2026-07-16T00:00:00Z')
    );

    expect(result.gridSize).toBe(5);
    expect(result.radiusKm).toBe(20);
    expect(result.cells).toHaveLength(25);
    expect(result.cells[12]).toMatchObject({ row: 2, column: 2 });
    expect(result.cells[12].precipitation).toEqual(new Float32Array([12, 13, 14]));
  });

  describe('createQueryParams date handling', () => {
    beforeEach(() => {
      vi.stubEnv('TZ', 'Europe/Berlin');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should correctly format start_date and end_date and include local timezone', () => {
      const location = { latitude: 52.52, longitude: 13.4 };
      const hourlyParams = { hourly: ['temperature_2m', 'wind_speed_10m'] };
      const model = 'icon_d2';
      // Use a specific date in UTC. In local time Europe/Berlin this already
      // corresponds to 26.10.2023 01:30
      const startDate = new Date('2023-10-25T23:30:00Z');
      const numberOfDays = 3;

      const params = createQueryParams(location, hourlyParams, model, 'land', startDate, numberOfDays);

      // Expected start_date is simply the YYYY-MM-DD part of the input date
      const expectedStartDate = '2023-10-26';

      // Calculate expected end_date: startDate + (numberOfDays - 1) days
      // 2023-10-26 (day 1) + 2 days = 2023-10-28
      const expectedEndDate = '2023-10-28';

      expect(params.start_date).toBe(expectedStartDate);
      expect(params.end_date).toBe(expectedEndDate);
      expect(params.cell_selection).toBe('land');
      expect(params.timezone).toBe('Europe/Berlin'); // Verify the mocked local timezone is passed
    });
  });

  describe('request cancellation', () => {
    it.each([
      [
        'model grid elevation',
        (signal: AbortSignal) =>
          fetchModelGridElevation({ latitude: 46.8, longitude: 8.2 }, 'icon_d2', 'nearest', signal),
      ],
      [
        'wind chart',
        (signal: AbortSignal) =>
          fetchWindChartData(
            { latitude: 46.8, longitude: 8.2 },
            'icon_d2',
            new Date('2026-07-16T00:00:00Z'),
            1,
            4000,
            'nearest',
            signal
          ),
      ],
      [
        'rain spot',
        (signal: AbortSignal) =>
          fetchRainSpotData(
            { latitude: 46.8, longitude: 8.2 },
            'icon_seamless',
            new Date('2026-07-16T00:00:00Z'),
            1,
            signal
          ),
      ],
      [
        'Skew-T',
        (signal: AbortSignal) =>
          fetchSkewTData(
            { latitude: 46.8, longitude: 8.2 },
            'icon_d2',
            new Date('2026-07-16T00:00:00Z'),
            4000,
            'nearest',
            signal
          ),
      ],
    ])('forwards the AbortSignal for %s requests', async (_name, request) => {
      const abortError = new DOMException('Aborted', 'AbortError');
      vi.mocked(fetchWeatherApi).mockRejectedValueOnce(abortError);
      const controller = new AbortController();

      await expect(request(controller.signal)).rejects.toBe(abortError);
      expect(vi.mocked(fetchWeatherApi).mock.calls[0]?.[5]).toEqual({ signal: controller.signal });
    });
  });

  describe('missing weather data', () => {
    const location = { latitude: 46.8, longitude: 8.2 };
    const start = new Date('2026-07-16T00:00:00Z');

    it('pads a short flat variable and leaves missing pressure levels absent', async () => {
      vi.mocked(fetchWeatherApi).mockImplementationOnce(async (_url, params) => {
        const names = params.hourly as string[];
        return [
          createResponse({
            hourly: createHourlySection(names, {
              temperature_2m: [20],
              wind_speed_1000hPa: [10],
              wind_direction_1000hPa: null,
            }),
          }),
        ];
      });

      const result = await fetchWindChartData(location, 'icon_d2', start);

      expect(Array.from(result.hourly.temperature_2m)).toEqual([20, NaN, NaN]);
      expect(Array.from(result.hourly.windSpeedProfile._1000hPa ?? [])).toEqual([10, NaN, NaN]);
      expect(result.hourly.windDirectionProfile._1000hPa).toBeUndefined();
      expect(Array.from(result.hourly.dewpoint_2m).every(Number.isNaN)).toBe(true);
    });

    it('allows Skew-T data with missing pressure-level and surface arrays', async () => {
      vi.mocked(fetchWeatherApi).mockImplementationOnce(async (_url, params) => {
        const names = params.hourly as string[];
        return [
          createResponse({
            daily: null,
            hourly: createHourlySection(names, {
              temperature_1000hPa: [18, 19, 20],
              dew_point_1000hPa: null,
            }),
          }),
        ];
      });

      const result = await fetchSkewTData(location, 'icon_d2', start);

      expect(result.hourly.temperatureProfile._1000hPa).toEqual(new Float32Array([18, 19, 20]));
      expect(result.hourly.dewpointProfile._1000hPa).toBeUndefined();
      expect(Array.from(result.hourly.temperature_2m).every(Number.isNaN)).toBe(true);
    });

    it.each([
      ['no response', [], /no wind chart response/],
      ['missing hourly data', [createResponse({ hourly: null })], /missing hourly data/],
      [
        'missing daily data',
        [
          createResponse({
            hourly: createHourlySection(['temperature_2m'], { temperature_2m: [20, 21, 22] }),
            daily: null,
          }),
        ],
        /missing daily data/,
      ],
      [
        'missing sunrise data',
        [
          createResponse({
            hourly: createHourlySection(['temperature_2m'], { temperature_2m: [20, 21, 22] }),
            daily: createDailySection(false, true),
          }),
        ],
        /missing sunrise data/,
      ],
      [
        'missing sunset data',
        [
          createResponse({
            hourly: createHourlySection(['temperature_2m'], { temperature_2m: [20, 21, 22] }),
            daily: createDailySection(true, false),
          }),
        ],
        /missing sunset data/,
      ],
    ])('rejects a response with %s', async (_name, responses, error) => {
      vi.mocked(fetchWeatherApi).mockResolvedValueOnce(responses);

      await expect(fetchWindChartData(location, 'icon_d2', start)).rejects.toThrow(error);
    });

    it('accepts a structurally valid response with no usable values', async () => {
      vi.mocked(fetchWeatherApi).mockImplementationOnce(async (_url, params) => {
        const names = params.hourly as string[];
        return [createResponse({ hourly: createHourlySection(names, {}) })];
      });

      const result = await fetchWindChartData(location, 'icon_d2', start);

      expect(Array.from(result.hourly.temperature_2m).every(Number.isNaN)).toBe(true);
      expect(result.hourly.windSpeedProfile).toEqual({});
    });

    it('rejects an invalid hourly timeline', async () => {
      vi.mocked(fetchWeatherApi).mockImplementationOnce(async (_url, params) => {
        const names = params.hourly as string[];
        return [
          createResponse({
            hourly: createHourlySection(names, { temperature_2m: [20, 21, 22] }, 3, 0),
          }),
        ];
      });

      await expect(fetchWindChartData(location, 'icon_d2', start)).rejects.toThrow('invalid hourly timeline');
    });
  });
});
