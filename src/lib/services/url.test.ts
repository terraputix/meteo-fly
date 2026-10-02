import { describe, expect, it } from 'vitest';
import { getInitialParameters, defaultLocation } from './defaults';
import { readURLParams } from './url';

describe('read-only forecast URL parameters', () => {
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
      hour: 12,
      daylightOnly: false,
    });
  });

  it('uses defaults when the read-only reader has no forecast parameters', () => {
    const params = { get: () => null };

    expect(readURLParams(params)).toBeNull();
    expect(getInitialParameters(params).location).toEqual(defaultLocation);
  });
});
