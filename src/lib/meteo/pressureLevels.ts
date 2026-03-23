import type { WeatherModel } from '$lib/api/types';
import type { PressureLevel } from './types';

export type LevelSource = 'model' | 'interpolated';

export interface TaggedPressureLevel extends PressureLevel {
  source: LevelSource;
}

// ISA barometric formula
const ISA_T0_OVER_L = 288.15 / 0.0065; // ≈ 44330.77 m
const ISA_P0_PA = 101325;
const ISA_EXPONENT = (8.31446 * 0.0065) / (9.80665 * 0.0289644); // ≈ 0.190263

export function hPaToMeters(hPa: number): number {
  return Math.round(ISA_T0_OVER_L * (1 - Math.pow((hPa * 100) / ISA_P0_PA, ISA_EXPONENT)));
}

const ALL_PRESSURE_LEVELS = [
  1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 675, 650, 625, 600, 575, 550, 525, 500, 475, 450,
  425, 400, 375, 350, 325, 300,
];

function pickLevels(hPaValues: number[]): PressureLevel[] {
  return hPaValues.map((hPa) => ({ hPa, heightMeters: hPaToMeters(hPa) }));
}

// ─── Per-model native level sets ──────────────────────────────────────────────
const ICON_HEIGHT_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300];
const UKMO_HEIGHT_LEVELS = [1000, 950, 900, 850, 800, 700, 600, 500, 400, 300];
export const MODEL_NATIVE_LEVELS: Record<WeatherModel, PressureLevel[]> = {
  icon_seamless: pickLevels(ICON_HEIGHT_LEVELS),
  icon_d2: pickLevels(ICON_HEIGHT_LEVELS),
  icon_eu: pickLevels(ICON_HEIGHT_LEVELS),
  icon_global: pickLevels(ICON_HEIGHT_LEVELS),
  gfs_seamless: pickLevels(ALL_PRESSURE_LEVELS),
  meteofrance_seamless: pickLevels(ICON_HEIGHT_LEVELS),
  ukmo_seamless: pickLevels(UKMO_HEIGHT_LEVELS),
  cma_grapes_global: pickLevels(ICON_HEIGHT_LEVELS),
  gem_seamless: pickLevels(ICON_HEIGHT_LEVELS),
};

export function getNativeLevelsForModel(model: WeatherModel, maxAltitude: number): PressureLevel[] {
  // 50m margin to include levels that are very close to the specified top height, e.g. 3012m for 3000m
  return MODEL_NATIVE_LEVELS[model].filter((l) => l.heightMeters <= maxAltitude + 50);
}

/**
 * Like getNativeLevelsForModel, but also includes the first native level above
 * maxAltitude. This ensures callers always have an upper bracket available for
 * interpolation up to the ceiling.
 */
export function getNativeLevelsForFetch(model: WeatherModel, maxAltitude: number): PressureLevel[] {
  const levels = MODEL_NATIVE_LEVELS[model];
  const withinBounds = levels.filter((l) => l.heightMeters <= maxAltitude);
  const firstAbove = levels.find((l) => l.heightMeters > maxAltitude);
  if (firstAbove) withinBounds.push(firstAbove);
  return withinBounds;
}

function buildInterpolatedLevels(nativeLevels: PressureLevel[]): TaggedPressureLevel[] {
  return ALL_PRESSURE_LEVELS.flatMap((levelHPa): TaggedPressureLevel[] => {
    const lower = [...nativeLevels].reverse().find((l) => l.hPa <= levelHPa);
    const upper = nativeLevels.find((l) => l.hPa > levelHPa);
    if (!lower || !upper) return [];
    return [
      {
        hPa: levelHPa,
        heightMeters: hPaToMeters(levelHPa),
        source: 'interpolated',
      },
    ];
  });
}

// ─── Combined level set ───────────────────────────────────────────────────────

/**
 * Returns all pressure levels for a given model and altitude ceiling, sorted
 * by height ascending. Each level is tagged with its source so consumers can
 * distinguish native model data points from interpolated ones.
 */
export function getAllTaggedLevelsForModel(model: WeatherModel, maxAltitude: number): TaggedPressureLevel[] {
  // Display set — strictly within bounds, tagged as model source
  const nativeForDisplay = getNativeLevelsForModel(model, maxAltitude).map(
    (l): TaggedPressureLevel => ({ ...l, source: 'model' })
  );
  // Bracket set — includes the one level above maxAltitude so that
  // buildInterpolatedLevels can fill the gap right up to the ceiling
  const nativeForBracket = getNativeLevelsForFetch(model, maxAltitude);
  const interpolated = buildInterpolatedLevels(nativeForBracket).filter((l) => l.heightMeters <= maxAltitude);
  return [...nativeForDisplay, ...interpolated].sort((a, b) => a.heightMeters - b.heightMeters);
}
