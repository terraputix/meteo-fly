import type { VerticalProfile, VerticalProfileKey } from '$lib/api/types';
import type { PressureLevel } from '$lib/meteo/types';

export function getAtLevel(data: VerticalProfile, pressure: number): Float32Array | undefined {
  const key = `_${pressure}hPa` as VerticalProfileKey;
  return data[key];
}

/** All pressure levels including extended 500/400 hPa range */
export const allPressureLevels: PressureLevel[] = [
  { hPa: 1000, heightMeters: 110 },
  { hPa: 975, heightMeters: 320 },
  { hPa: 950, heightMeters: 540 },
  { hPa: 925, heightMeters: 770 },
  { hPa: 900, heightMeters: 1000 },
  { hPa: 850, heightMeters: 1500 },
  { hPa: 800, heightMeters: 2000 },
  { hPa: 700, heightMeters: 3000 },
  { hPa: 600, heightMeters: 4200 },
  { hPa: 500, heightMeters: 5600 },
  { hPa: 400, heightMeters: 7200 },
  { hPa: 350, heightMeters: 8800 },
];

/** Legacy export – all base pressure levels (used for LEVEL_BANDS in chart) */
export const pressureLevels = allPressureLevels;

/** Returns pressure levels whose height is ≤ maxAltitude */
export function getPressureLevelsForAltitude(maxAltitude: number): PressureLevel[] {
  return allPressureLevels.filter((l) => l.heightMeters <= maxAltitude);
}

/** All interpolated levels (covers full altitude range) */
export const allInterpolatedLevels: PressureLevel[] = [
  // Between 900hPa (1000m) and 850hPa (1500m)
  { hPa: -1, heightMeters: 1250 },
  // Between 850hPa (1500m) and 800hPa (2000m)
  { hPa: -1, heightMeters: 1750 },
  // Between 800hPa (2000m) and 700hPa (3000m)
  { hPa: -1, heightMeters: 2250 },
  { hPa: -1, heightMeters: 2500 },
  { hPa: -1, heightMeters: 2750 },
  // Between 700hPa (3000m) and 600hPa (4200m)
  { hPa: -1, heightMeters: 3250 },
  { hPa: -1, heightMeters: 3500 },
  { hPa: -1, heightMeters: 3750 },
  { hPa: -1, heightMeters: 4000 },
  // Between 600hPa (4200m) and 500hPa (5600m) – 250m steps
  { hPa: -1, heightMeters: 4500 },
  { hPa: -1, heightMeters: 4750 },
  { hPa: -1, heightMeters: 5000 },
  { hPa: -1, heightMeters: 5250 },
  { hPa: -1, heightMeters: 5500 },
  // Between 500hPa (5600m) and 400hPa (7200m) – 250m steps
  { hPa: -1, heightMeters: 5750 },
  { hPa: -1, heightMeters: 6000 },
  { hPa: -1, heightMeters: 6250 },
  { hPa: -1, heightMeters: 6500 },
  { hPa: -1, heightMeters: 6750 },
  { hPa: -1, heightMeters: 7000 },
  { hPa: -1, heightMeters: 7250 },
];

/** Legacy export */
export const interpolatedLevels = allInterpolatedLevels;

/** Returns interpolated levels whose height is ≤ maxAltitude */
export function getInterpolatedLevelsForAltitude(maxAltitude: number): PressureLevel[] {
  return allInterpolatedLevels.filter((l) => l.heightMeters <= maxAltitude);
}

/** All levels (pressure + interpolated) sorted by altitude for a given maxAltitude */
export function getAllLevelsForAltitude(maxAltitude: number): PressureLevel[] {
  return [...getPressureLevelsForAltitude(maxAltitude), ...getInterpolatedLevelsForAltitude(maxAltitude)].sort(
    (a, b) => a.heightMeters - b.heightMeters
  );
}
