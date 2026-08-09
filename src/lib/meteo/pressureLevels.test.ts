import { describe, expect, it } from 'vitest';
import { MODEL_OPTIONS } from '$lib/api/models';
import { MAX_ALTITUDE_OPTIONS } from './types';
import {
  getAllTaggedLevelsForModel,
  getNativeLevelsForFetch,
  getNativeLevelsForModel,
  hPaToMeters,
  metersToHPaExact,
} from './pressureLevels';

const cases = MODEL_OPTIONS.flatMap(({ id: model }) =>
  MAX_ALTITUDE_OPTIONS.map(({ value: maxAltitude }) => ({ model, maxAltitude }))
);

describe.each(cases)('pressure levels for $model at $maxAltitude m', ({ model, maxAltitude }) => {
  it('returns one sorted entry per pressure with native levels preferred', () => {
    const levels = getAllTaggedLevelsForModel(model, maxAltitude);
    const nativeLevels = getNativeLevelsForModel(model, maxAltitude);

    expect(new Set(levels.map((level) => level.hPa)).size).toBe(levels.length);
    expect(levels.map((level) => level.heightMeters)).toEqual(
      [...levels].sort((a, b) => a.heightMeters - b.heightMeters).map((level) => level.heightMeters)
    );

    for (const nativeLevel of nativeLevels) {
      expect(levels.find((level) => level.hPa === nativeLevel.hPa)?.source).toBe('model');
    }
  });
});

describe('GFS pressure levels', () => {
  it.each(MAX_ALTITUDE_OPTIONS)('uses only native entries at $value m', ({ value: maxAltitude }) => {
    const levels = getAllTaggedLevelsForModel('gfs_seamless', maxAltitude);

    expect(levels.every((level) => level.source === 'model')).toBe(true);
  });
});

describe('10 km pressure levels', () => {
  it.each(MODEL_OPTIONS)('fetches $name through 200 hPa', ({ id: model }) => {
    const levels = getNativeLevelsForFetch(model, 10000);

    expect(levels[levels.length - 1]?.hPa).toBe(200);
  });
});

describe('continuous pressure conversion', () => {
  it('preserves fractional pressure for chart coordinates', () => {
    const pressure = metersToHPaExact(4000);

    expect(pressure).toBeCloseTo(616.4, 1);
    expect(hPaToMeters(pressure)).toBe(4000);
  });
});
