import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWeatherApi } from 'openmeteo';
import type { WeatherApiResponse } from '@openmeteo/sdk/weather-api-response';

vi.mock('openmeteo', () => ({ fetchWeatherApi: vi.fn() }));

const location = { latitude: 52.52, longitude: 13.4 };
const response = (timezone: string | null) => [{ timezone: () => timezone }] as WeatherApiResponse[];

beforeEach(() => {
  vi.resetModules();
  vi.mocked(fetchWeatherApi).mockReset();
});

describe('location timezone cache', () => {
  it('shares pending lookups and caches successful results by coordinates', async () => {
    const { resolveLocationTimezone } = await import('#lib/api/timezone.js');
    let finish!: (value: WeatherApiResponse[]) => void;
    vi.mocked(fetchWeatherApi).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const wind = resolveLocationTimezone(location);
    const skewt = resolveLocationTimezone({ ...location });
    expect(fetchWeatherApi).toHaveBeenCalledExactlyOnceWith('https://api.open-meteo.com/v1/forecast', {
      ...location,
      timezone: 'auto',
    });
    finish(response('Europe/Berlin'));
    expect(await Promise.all([wind, skewt])).toEqual(['Europe/Berlin', 'Europe/Berlin']);
    expect(await resolveLocationTimezone(location)).toBe('Europe/Berlin');
    expect(fetchWeatherApi).toHaveBeenCalledTimes(1);
    vi.mocked(fetchWeatherApi).mockResolvedValueOnce(response('Europe/London'));
    expect(await resolveLocationTimezone({ latitude: 51.5, longitude: 0 })).toBe('Europe/London');
    expect(fetchWeatherApi).toHaveBeenCalledTimes(2);
  });

  it.each([null, 'not/a-timezone'])('does not cache invalid metadata: %s', async (timezone) => {
    const { resolveLocationTimezone } = await import('#lib/api/timezone.js');
    vi.mocked(fetchWeatherApi).mockResolvedValueOnce(response(timezone)).mockResolvedValueOnce(response('UTC'));
    await expect(resolveLocationTimezone(location)).rejects.toThrow();
    expect(await resolveLocationTimezone(location)).toBe('UTC');
    expect(fetchWeatherApi).toHaveBeenCalledTimes(2);
  });

  it('retries a failed lookup', async () => {
    const { resolveLocationTimezone } = await import('#lib/api/timezone.js');
    vi.mocked(fetchWeatherApi).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response('UTC'));
    await expect(resolveLocationTimezone(location)).rejects.toThrow('offline');
    expect(await resolveLocationTimezone(location)).toBe('UTC');
  });

  it('cancels one caller without cancelling another caller or losing the cache', async () => {
    const { resolveLocationTimezone } = await import('#lib/api/timezone.js');
    let finish!: (value: WeatherApiResponse[]) => void;
    vi.mocked(fetchWeatherApi).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const controller = new AbortController();
    const cancelled = resolveLocationTimezone(location, controller.signal);
    const active = resolveLocationTimezone(location);
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    finish(response('Europe/Berlin'));
    expect(await active).toBe('Europe/Berlin');
    expect(await resolveLocationTimezone(location)).toBe('Europe/Berlin');
    expect(fetchWeatherApi).toHaveBeenCalledTimes(1);
  });

  it('does not start a lookup for an already aborted caller', async () => {
    const { resolveLocationTimezone } = await import('#lib/api/timezone.js');
    await expect(resolveLocationTimezone(location, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchWeatherApi).not.toHaveBeenCalled();
  });
});
