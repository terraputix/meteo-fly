import { fetchWeatherApi } from 'openmeteo';
import type { Location } from '#lib/api/types.js';

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const timezones = new Map<string, Promise<string>>();

export async function resolveLocationTimezone(location: Location, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const key = `${location.latitude},${location.longitude}`;
  let lookup = timezones.get(key);
  if (!lookup) {
    lookup = fetchWeatherApi(FORECAST_URL, { ...location, timezone: 'auto' })
      .then((responses) => {
        const timezone = responses[0]?.timezone();
        if (!timezone) throw new Error('Open-Meteo response is missing the location timezone');
        new Intl.DateTimeFormat('en', { timeZone: timezone });
        return timezone;
      })
      .catch((error: unknown) => {
        timezones.delete(key);
        throw error;
      });
    timezones.set(key, lookup);
  }
  if (!signal) return lookup;

  // A cancelled chart must not cancel the other chart's shared lookup.
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    lookup.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
