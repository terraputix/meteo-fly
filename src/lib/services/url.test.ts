import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInitialParameters, defaultLocation } from './defaults';
import { getSavedComparisonLevel, saveComparisonLevel } from './storage';
import { readURLParams } from './url';

describe('read-only forecast URL parameters', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('restores forecast and chart settings from a read-only parameter reader', () => {
    const params = new URLSearchParams(
      'lat=46.4&lon=8.1&day=2&model=icon_seamless&maxAlt=5000&cellSelection=land&view=skewt&hour=12&daylight=0'
    );
    const readOnlyParams = { get: (name: string) => params.get(name) };

    expect(getInitialParameters(readOnlyParams)).toEqual({
      location: { latitude: 46.4, longitude: 8.1 },
      selectedDay: 2,
      selectedModel: 'icon_seamless',
      maxAltitude: 5000,
      cellSelection: 'land',
      chartView: 'skewt',
      comparisonLevel: '10m',
      hour: 12,
      daylightOnly: false,
    });
  });

  it('ignores a negative hour index', () => {
    const params = new URLSearchParams({ lat: '46', lon: '8', day: '1', model: 'icon_d2', hour: '-1' });
    expect(readURLParams(params, '10m')?.hour).toBeUndefined();
  });

  it.each([
    ['comparison&level=80m', '80m'],
    ['comparison&level=850hPa', '850hPa'],
    ['comparison', '10m'],
    ['comparison&level=777hPa', '10m'],
    ['wind&level=80m', '10m'],
  ])('reads the wind comparison level from view=%s as %s', (view, expectedLevel) => {
    const params = new URLSearchParams(`lat=46&lon=8&day=1&model=icon_d2&view=${view}`);
    expect(getInitialParameters(params).comparisonLevel).toBe(expectedLevel);
  });

  it('uses defaults when the read-only reader has no forecast parameters', () => {
    const params = { get: () => null };

    expect(readURLParams(params, '10m')).toBeNull();
    expect(getInitialParameters(params).location).toEqual(defaultLocation);
  });

  it('restores the saved level on other views and prioritizes a valid comparison link', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    saveComparisonLevel('850hPa');

    const params = new URLSearchParams({ lat: '46', lon: '8', day: '1', model: 'icon_d2', view: 'wind' });
    expect(getInitialParameters(params, getSavedComparisonLevel()).comparisonLevel).toBe('850hPa');
    expect(getInitialParameters(new URLSearchParams(), getSavedComparisonLevel()).comparisonLevel).toBe('850hPa');

    params.set('view', 'comparison');
    params.set('level', '777hPa');
    expect(getInitialParameters(params, getSavedComparisonLevel()).comparisonLevel).toBe('850hPa');
    params.set('level', '10m');
    expect(getInitialParameters(params, getSavedComparisonLevel()).comparisonLevel).toBe('10m');
  });

  it('discards an unsupported saved level', () => {
    vi.stubGlobal('localStorage', { getItem: () => '777hPa' });
    expect(getInitialParameters(new URLSearchParams(), getSavedComparisonLevel()).comparisonLevel).toBe('10m');
  });
});
