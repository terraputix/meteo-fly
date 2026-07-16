import { describe, expect, it } from 'vitest';
import { buildVisitedURL } from './storage';

describe('visited URL construction', () => {
  it('preserves the map camera hash alongside forecast parameters', () => {
    expect(
      buildVisitedURL({
        pathname: '/',
        search: '?lat=46.4&lon=8.1&day=1',
        hash: '#8.5/46.415/8.108/-20/30',
      })
    ).toBe('/?lat=46.4&lon=8.1&day=1#8.5/46.415/8.108/-20/30');
  });

  it('supports URLs without a camera hash', () => {
    expect(
      buildVisitedURL({
        pathname: '/forecast',
        search: '?lat=46.4&lon=8.1',
        hash: '',
      })
    ).toBe('/forecast?lat=46.4&lon=8.1');
  });
});
