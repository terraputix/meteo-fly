import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';
import { fetchWeatherApi } from 'openmeteo';
import { getVariablesForModel } from './variables';
import {
  createHourlyParams,
  createQueryParams,
  fetchModelGridElevation,
  fetchSkewTData,
  fetchWindChartData,
} from '$lib/api/api';

vi.mock('openmeteo', () => ({
  fetchWeatherApi: vi.fn(),
}));

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
});
