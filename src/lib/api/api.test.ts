import { resetLocalTimeZone } from '@internationalized/date';
import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';
import { fetchWeatherApi } from 'openmeteo';
import type { VariablesWithTime } from '@openmeteo/sdk/variables-with-time';
import type { WeatherApiResponse } from '@openmeteo/sdk/weather-api-response';
import { resolveLocationTimezone } from '#lib/api/timezone.js';
import { getVariablesForModel } from './variables';
import {
  createHourlyParams,
  createQueryParams,
  fetchModelGridElevation,
  fetchSkewTData,
  fetchWindChartData,
} from '#lib/api/api.js';

vi.mock('#lib/api/timezone.js', () => ({
  FORECAST_URL: 'https://api.open-meteo.com/v1/forecast',
  resolveLocationTimezone: vi.fn(),
}));

vi.mock('openmeteo', () => ({
  fetchWeatherApi: vi.fn(),
}));

function createHourlySection(
  names: string[],
  valuesByName: Record<string, number[] | null>,
  length: number = 24,
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
    time: () => BigInt(Date.parse('2026-07-16T00:00:00Z') / 1000),
    timeEnd: () => BigInt(Date.parse('2026-07-16T00:00:00Z') / 1000) + BigInt(length * interval),
    interval: () => interval,
    variablesLength: () => variables.length,
    variables: (position: number) => variables[position] ?? null,
  } as unknown as VariablesWithTime;
}

function createDailySection(includeSunrise = true, includeSunset = true, date = '2026-07-16'): VariablesWithTime {
  const values = [
    includeSunrise ? BigInt(Date.parse(`${date}T06:00Z`) / 1000) : null,
    includeSunset ? BigInt(Date.parse(`${date}T18:00Z`) / 1000) : null,
  ];
  return {
    variables: (position: number) => ({
      valuesInt64: () => values[position],
      valuesInt64Length: () => 1,
    }),
  } as unknown as VariablesWithTime;
}

function createResponse({
  hourly = null,
  daily = createDailySection(),
  timezone = 'UTC',
}: {
  hourly?: VariablesWithTime | null;
  daily?: VariablesWithTime | null;
  timezone?: string;
}): WeatherApiResponse {
  return {
    timezone: () => timezone,
    latitude: () => 46.8,
    longitude: () => 8.2,
    elevation: () => 500,
    hourly: () => hourly,
    daily: () => daily,
  } as unknown as WeatherApiResponse;
}

describe('API Configuration', () => {
  beforeEach(() => {
    vi.mocked(fetchWeatherApi).mockReset();
    vi.mocked(resolveLocationTimezone).mockReset().mockResolvedValue('UTC');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetLocalTimeZone();
  });

  it.each([
    ['2026-03-28T23:00:00Z', 23],
    ['2026-10-24T22:00:00Z', 25],
  ])('preserves every hourly sample on a DST day starting %s', async (start, count) => {
    vi.mocked(resolveLocationTimezone).mockResolvedValue('Europe/Berlin');
    const names = createHourlyParams(getVariablesForModel('icon_seamless', 4000)).hourly;
    const hourly = createHourlySection(names, {}, count);
    const seconds = BigInt(new Date(start).getTime() / 1000);
    hourly.time = () => seconds;
    hourly.timeEnd = () => seconds + BigInt(count * 3600);
    vi.mocked(fetchWeatherApi).mockResolvedValue([
      createResponse({
        hourly,
        daily: createDailySection(true, true, start.startsWith('2026-03') ? '2026-03-29' : '2026-10-25'),
      }),
    ]);
    const result = await fetchWindChartData({ latitude: 52, longitude: 13 }, 'icon_seamless', new Date(start));
    expect(result.hourly.time).toHaveLength(count);
    expect(result.hourly.time[0].toISOString()).toBe(start.replace('Z', '.000Z'));
    for (let i = 1; i < count; i++) {
      expect(+result.hourly.time[i] - +result.hourly.time[i - 1]).toBe(3600000);
    }
  });

  describe.each(['wind', 'skewt'] as const)('%s local-day boundaries', (view) => {
    it.each([
      ['2026-10-25', '2026-10-24T22:00', '2026-10-25T22:00', 25],
      ['2026-10-26', '2026-10-25T23:00', '2026-10-26T22:00', 24],
      ['2026-03-29', '2026-03-28T23:00', '2026-03-29T21:00', 23],
      ['2026-03-30', '2026-03-29T22:00', '2026-03-30T21:00', 24],
    ])('requests the exact UTC range once for %s', async (day, expectedStart, expectedEnd, count) => {
      vi.stubEnv('TZ', 'UTC');
      resetLocalTimeZone();
      const signal = new AbortController().signal;
      vi.mocked(resolveLocationTimezone).mockResolvedValue('Europe/Berlin');
      const sunrise = createDailySection(true, true, day);
      vi.mocked(fetchWeatherApi).mockImplementation(async (_url, params) => {
        const start = Date.parse(`${params.start_hour}Z`);
        const length = count;
        const values = Array.from({ length }, (_, i) => start / 3600000 + i);
        const hourly = createHourlySection(
          params.hourly as string[],
          {
            temperature_2m: values,
            temperature_1000hPa: values,
            wind_speed_1000hPa: values,
          },
          length
        );
        hourly.time = () => BigInt(start / 1000);
        hourly.timeEnd = () => BigInt(start / 1000 + length * 3600);
        return [createResponse({ hourly, daily: sunrise, timezone: 'GMT' })];
      });
      const location = { latitude: 52, longitude: 13 };
      const reference = new Date(`${day}T12:00:00Z`);
      const result =
        view === 'wind'
          ? await fetchWindChartData(location, 'icon_d2', reference, 1, 4000, 'nearest', signal)
          : await fetchSkewTData(location, 'icon_d2', reference, 4000, 'nearest', signal);
      expect(vi.mocked(fetchWeatherApi)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fetchWeatherApi).mock.calls[0]?.[1]).toMatchObject({
        timezone: 'GMT',
        start_hour: expectedStart,
        end_hour: expectedEnd,
      });
      expect(vi.mocked(fetchWeatherApi).mock.calls[0]?.[5]).toEqual({ signal });
      expect(result.timezone).toBe('Europe/Berlin');
      expect(result.hourly.time).toHaveLength(count);
      expect(result.hourly.time[0]).toEqual(new Date(`${expectedStart}Z`));
      expect(result.hourly.time.at(-1)).toEqual(new Date(`${expectedEnd}Z`));
      const expectedValues = result.hourly.time.map((time) => +time / 3600000);
      expect(Array.from(result.hourly.temperature_2m)).toEqual(expectedValues);
      expect(Array.from(result.hourly.windSpeedProfile._1000hPa ?? [])).toEqual(expectedValues);
      if ('sunrise' in result) expect(result.sunrise).toEqual(new Date(`${day}T06:00Z`));
    });
  });

  it.each([
    [
      'Pacific/Auckland',
      '2026-10-22',
      ['2026-10-20T17:27Z', '2026-10-21T17:27Z'],
      ['2026-10-21T06:43Z', '2026-10-22T06:43Z'],
      1,
    ],
    [
      'America/Los_Angeles',
      '2026-07-15',
      ['2026-07-15T13:00Z', '2026-07-16T13:00Z'],
      ['2026-07-16T03:00Z', '2026-07-17T03:00Z'],
      0,
    ],
    [
      'Pacific/Kiritimati',
      '2026-10-22',
      ['2026-10-21T16:15Z', '2026-10-22T16:15Z'],
      ['2026-10-22T04:20Z', '2026-10-23T04:20Z'],
      0,
    ],
  ])('selects sunrise and sunset by local date in %s', async (timezone, date, sunrises, sunsets, index) => {
    vi.mocked(resolveLocationTimezone).mockResolvedValue(timezone);
    const daily = {
      variables: (position: number) => ({
        valuesInt64Length: () => 2,
        valuesInt64: (i: number) => BigInt(Date.parse([sunrises, sunsets][position][i]) / 1000),
      }),
    } as unknown as VariablesWithTime;
    vi.mocked(fetchWeatherApi).mockImplementation(async (_url, params) => [
      createResponse({ hourly: createHourlySection(params.hourly as string[], {}), daily }),
    ]);
    const result = await fetchWindChartData(
      { latitude: 0, longitude: 0 },
      'icon_global',
      new Date(`${date}T00:00Z`),
      1,
      4000,
      'nearest',
      undefined,
      timezone === 'America/Los_Angeles' ? 1 : 0
    );
    expect(result.sunrise).toEqual(new Date(sunrises[index]));
    expect(result.sunset).toEqual(new Date(sunsets[index]));
    expect(fetchWeatherApi).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['polar day', '2026-06-21', true, true],
    ['polar night', '2026-12-21', true, true],
    ['no sunrise', '2026-07-16', true, false],
    ['no sunset', '2026-07-16', false, true],
  ])('loads weather with absent solar events: %s', async (_name, date, noSunrise, noSunset) => {
    const events = [
      noSunrise ? 0n : BigInt(Date.parse(`${date}T06:00Z`) / 1000),
      noSunset ? 0n : BigInt(Date.parse(`${date}T18:00Z`) / 1000),
    ];
    const daily = {
      variables: (position: number) => ({
        valuesInt64Length: () => 1,
        valuesInt64: () => events[position],
      }),
    } as unknown as VariablesWithTime;
    vi.mocked(fetchWeatherApi).mockImplementation(async (_url, params) => [
      createResponse({ hourly: createHourlySection(params.hourly as string[], { temperature_2m: [5] }), daily }),
    ]);
    const result = await fetchWindChartData({ latitude: 78, longitude: 15 }, 'icon_global', new Date(`${date}T12:00Z`));
    expect(result.sunrise).toEqual(noSunrise ? null : new Date(`${date}T06:00Z`));
    expect(result.sunset).toEqual(noSunset ? null : new Date(`${date}T18:00Z`));
    expect(result.hourly.temperature_2m[0]).toBe(5);
  });

  it.each([
    ['polar night', 0],
    ['polar day', 86400],
  ])('ignores midnight placeholders from real %s responses', async (_name, duration) => {
    vi.mocked(resolveLocationTimezone).mockResolvedValue('Europe/Oslo');
    const midnight = BigInt(Date.parse('2026-10-21T00:00Z') / 1000);
    const daily = {
      variables: (position: number) => ({
        valuesInt64Length: () => 2,
        valuesInt64: (i: number) => midnight + BigInt(i * 86400 + (position === 1 ? duration : 0)),
      }),
    } as unknown as VariablesWithTime;
    vi.mocked(fetchWeatherApi).mockImplementation(async (_url, params) => [
      createResponse({ hourly: createHourlySection(params.hourly as string[], { temperature_2m: [-15] }), daily }),
    ]);
    const result = await fetchWindChartData(
      { latitude: 89, longitude: 15 },
      'icon_global',
      new Date('2026-10-22T12:00Z')
    );
    expect(result.sunrise).toBeNull();
    expect(result.sunset).toBeNull();
    expect(result.hourly.temperature_2m[0]).toBe(-15);
    expect(result.polarDaylight).toBe(duration === 86400 ? 'day' : 'night');
  });

  it('prefers a matching solar event over an absent event on a neighboring day', async () => {
    const daily = {
      variables: (position: number) => ({
        valuesInt64Length: () => 2,
        valuesInt64: (i: number) =>
          i === 0 ? 0n : BigInt(Date.parse(position === 0 ? '2026-07-16T06:00Z' : '2026-07-16T18:00Z') / 1000),
      }),
    } as unknown as VariablesWithTime;
    vi.mocked(fetchWeatherApi).mockImplementation(async (_url, params) => [
      createResponse({ hourly: createHourlySection(params.hourly as string[], {}), daily }),
    ]);
    const result = await fetchWindChartData(
      { latitude: 78, longitude: 15 },
      'icon_global',
      new Date('2026-07-16T12:00Z')
    );
    expect(result.sunrise).toEqual(new Date('2026-07-16T06:00Z'));
    expect(result.sunset).toEqual(new Date('2026-07-16T18:00Z'));
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

  describe('createQueryParams date handling', () => {
    beforeEach(() => {
      vi.stubEnv('TZ', 'Europe/Berlin');
      resetLocalTimeZone();
    });

    it('requests exact UTC hours and the covering daily dates', () => {
      const location = { latitude: 52.52, longitude: 13.4 };
      const hourlyParams = { hourly: ['temperature_2m', 'wind_speed_10m'] };
      const model = 'icon_d2';
      const startDate = new Date('2023-10-25T23:30:00Z');
      const numberOfDays = 3;

      const params = createQueryParams(location, hourlyParams, model, 'land', startDate, numberOfDays, 'Europe/Berlin');

      const expectedStartDate = '2023-10-25';

      const expectedEndDate = '2023-10-28';

      expect(params.start_date).toBe(expectedStartDate);
      expect(params.end_date).toBe(expectedEndDate);
      expect(params.cell_selection).toBe('land');
      expect(params.timezone).toBe('GMT');
      expect(params.start_hour).toBe('2023-10-25T22:00');
      expect(params.end_hour).toBe('2023-10-28T21:00');
    });

    it('applies the selected day offset before converting both boundaries to UTC', () => {
      const params = createQueryParams(
        { latitude: 52, longitude: 13 },
        { hourly: ['temperature_2m'] },
        'icon_global',
        'nearest',
        new Date('2026-10-22T15:00Z'),
        1,
        'Europe/Berlin',
        4
      );
      expect(params).toMatchObject({
        timezone: 'GMT',
        start_hour: '2026-10-25T23:00',
        end_hour: '2026-10-26T22:00',
      });
    });

    it('increments forecast calendar days in the resolved timezone across DST', () => {
      const location = { latitude: 0, longitude: 0 };
      const hourlyParams = { hourly: ['temperature_2m'] };
      const referenceDate = new Date('2026-03-29T00:30:00Z');

      const today = createQueryParams(location, hourlyParams, 'icon_global', 'nearest', referenceDate, 1, 'UTC', 0);
      const tomorrow = createQueryParams(location, hourlyParams, 'icon_global', 'nearest', referenceDate, 1, 'UTC', 1);

      expect(today.start_date).toBe('2026-03-29');
      expect(tomorrow.start_date).toBe('2026-03-30');
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
      expect(vi.mocked(fetchWeatherApi).mock.calls[0]?.[1]).toMatchObject({
        timezone: _name === 'model grid elevation' ? 'auto' : 'GMT',
      });
      expect(vi.mocked(fetchWeatherApi).mock.calls[0]?.[5]).toEqual({ signal: controller.signal });
    });
  });

  describe('missing weather data', () => {
    const location = { latitude: 46.8, longitude: 8.2 };
    const start = new Date('2026-07-16T00:00:00Z');

    it('uses the location calendar date without a forecast retry', async () => {
      vi.mocked(resolveLocationTimezone).mockResolvedValue('America/Los_Angeles');
      vi.mocked(fetchWeatherApi).mockImplementation(async (_url, params) => [
        createResponse({
          hourly: createHourlySection(params.hourly as string[], {}),
          daily: {
            variables: (position: number) => ({
              valuesInt64Length: () => 1,
              valuesInt64: () => BigInt(Date.parse(position === 0 ? '2026-07-15T13:00Z' : '2026-07-16T03:00Z') / 1000),
            }),
          } as unknown as VariablesWithTime,
        }),
      ]);
      const result = await fetchWindChartData(location, 'icon_d2', new Date('2026-07-16T01:00:00Z'));
      expect(fetchWeatherApi).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fetchWeatherApi).mock.calls[0]?.[1]).toMatchObject({
        timezone: 'GMT',
        start_hour: '2026-07-15T07:00',
        end_hour: '2026-07-16T06:00',
      });
      expect(result.timezone).toBe('America/Los_Angeles');
    });

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

      expect(Array.from(result.hourly.temperature_2m)).toEqual([20, ...Array(23).fill(NaN)]);
      expect(Array.from(result.hourly.windSpeedProfile._1000hPa ?? [])).toEqual([10, ...Array(23).fill(NaN)]);
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

      expect(result.hourly.temperatureProfile._1000hPa).toEqual(new Float32Array([18, 19, 20, ...Array(21).fill(NaN)]));
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
