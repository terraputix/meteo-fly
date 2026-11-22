import { describe, expect, it } from 'vitest';
import { describeForecastFailure } from '#lib/api/forecastFailure.js';

const message = 'Wind comparison could not load.';

describe('describeForecastFailure', () => {
  it('includes the reason returned by the forecast service', () => {
    expect(
      describeForecastFailure(new Error('Hourly request limit exceeded.\nTry again later.'), message, true)
    ).toEqual({
      message,
      detail: 'Hourly request limit exceeded. Try again later.',
    });
  });

  it('explains an offline failure', () => {
    expect(describeForecastFailure(new TypeError('Failed to fetch'), message, false).detail).toMatch(/you’re offline/i);
  });

  it('explains a failed network request while the device is online', () => {
    expect(describeForecastFailure(new TypeError('Load failed'), message, true).detail).toMatch(
      /couldn’t reach Open-Meteo/
    );
  });

  it('omits empty details and bounds long responses', () => {
    expect(describeForecastFailure(new Error(' '), message, true)).toEqual({ message });
    expect(describeForecastFailure(new Error('x'.repeat(300)), message, true).detail).toBe(`${'x'.repeat(239)}…`);
  });
});
